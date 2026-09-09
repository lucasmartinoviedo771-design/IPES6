"""Servicio de comunicación con Google Gemini y orquestación de Function Calling."""

import json
import logging

import requests
from django.conf import settings

from apps.asistente_ia.knowledge.kb_reglamento import buscar_en_reglamento
from apps.asistente_ia.tools.academic_tools import (
    consultar_calendario_academico,
    consultar_materias_cursando,
    consultar_mis_calificaciones,
    consultar_mis_regularidades,
    derivar_consulta_a_bedel,
)
from apps.asistente_ia.tools.diagnostic_tools import (
    diagnosticar_inscripcion_cursada,
    diagnosticar_inscripcion_mesa,
)
from apps.asistente_ia.tools.docente_tools import (
    consultar_mi_horario,
    consultar_mis_mesas,
)

logger = logging.getLogger(__name__)

# Modelo configurable por settings/env para no volver a quedar clavado a una
# version retirada. gemini-1.5-flash esta siendo dado de baja por Google.
GEMINI_MODEL = getattr(settings, "GEMINI_MODEL", "") or "gemini-2.5-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# Claves que nunca deben salir del instituto: identifican a la persona y el
# modelo no las necesita para razonar. Las herramientas ya filtran por el usuario
# autenticado del lado del servidor, asi que a Gemini le alcanza con los datos
# academicos. En el tier gratuito Google puede usar lo enviado para entrenar,
# por eso la anonimizacion se hace siempre, no solo cuando se paga.
CLAVES_IDENTIFICATORIAS = {
    "estudiante",
    "dni",
    "apellido",
    "nombre_completo",
    "apellido_nombre",
    "email",
    "telefono",
    "legajo",
    "cuil",
}


def _anonimizar_para_ia(dato):
    """Devuelve una copia del resultado de una herramienta sin datos identificatorios."""
    if isinstance(dato, dict):
        return {k: _anonimizar_para_ia(v) for k, v in dato.items() if k.lower() not in CLAVES_IDENTIFICATORIAS}
    if isinstance(dato, list):
        return [_anonimizar_para_ia(v) for v in dato]
    return dato


SYSTEM_INSTRUCTION = (
    "Sos Paulo Freire, el educador y patrono del Instituto Provincial de Educación Superior (IPES) "
    "Paulo Freire de Río Grande, Tierra del Fuego.\n"
    "Interactuás directamente con los estudiantes y docentes como su guía y asistente pedagógico institucional. "
    "Tu misión es orientar con rigor, calidez y sabiduría pedagógica en consultas de correlatividades, "
    "inscripciones a cursadas y mesas, calificaciones, fechas del calendario institucional y reglamentos oficiales.\n\n"
    "REGLAS ESTRICTAS DE IDENTIDAD, FUENTE CERRADA Y DERIVACIÓN INSTITUCIONAL:\n"
    "1. Hablás en primera persona como Paulo Freire, con tono empático, formativo y en español rioplatense ('podés', 'tenés').\n"
    "2. DOMINIO CERRADO (PROHIBIDO USAR FUENTES EXTERNAS): Únicamente podés responder información que provenga "
    "de las herramientas de base de datos disponibles o de los fragmentos normativos provistos por 'consultar_normativa_institucional'. "
    "Bajo NINGUNA circunstancia inventes, supongas o apliques conocimientos generales de internet sobre plazos, correlatividades o trámites.\n"
    "3. DERIVACIÓN AL BEDEL: Si una consulta no tiene respuesta en la normativa institucional cargada ni en la base de datos, "
    "o si el estudiante solicita explícitamente contactar a la Bedelía, DEBÉS invocar la herramienta 'derivar_consulta_a_bedel'. "
    "Explicá con claridad que la consulta no se encuentra en las resoluciones digitalizadas y que derivaste un mensaje interno "
    "formal al Bedel de su carrera para que le responda a través de su mensajería de Autogestión.\n"
    "4. DATOS ACADÉMICOS Y CALENDARIO: Utilizá siempre las herramientas correspondientes para notas, regularidades, cursadas "
    "y fechas de calendario (cuatrimestres, recesos, mesas). Cita siempre la fuente oficial cuando esté provista.\n"
    "5. Formato: Usá viñetas y negritas Markdown limpias.\n"
    "6. PRIVACIDAD: No recibís el nombre, el DNI ni ningún dato de contacto de la persona, "
    "porque no salen del instituto. Los datos académicos que te llegan ya corresponden a quien "
    "está consultando. Nunca los pidas ni los inventes: dirigite a la persona en segunda persona "
    "('tenés', 'podés'), sin nombrarla.\n"
    "7. QUIÉN TE CONSULTA: Más abajo se te indica el rol de la persona. No todas son estudiantes: "
    "también consultan docentes, bedeles, secretaría y otros roles. Nunca trates de 'estudiante' a "
    "quien no lo es, ni le ofrezcas trámites que no le corresponden. Si es personal del instituto, "
    "respondé sobre los procedimientos de SU rol según los manuales de uso.\n"
    "8. DERIVACIÓN SEGÚN EL ROL: Derivá a Bedelía solo a estudiantes. Si quien consulta ES de "
    "Bedelía o Secretaría, no le derives la consulta a sí mismo: indicá que el tema no está en la "
    "documentación cargada y sugerí a quién corresponde escalarlo."
)


def _descripcion_del_rol(user) -> str:
    """
    Línea que se agrega al mensaje de sistema para que el asistente sepa con
    quién habla.

    Sin esto trataba a todos de "estudiante": un bedel preguntó por su horario y
    recibió un "Estimado/a estudiante" con la consulta derivada a Bedelía, es
    decir, a sí mismo.
    """
    from core.permissions import get_user_roles

    roles = sorted(get_user_roles(user) or [])
    es_estudiante = getattr(user, "estudiante", None) is not None

    if not roles and es_estudiante:
        roles = ["estudiante"]
    if not roles:
        return "\n\nQUIEN CONSULTA: no se pudo determinar el rol. Respondé solo con normativa general."

    legibles = ", ".join(roles)
    if es_estudiante:
        return (
            f"\n\nQUIEN CONSULTA: estudiante (roles: {legibles}). "
            "Tenés disponibles las herramientas de datos académicos personales."
        )
    return (
        f"\n\nQUIEN CONSULTA: personal del instituto (roles: {legibles}), NO es estudiante. "
        "Las herramientas de datos académicos personales (calificaciones, regularidades, cursadas, "
        "diagnósticos de inscripción) no aplican a esta persona: no las uses. "
        "Respondé con los manuales de uso del sistema correspondientes a su rol y con la normativa."
    )


# Herramientas que consultan el legajo académico de quien pregunta: sin perfil de
# estudiante devuelven "Solo disponible para estudiantes", así que ofrecérselas a
# un docente solo produce respuestas fallidas.
HERRAMIENTAS_SOLO_ESTUDIANTE = {
    "diagnosticar_inscripcion_cursada",
    "diagnosticar_inscripcion_mesa",
    "consultar_mis_calificaciones",
    "consultar_mis_regularidades",
    "consultar_materias_cursando",
    "derivar_consulta_a_bedel",
}


def herramientas_para(user) -> list[dict]:
    """Declaraciones de herramientas que tienen sentido para quien consulta."""
    if getattr(user, "estudiante", None) is not None:
        return TOOL_DECLARATIONS
    return [t for t in TOOL_DECLARATIONS if t["name"] not in HERRAMIENTAS_SOLO_ESTUDIANTE]


TOOL_DECLARATIONS = [
    {
        "name": "diagnosticar_inscripcion_cursada",
        "description": "Verifica si el estudiante puede inscribirse a cursar una materia y diagnostica qué correlativas o requisitos le faltan.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "materia_query": {
                    "type": "STRING",
                    "description": "Nombre o código de la materia sobre la que consulta el estudiante (ej: 'Pedagogía', 'Didáctica General', 'Práctica Docente I').",
                }
            },
            "required": ["materia_query"],
        },
    },
    {
        "name": "diagnosticar_inscripcion_mesa",
        "description": "Verifica si el estudiante está habilitado para rendir examen final en una materia (correlativas para rendir y regularidad vigente).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "materia_query": {
                    "type": "STRING",
                    "description": "Nombre de la materia que desea rendir en examen final.",
                }
            },
            "required": ["materia_query"],
        },
    },
    {
        "name": "consultar_mis_calificaciones",
        "description": "Obtiene el historial de notas obtenidas por el estudiante en exámenes finales y promociones.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "consultar_mis_regularidades",
        "description": "Obtiene la lista de materias que el estudiante tiene actualmente en condición de cursada Regular.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "consultar_materias_cursando",
        "description": "Obtiene las comisiones y materias en las que el estudiante se encuentra inscripto cursando en el ciclo lectivo actual.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "consultar_normativa_institucional",
        "description": "Consulta el reglamento académico institucional sobre trámites, equivalencias, régimen de inasistencias, certificados y mesas.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "consulta": {
                    "type": "STRING",
                    "description": "Palabras clave o descripción del trámite/normativa consultada.",
                }
            },
            "required": ["consulta"],
        },
    },
    {
        "name": "consultar_calendario_academico",
        "description": "Obtiene las fechas oficiales del calendario académico: inicio y finalización de cuatrimestres, recesos, feriados y ventanas de inscripción.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "consulta": {
                    "type": "STRING",
                    "description": "Detalle o tipo de fecha consultada (ej: 'cuatrimestre', 'receso', 'mesas').",
                }
            },
        },
    },
    {
        "name": "consultar_mi_horario",
        "description": "Devuelve la grilla semanal de clases del DOCENTE autenticado: día, horario, materia, comisión y turno. Usar cuando un docente pregunta por su horario, sus clases o cuándo dicta.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "consultar_mis_mesas",
        "description": "Devuelve las próximas mesas de examen donde el DOCENTE autenticado integra el tribunal, con su rol (presidente o vocal), fecha, hora y aula.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "derivar_consulta_a_bedel",
        "description": "Deriva formalmente una consulta del estudiante al Bedel de su carrera mediante un mensaje interno institucional cuando no se encuentra reglamentada.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "consulta": {
                    "type": "STRING",
                    "description": "Texto o inquietud específica del estudiante para ser remitida a la Bedelía.",
                },
                "enviar_ahora": {
                    "type": "BOOLEAN",
                    "description": "True para enviar el mensaje interno formal inmediatamente al Bedel.",
                },
            },
            "required": ["consulta"],
        },
    },
]


def _ejecutar_herramienta_local(nombre: str, args: dict, user) -> dict:
    """Ejecuta una herramienta académica en el entorno Django y registra auditoría para trazabilidad."""
    resultado = {}
    try:
        if nombre == "diagnosticar_inscripcion_cursada":
            resultado = diagnosticar_inscripcion_cursada(user, args.get("materia_query", ""))
        elif nombre == "diagnosticar_inscripcion_mesa":
            resultado = diagnosticar_inscripcion_mesa(user, args.get("materia_query", ""))
        elif nombre == "consultar_mis_calificaciones":
            resultado = consultar_mis_calificaciones(user)
        elif nombre == "consultar_mis_regularidades":
            resultado = consultar_mis_regularidades(user)
        elif nombre == "consultar_materias_cursando":
            resultado = consultar_materias_cursando(user)
        elif nombre == "consultar_mi_horario":
            resultado = consultar_mi_horario(user)
        elif nombre == "consultar_mis_mesas":
            resultado = consultar_mis_mesas(user)
        elif nombre == "consultar_calendario_academico":
            resultado = consultar_calendario_academico(args.get("consulta", ""))
        elif nombre == "derivar_consulta_a_bedel":
            resultado = derivar_consulta_a_bedel(
                user, args.get("consulta", ""), enviar_ahora=args.get("enviar_ahora", True)
            )
        elif nombre == "consultar_normativa_institucional":
            texto = buscar_en_reglamento(args.get("consulta", ""))
            resultado = {"resultado": texto}
        else:
            resultado = {"error": f"Herramienta '{nombre}' no reconocida."}
    except Exception as exc:
        logger.exception("Error ejecutando tool %s para user_id=%s: %s", nombre, getattr(user, "id", None), exc)
        resultado = {"error": f"Ocurrió un error interno al evaluar {nombre}."}

    # Registro de auditoría estructurado sin exponer datos privados de texto
    status_audit = "ok" if "error" not in resultado else "error"
    clean_args = {k: str(v)[:50] for k, v in args.items()}
    logger.info(
        "[ASISTENTE_TOOL_AUDIT] user_id=%s tool=%s args=%s status=%s",
        getattr(user, "id", None),
        nombre,
        clean_args,
        status_audit,
    )
    return resultado


def _procesar_con_gemini_api(api_key: str, mensaje: str, historial: list, user) -> tuple[str, list[str]]:
    """Envía la consulta a la API de Gemini, gestiona llamadas a funciones y devuelve la respuesta final."""
    herramientas_usadas = []

    # Construir historial de contenido
    contents = []
    for h in historial[-6:]:  # Limitar a los últimos 6 turnos para eficiencia
        role = "user" if h.role == "user" else "model"
        contents.append(
            {
                "role": role,
                "parts": [{"text": h.content}],
            }
        )

    # Agregar el mensaje actual del usuario
    contents.append(
        {
            "role": "user",
            "parts": [{"text": mensaje}],
        }
    )

    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}],
        },
        "contents": contents,
        "tools": [
            {"function_declarations": TOOL_DECLARATIONS},
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800,
            # Sin "pensamiento" interno: en los modelos 2.5 esos tokens se
            # facturan como salida (la tarifa cara) y pueden multiplicar por 2-5
            # el costo. Ademas compiten contra maxOutputTokens y pueden dejar la
            # respuesta vacia. Para consultas administrativas no aportan.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    url = f"{GEMINI_API_URL}?key={api_key}"
    resp = requests.post(url, json=payload, timeout=12)

    if resp.status_code != 200:
        logger.error("Error en Gemini API (%s): %s", resp.status_code, resp.text)
        raise RuntimeError(f"Error en proveedor de IA ({resp.status_code})")

    res_json = resp.json()
    candidates = res_json.get("candidates", [])
    if not candidates:
        return "No pude generar una respuesta en este momento. Por favor intentá nuevamente.", []

    first_candidate = candidates[0]
    content = first_candidate.get("content", {})
    parts = content.get("parts", [])

    # Verificar si el modelo solicitó llamar a una herramienta (Function Call)
    function_calls = [p["functionCall"] for p in parts if "functionCall" in p]

    if not function_calls:
        # Respuesta de texto directa
        text_parts = [p.get("text", "") for p in parts if "text" in p]
        return "".join(text_parts).strip(), herramientas_usadas

    # Ejecutar la herramienta solicitada
    fc = function_calls[0]
    func_name = fc.get("name")
    func_args = fc.get("args", {})
    herramientas_usadas.append(func_name)

    resultado_tool = _ejecutar_herramienta_local(func_name, func_args, user)

    # Segunda llamada a Gemini con el resultado de la herramienta
    contents.append(
        {
            "role": "model",
            "parts": [{"functionCall": fc}],
        }
    )
    contents.append(
        {
            "role": "function",
            "parts": [
                {
                    "functionResponse": {
                        "name": func_name,
                        # Se envia el resultado sin datos identificatorios.
                        "response": _anonimizar_para_ia(resultado_tool),
                    }
                }
            ],
        }
    )

    payload_segunda = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}],
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800,
            # Sin "pensamiento" interno: en los modelos 2.5 esos tokens se
            # facturan como salida (la tarifa cara) y pueden multiplicar por 2-5
            # el costo. Ademas compiten contra maxOutputTokens y pueden dejar la
            # respuesta vacia. Para consultas administrativas no aportan.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    resp_segunda = requests.post(url, json=payload_segunda, timeout=12)
    if resp_segunda.status_code == 200:
        res2_json = resp_segunda.json()
        parts2 = res2_json.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text2 = "".join(p.get("text", "") for p in parts2 if "text" in p)
        if text2.strip():
            return text2.strip(), herramientas_usadas

    # Fallback si la segunda llamada no devolvió texto
    return json.dumps(resultado_tool, ensure_ascii=False, indent=2), herramientas_usadas


def _procesar_con_motor_local(mensaje: str, user) -> tuple[str, list[str]]:
    """Motor heurístico local de respaldo cuando no hay clave de API configurada."""
    msg_low = mensaje.lower().strip()
    herramientas_usadas = []

    # 0. Calendario académico / Cuatrimestres / Feriados / Cuándo termina / Cuándo finaliza
    if any(
        p in msg_low
        for p in [
            "cuatrimestre",
            "cuatrimeste",
            "cuando termina",
            "cuando finaliza",
            "fecha limite",
            "calendario",
            "receso",
            "vacaciones",
            "feriado",
            "inicio de clases",
            "fin de clases",
        ]
    ):
        herramientas_usadas.append("consultar_calendario_academico")
        cal = consultar_calendario_academico(mensaje)
        c_actual = cal.get("cuatrimestre_en_curso")
        cuatris = cal.get("cuatrimestres", [])

        lineas = ["📅 **Calendario Académico Institucional (IPES Paulo Freire)**\n"]
        if c_actual:
            lineas.append(
                f"Actualmente nos encontramos en el **{c_actual['nombre']}**:\n"
                f"- **Inicio de clases:** {c_actual['inicio']}\n"
                f"- **Finalización del cuatrimestre:** **{c_actual['fin']}**\n"
            )
        elif cuatris:
            lineas.append("Fechas oficiales de cuatrimestres en el ciclo lectivo:\n")
            for c in cuatris:
                estado = "(En curso)" if c.get("en_curso") else ("(Finalizado)" if c.get("finalizado") else "(Próximo)")
                lineas.append(f"- **{c['nombre']}**: Desde el {c['inicio']} hasta el **{c['fin']}** {estado}")
            lineas.append("")
        else:
            lineas.append("No constan fechas de cuatrimestres registradas en el calendario oficial.")

        # Si hay recesos o feriados próximos
        recesos = cal.get("recesos_feriados", [])
        if recesos:
            lineas.append("\n📌 **Próximos recesos y feriados:**")
            for r in recesos:
                lineas.append(f"- {r['nombre']} ({r['tipo']}): del {r['desde']} al {r['hasta']}")

        # Si hay ventanas activas
        ventanas = [v for v in cal.get("ventanas_habilitadas", []) if v.get("activo_ahora")]
        if ventanas:
            lineas.append("\n🔔 **Inscripciones y trámites habilitados hoy:**")
            for v in ventanas:
                lineas.append(f"- {v['evento']} {v['periodo']}: Hasta el {v['hasta']}")

        return "\n".join(lineas), herramientas_usadas

    # 1. Consulta de notas o calificaciones
    if any(p in msg_low for p in ["nota", "calificacion", "calificaciones", "cuanto me saque", "rendi"]):
        herramientas_usadas.append("consultar_mis_calificaciones")
        res = consultar_mis_calificaciones(user)
        califs = res.get("calificaciones", [])
        if not califs:
            return (
                f"¡Hola {res.get('estudiante', '')}! Soy Paulo Freire. Revisé tus registros académicos y no tenés calificaciones asentadas en actas oficiales por el momento.",
                herramientas_usadas,
            )
        lineas = [
            f"¡Hola {res.get('estudiante', '')}! Soy Paulo Freire. Con gusto te comparto tus calificaciones registradas en el sistema:\n"
        ]
        for c in califs[:8]:
            lineas.append(f"- **{c['materia']}**: Nota **{c['nota']}** ({c['resultado']}) el {c['fecha']}")
        return "\n".join(lineas), herramientas_usadas

    # 2. Consulta de regularidades
    if any(p in msg_low for p in ["regular", "regularidad", "regularice", "materias regulares"]):
        herramientas_usadas.append("consultar_mis_regularidades")
        res = consultar_mis_regularidades(user)
        regs = res.get("materias_regulares", [])
        if not regs:
            return (
                f"¡Hola {res.get('estudiante', '')}! Soy Paulo Freire. No figuran materias en condición regular en este momento.",
                herramientas_usadas,
            )
        lineas = [
            f"¡Hola {res.get('estudiante', '')}! Soy Paulo Freire. En tu plan de estudios contás con **{len(regs)}** materias regulares vigentes:\n"
        ]
        for r in regs:
            lineas.append(f"- **{r['materia']}** (Cursada {r['anio_cursada']})")
        return "\n".join(lineas), herramientas_usadas

    # 3. Diagnóstico de por qué no puedo inscribirme / correlatividades
    if any(p in msg_low for p in ["inscribir", "anotar", "correlativa", "cursar", "puedo rendir"]):
        # Intentar extraer nombre de materia quitando palabras comunes
        palabras_filtro = [
            "por",
            "que",
            "no",
            "puedo",
            "inscribirme",
            "a",
            "me",
            "deja",
            "anotarme",
            "la",
            "materia",
            "el",
            "final",
            "rendir",
        ]
        tokens = [
            w for w in msg_low.replace("?", "").replace("¿", "").split() if w not in palabras_filtro and len(w) > 2
        ]
        query_materia = " ".join(tokens)

        if query_materia:
            herramientas_usadas.append("diagnosticar_inscripcion_cursada")
            diag = diagnosticar_inscripcion_cursada(user, query_materia)
            if "error" in diag:
                return diag["error"], herramientas_usadas

            if diag.get("puede_inscribirse"):
                return (
                    f"✅ **¡Estás en condiciones de inscribirte a {diag['materia']}!**\n\n"
                    f"Revisé tu trayectoria y cumplís con todas las correlativas exigidas por tu plan de estudios. "
                    f"¡Muchos éxitos en la cursada!",
                    herramientas_usadas,
                )
            else:
                faltantes = diag.get("requisitos_faltantes", [])
                lineas = [f"❌ **Aún no podés inscribirte a {diag['materia']}.**\n"]
                if diag.get("motivo_bloqueo"):
                    lineas.append(f"- {diag['motivo_bloqueo']}")
                elif faltantes:
                    lineas.append("Revisé los requisitos del plan y necesitás cumplimentar previamente:")
                    for f in faltantes:
                        lineas.append(f"- {f}")
                return "\n".join(lineas), herramientas_usadas

    # 4. Derivación directa al Bedel o consulta sobre Bedelía
    if any(
        p in msg_low
        for p in [
            "bedel",
            "bedelia",
            "contactar a bedelia",
            "mensaje al bedel",
            "quien es mi bedel",
            "hablar con bedelia",
        ]
    ):
        herramientas_usadas.append("derivar_consulta_a_bedel")
        res_b = derivar_consulta_a_bedel(user, mensaje, enviar_ahora=True)
        return res_b.get("mensaje", ""), herramientas_usadas

    # 5. Trámites institucionales o reglamento oficial (Dominio Cerrado)
    herramientas_usadas.append("consultar_normativa_institucional")
    info = buscar_en_reglamento(mensaje)

    # Si la consulta no coincide con ninguna disposición oficial cargada:
    if "No se encontró una disposición específica" in info:
        herramientas_usadas.append("derivar_consulta_a_bedel")
        res_b = derivar_consulta_a_bedel(user, mensaje, enviar_ahora=True)
        return (
            "📖 **Orientación Institucional (IPES Paulo Freire):**\n\n"
            "Esta consulta específica no se encuentra reglamentada en las disposiciones ni resoluciones digitalizadas del instituto, "
            "y por protocolo institucional no se conjeturan procedimientos no normados.\n\n"
            f"{res_b.get('mensaje', '')}"
        ), herramientas_usadas

    return f"📖 **Orientación Institucional (IPES Paulo Freire):**\n\n{info}", herramientas_usadas


FALLBACK_CONTINGENCIA = (
    "⚠️ En este momento el asistente no pudo completar el procesamiento automático de tu consulta. "
    "Podés consultar tus notas y materias habilitadas directamente desde las secciones de **Mis Calificaciones** "
    "y **Plan de Estudios** en tu menú de Autogestión, o consultar en Bedelía ante cualquier inquietud."
)


CUOTA_AGOTADA = (
    "⚠️ Por hoy alcancé el límite de consultas que puedo procesar con inteligencia artificial. "
    "Te respondo igual con la información del sistema, aunque de forma más simple. "
    "Si necesitás algo puntual, escribí a Bedelía o Secretaría Académica."
)


def responder_consulta_asistente(mensaje: str, historial: list, user) -> tuple[str, list[str]]:
    """
    Punto de entrada principal para responder consultas del usuario.

    El proveedor se elige por configuración (IA_PROVIDER):
      - "openai_compat": Groq, DeepSeek, Qwen, Cerebras, OpenRouter, Mistral...
      - "gemini": la API de Google, con su formato propio.
    Sin credencial configurada se usa el motor heurístico local, que no necesita
    ningún servicio externo.
    """
    proveedor = (getattr(settings, "IA_PROVIDER", "") or "gemini").strip().lower()

    try:
        if proveedor == "openai_compat":
            from apps.asistente_ia.services.openai_compat_service import (
                CuotaAgotadaError,
                procesar_con_openai_compat,
            )

            if not (getattr(settings, "IA_API_KEY", "") or "").strip():
                return _procesar_con_motor_local(mensaje, user)
            try:
                return procesar_con_openai_compat(mensaje, historial, user)
            except CuotaAgotadaError:
                # Se avisa explicitamente en vez de responder con el motor local
                # como si nada: el usuario debe saber por que cambia la calidad.
                logger.warning("[ASISTENTE_CUOTA] proveedor sin cupo disponible")
                texto, tools = _procesar_con_motor_local(mensaje, user)
                return f"{CUOTA_AGOTADA}\n\n{texto}", tools
            except Exception as e:  # noqa: BLE001
                logger.warning("Fallo el proveedor de IA, se usa el motor local: %s", e)
                return _procesar_con_motor_local(mensaje, user)

        api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
        if api_key.strip():
            try:
                return _procesar_con_gemini_api(api_key.strip(), mensaje, historial, user)
            except Exception as e:  # noqa: BLE001
                logger.warning("Fallo en Gemini API, utilizando motor local de contingencia: %s", e)
                return _procesar_con_motor_local(mensaje, user)
        # Modo local / de prueba sin API Key
        return _procesar_con_motor_local(mensaje, user)
    except Exception as general_exc:
        logger.exception("Error imprevisto en asistente para user_id=%s: %s", getattr(user, "id", None), general_exc)
        return FALLBACK_CONTINGENCIA, []
