"""Endpoints de API para el Asistente Virtual con IA."""

import logging

from django.conf import settings
from django.core.cache import cache
from ninja import Router
from ninja.errors import HttpError

from apps.asistente_ia.schemas import ChatRequestIn, ChatResponseOut, SugerenciasOut
from apps.asistente_ia.services.gemini_service import responder_consulta_asistente
from core.auth_ninja import JWTAuth

logger = logging.getLogger(__name__)

router = Router(tags=["Asistente IA"])

MAX_CONSULTAS_PERIODO = 20
VENTANA_SEGUNDOS = 600  # 10 minutos

# Tope de consultas al asistente atendidas al mismo tiempo en todo el instituto.
#
# Cada consulta bloquea un worker de gunicorn mientras espera la respuesta de
# Gemini, y los workers son los mismos que atienden planillas y actas. Sin este
# tope, un puñado de estudiantes usando el chat dejaba sin workers al resto del
# sistema. Con este limite siempre queda capacidad libre para el trabajo
# administrativo, que es el que no puede esperar.
MAX_CONSULTAS_SIMULTANEAS = getattr(settings, "ASISTENTE_MAX_CONCURRENTES", 4)
CLAVE_CONCURRENCIA = "asistente_ia_en_curso"
# Red de seguridad: si un proceso muere sin liberar su lugar, el contador se
# vaciaria para siempre. Con TTL se reinicia solo. Ante la duda preferimos
# subestimar (dejar pasar una consulta de mas) antes que bloquear el asistente.
TTL_CONCURRENCIA = 120


def _tomar_lugar() -> bool:
    """Reserva un lugar de atencion. Devuelve False si ya no hay disponibles."""
    try:
        cache.add(CLAVE_CONCURRENCIA, 0, timeout=TTL_CONCURRENCIA)
        try:
            en_curso = cache.incr(CLAVE_CONCURRENCIA)
        except ValueError:
            # La clave expiro entre el add y el incr.
            cache.set(CLAVE_CONCURRENCIA, 1, timeout=TTL_CONCURRENCIA)
            en_curso = 1
    except Exception:  # noqa: BLE001
        # Sin cache utilizable (o backend dummy en tests) no se limita nada:
        # el asistente debe seguir funcionando.
        return True

    if en_curso > MAX_CONSULTAS_SIMULTANEAS:
        _liberar_lugar()
        return False
    return True


def _liberar_lugar() -> None:
    try:
        cache.decr(CLAVE_CONCURRENCIA)
    except Exception:  # noqa: BLE001
        pass


@router.post("/chat/", response=ChatResponseOut, auth=JWTAuth())
def chat_asistente(request, payload: ChatRequestIn):
    """
    Procesa un mensaje del usuario autenticado, evalúa herramientas académicas
    de diagnóstico y responde con lenguaje natural asistido por IA.
    """
    user = request.user
    mensaje = payload.mensaje.strip()

    if not mensaje:
        return ChatResponseOut(
            respuesta="Por favor ingresá una consulta.",
            sugerencias=[],
            herramientas_ejecutadas=[],
            ok=False,
        )

    # 1. Control de Rate Limiting por usuario
    rate_key = f"asistente_rl_{user.id}"
    consultas_previas = cache.get(rate_key, 0)
    if consultas_previas >= MAX_CONSULTAS_PERIODO:
        logger.warning("[ASISTENTE_RATELIMIT] user_id=%s superó límite de consultas", user.id)
        raise HttpError(
            429,
            "Has alcanzado el límite de consultas por sesión (20 consultas cada 10 min). "
            "Por favor aguardá unos minutos antes de volver a preguntar.",
        )
    cache.set(rate_key, consultas_previas + 1, timeout=VENTANA_SEGUNDOS)

    # 2. Tope de concurrencia: se reserva un lugar antes de ocupar el worker.
    if not _tomar_lugar():
        logger.warning("[ASISTENTE_CONCURRENCIA] user_id=%s rechazado: %d en curso", user.id, MAX_CONSULTAS_SIMULTANEAS)
        raise HttpError(
            503,
            "En este momento estoy atendiendo varias consultas a la vez. Aguardá unos segundos y volvé a intentar.",
        )

    # 3. Procesamiento con asistente
    try:
        respuesta_texto, tools_usadas = responder_consulta_asistente(
            mensaje=mensaje,
            historial=payload.historial,
            user=user,
        )
    finally:
        _liberar_lugar()

    # Sugerencias contextuales de seguimiento
    sugerencias = [
        "¿Cuáles son mis notas?",
        "¿Qué materias tengo regulares?",
        "¿Cómo pido una equivalencia?",
    ]

    return ChatResponseOut(
        respuesta=respuesta_texto,
        sugerencias=sugerencias,
        herramientas_ejecutadas=tools_usadas,
        ok=True,
    )


@router.get("/sugerencias/", response=SugerenciasOut, auth=JWTAuth())
def obtener_sugerencias_inicio(request):
    """Devuelve preguntas frecuentes y diagnósticos rápidos sugeridos para el usuario."""
    user = request.user
    is_estudiante = hasattr(user, "estudiante") and user.estudiante is not None

    if is_estudiante:
        sugerencias = [
            "¿Cuáles son mis calificaciones?",
            "¿Qué materias tengo regularizadas?",
            "¿Por qué no puedo inscribirme a una materia?",
            "¿Cómo tramito una equivalencia?",
            "¿Cómo descargo mi certificado de alumno regular?",
        ]
    else:
        sugerencias = [
            "¿Cómo solicito una mesa de examen?",
            "¿Cuál es el régimen de justificación de inasistencias?",
            "¿Cuándo finaliza el cuatrimestre?",
        ]

    return SugerenciasOut(sugerencias=sugerencias)
