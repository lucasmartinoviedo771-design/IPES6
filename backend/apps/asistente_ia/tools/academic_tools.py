"""Herramientas de consulta académica (solo lectura) del estudiante autenticado."""

import logging

from core.models import (
    ActaExamenEstudiante,
    Estudiante,
    InscripcionMateriaEstudiante,
    Regularidad,
)

logger = logging.getLogger(__name__)

# Nota mínima de aprobación según el Régimen Académico (Art. 45°.j, Art. 53°).
NOTA_APROBACION = 6

# Códigos que representan una aprobación sin nota numérica.
APROBACIONES_NO_NUMERICAS = {"APR", "EQUI", "APROBADO", "PROM", "PROMOCIONADO"}

# Los códigos internos ("AI", "AJ") no significan nada para un estudiante, y
# mostrarlos como si fueran la nota hacía leer "tu nota es AI". Se traducen.
_ETIQUETAS = {
    "AI": ("Ausente", "Ausente sin justificar", "Ausente (injustificado)"),
    "AJ": ("Ausente", "Ausente con justificación", "Ausente (justificado)"),
    "APR": ("Aprobado", "Aprobado", "Aprobado"),
    "PROM": ("Promocionado", "Promocionado", "Aprobado por promoción"),
    "EQUI": ("Equivalencia", "Otorgada por equivalencia", "Aprobado por equivalencia"),
}


def _es_aprobacion(numerica, codigo: str) -> bool:
    """
    Decide si el registro está aprobado.

    La nota puede venir en `calificacion_numerica` o solo como texto en
    `calificacion_definitiva` ("6", "10"). Mirando únicamente el campo numérico,
    esas actas quedaban como desaprobadas aunque la nota fuera 10.
    """
    if numerica is not None:
        try:
            return float(numerica) >= NOTA_APROBACION
        except (TypeError, ValueError):
            pass
    if codigo in APROBACIONES_NO_NUMERICAS:
        return True
    try:
        return float(str(codigo).replace(",", ".")) >= NOTA_APROBACION
    except (TypeError, ValueError):
        return False


def _nota_legible(valor, codigo: str):
    """La nota tal como debe leerla el estudiante; los códigos se traducen."""
    if codigo in _ETIQUETAS:
        return _ETIQUETAS[codigo][0]
    return valor


def _condicion_legible(codigo: str) -> str:
    if codigo in _ETIQUETAS:
        return _ETIQUETAS[codigo][1]
    return codigo or "-"


def _resultado_legible(codigo: str) -> str:
    """Ausente y desaprobado no son lo mismo: mezclarlos confunde al estudiante."""
    if codigo in _ETIQUETAS:
        return _ETIQUETAS[codigo][2]
    return "Desaprobado"


def consultar_mis_calificaciones(user) -> dict:
    """Devuelve las calificaciones registradas en actas oficiales y mesas del estudiante autenticado."""
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return {"error": "Solo disponible para estudiantes."}

    historial = []
    materias_vistas = set()

    # 1. Actas de Examen Oficiales
    actas = (
        ActaExamenEstudiante.objects.filter(dni=estudiante.dni)
        .select_related("acta__materia")
        .order_by("-acta__fecha")[:20]
    )

    for reg in actas:
        acta = reg.acta
        materia_nom = acta.materia.nombre if acta and acta.materia else "Materia"
        fecha_str = acta.fecha.strftime("%d/%m/%Y") if acta and acta.fecha else "-"
        nota_val = reg.calificacion_numerica if reg.calificacion_numerica is not None else reg.calificacion_definitiva
        codigo = str(reg.calificacion_definitiva or "").upper()

        # El Régimen Académico aprueba con SEIS (Art. 45°.j y Art. 53°), no con
        # cuatro. Con el umbral anterior el asistente informaba como aprobadas
        # 1015 actas con nota 4 o 5, de 473 estudiantes. El resto del sistema ya
        # usaba 6; solo esta herramienta estaba desalineada.
        es_aprobado = _es_aprobacion(reg.calificacion_numerica, codigo)

        historial.append(
            {
                "materia": materia_nom,
                "fecha": fecha_str,
                "nota": _nota_legible(nota_val, codigo),
                "condicion": _condicion_legible(codigo),
                "resultado": "Aprobado" if es_aprobado else _resultado_legible(codigo),
                "libro": acta.libro if acta else "-",
                "folio": acta.folio if acta else "-",
            }
        )
        materias_vistas.add(materia_nom)

    # 2. Inscripciones a Mesas de Examen con nota
    from core.models import InscripcionMesa

    inscripciones_mesas = (
        InscripcionMesa.objects.filter(estudiante=estudiante, nota__isnull=False)
        .select_related("mesa__materia")
        .order_by("-mesa__fecha")[:15]
    )

    for im in inscripciones_mesas:
        if im.mesa and im.mesa.materia:
            m_nom = im.mesa.materia.nombre
            if m_nom not in materias_vistas:
                historial.append(
                    {
                        "materia": m_nom,
                        "fecha": im.mesa.fecha.strftime("%d/%m/%Y") if im.mesa.fecha else "-",
                        "nota": float(im.nota),
                        "condicion": im.condicion,
                        # Mismo criterio que las actas: se aprueba con 6.
                        "resultado": "Aprobado" if float(im.nota) >= NOTA_APROBACION else "Desaprobado",
                        "libro": im.libro or "-",
                        "folio": im.folio or "-",
                    }
                )
                materias_vistas.add(m_nom)

    # 3. Promociones directas en Regularidad
    promociones = Regularidad.objects.filter(
        estudiante=estudiante,
        situacion__in=[
            Regularidad.Situacion.PROMOCIONADO,
            Regularidad.Situacion.APROBADO,
        ],
    ).select_related("materia")

    for p in promociones:
        m_nom = p.materia.nombre
        if m_nom not in materias_vistas:
            historial.append(
                {
                    "materia": m_nom,
                    # Regularidad no tiene anio_cursada ni nota_final: el año vive
                    # en la materia y la nota de cursada es nota_final_cursada.
                    # Con los nombres viejos la consulta de calificaciones
                    # reventaba y el asistente respondía el mensaje de contingencia.
                    "fecha": p.fecha_cierre.strftime("%d/%m/%Y")
                    if p.fecha_cierre
                    else f"{p.materia.anio_cursada}º año",
                    "nota": float(p.nota_final_cursada) if p.nota_final_cursada is not None else "Acreditada",
                    "condicion": p.situacion,
                    "resultado": "Aprobada por Promoción",
                    "libro": "-",
                    "folio": "-",
                }
            )
            materias_vistas.add(m_nom)

    # 4. Equivalencias aprobadas
    from core.models import EquivalenciaDisposicionDetalle

    equivs = EquivalenciaDisposicionDetalle.objects.filter(
        disposicion__estudiante=estudiante,
        en_resguardo=False,
    ).select_related("materia", "disposicion")

    for eq in equivs:
        m_nom = eq.materia.nombre
        if m_nom not in materias_vistas:
            historial.append(
                {
                    "materia": m_nom,
                    "fecha": eq.disposicion.fecha_disposicion.strftime("%d/%m/%Y")
                    if eq.disposicion and eq.disposicion.fecha_disposicion
                    else "Disposición",
                    "nota": eq.nota or "Acreditada",
                    "condicion": "EQUIV",
                    "resultado": "Aprobada por Equivalencia",
                    "libro": "-",
                    "folio": "-",
                }
            )
            materias_vistas.add(m_nom)

    return {
        "estudiante": f"{estudiante.nombre} {estudiante.apellido}",
        "total_registros": len(historial),
        "calificaciones": historial,
    }


def consultar_mis_regularidades(user) -> dict:
    """Devuelve las materias que el estudiante tiene en condición Regular."""
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return {"error": "Solo disponible para estudiantes."}

    regulares = (
        Regularidad.objects.filter(
            estudiante=estudiante,
            situacion=Regularidad.Situacion.REGULAR,
            en_resguardo=False,
        )
        .select_related("materia__plan_de_estudio")
        # El año de cursada y el régimen viven en la materia, no en la
        # regularidad: ordenar o leerlos desde Regularidad rompe la consulta.
        .order_by("-materia__anio_cursada", "materia__nombre")
    )

    lista = []
    for r in regulares:
        lista.append(
            {
                "materia": r.materia.nombre,
                "id": r.materia.id,
                "anio_cursada": r.materia.anio_cursada,
                "regimen": r.materia.regimen,
                "estado": "Regular vigente",
            }
        )

    return {
        "estudiante": f"{estudiante.nombre} {estudiante.apellido}",
        "total_regularidades": len(lista),
        "materias_regulares": lista,
    }


def consultar_materias_cursando(user) -> dict:
    """Devuelve las comisiones y materias en las que el estudiante se encuentra inscripto cursando actualmente."""
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return {"error": "Solo disponible para estudiantes."}

    inscripciones = (
        InscripcionMateriaEstudiante.objects.filter(
            estudiante=estudiante,
            estado="CONFIRMADA",
        )
        .select_related("comision__materia", "comision__docente")
        .order_by("-comision__anio_lectivo")
    )

    cursando = []
    for i in inscripciones:
        com = i.comision
        cursando.append(
            {
                "materia": com.materia.nombre,
                "comision": com.codigo,
                "ciclo_lectivo": com.anio_lectivo,
                "cuatrimestre": com.cuatrimestre,
                "docente": str(com.docente) if com.docente else "A designar",
            }
        )

    return {
        "estudiante": f"{estudiante.nombre} {estudiante.apellido}",
        "total_cursadas": len(cursando),
        "cursadas_activas": cursando,
    }


def consultar_calendario_academico(consulta: str = "") -> dict:
    """
    Devuelve las fechas oficiales del calendario institucional:
    inicio y fin de cada cuatrimestre, mesas de examen extraordinarias/ordinarias,
    inscripciones habilitadas y feriados/recesos programados.
    """
    from datetime import date

    from apps.asistencia.models import CalendarioAsistenciaEvento
    from core.models import VentanaHabilitacion

    hoy = date.today()

    # 1. Cuatrimestres oficiales (CALENDARIO_CUATRIMESTRE)
    cuatris_qs = VentanaHabilitacion.objects.filter(tipo=VentanaHabilitacion.Tipo.CALENDARIO_CUATRIMESTRE).order_by(
        "desde"
    )

    cuatrimestres = []
    cuatrimestre_en_curso = None
    for c in cuatris_qs:
        en_curso = c.desde <= hoy <= c.hasta
        nombre_periodo = (
            "Primer Cuatrimestre (1C)"
            if c.periodo == "1C"
            else "Segundo Cuatrimestre (2C)"
            if c.periodo == "2C"
            else (c.periodo or "Cuatrimestre")
        )
        c_info = {
            "periodo": c.periodo or "Cuatrimestre",
            "nombre": nombre_periodo,
            "inicio": c.desde.strftime("%d/%m/%Y"),
            "fin": c.hasta.strftime("%d/%m/%Y"),
            "en_curso": en_curso,
            "finalizado": hoy > c.hasta,
            "activo": c.activo,
        }
        cuatrimestres.append(c_info)
        if en_curso:
            cuatrimestre_en_curso = c_info

    # 2. Ventanas de inscripción y mesas próximas o activas
    ventanas_qs = (
        VentanaHabilitacion.objects.filter(hasta__gte=hoy)
        .exclude(tipo=VentanaHabilitacion.Tipo.CALENDARIO_CUATRIMESTRE)
        .order_by("desde")[:6]
    )

    fechas_importantes = []
    for v in ventanas_qs:
        fechas_importantes.append(
            {
                "evento": v.get_tipo_display() if hasattr(v, "get_tipo_display") else v.tipo,
                "periodo": v.periodo or "",
                "desde": v.desde.strftime("%d/%m/%Y"),
                "hasta": v.hasta.strftime("%d/%m/%Y"),
                "activo_ahora": v.activo and v.desde <= hoy <= v.hasta,
            }
        )

    # 3. Feriados y recesos próximos
    eventos_qs = CalendarioAsistenciaEvento.objects.filter(
        activo=True,
        fecha_hasta__gte=hoy,
    ).order_by("fecha_desde")[:4]

    recesos = []
    for ev in eventos_qs:
        recesos.append(
            {
                "nombre": ev.nombre,
                "tipo": ev.get_tipo_display(),
                "desde": ev.fecha_desde.strftime("%d/%m/%Y"),
                "hasta": ev.fecha_hasta.strftime("%d/%m/%Y"),
            }
        )

    return {
        "fecha_consulta": hoy.strftime("%d/%m/%Y"),
        "cuatrimestre_en_curso": cuatrimestre_en_curso,
        "cuatrimestres": cuatrimestres,
        "ventanas_habilitadas": fechas_importantes,
        "recesos_feriados": recesos,
    }


def derivar_consulta_a_bedel(user, consulta: str, enviar_ahora: bool = True) -> dict:
    """
    Identifica al bedel asignado a la carrera/profesorado del estudiante y,
    si enviar_ahora es True, genera un mensaje o ticket formal en la plataforma.
    Si enviar_ahora es False, devuelve los datos del Bedel para consultar al estudiante.
    """
    from apps.estudiantes.services.notificaciones_service import NotificacionesService
    from core.models.horarios import StaffAsignacion

    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return {
            "exito": False,
            "mensaje": "La derivación a Bedelía está disponible para estudiantes matriculados en una carrera.",
        }

    carreras = list(estudiante.carreras.all())
    carrera = carreras[0] if carreras else None
    carrera_nombre = carrera.nombre if carrera else "Carrera General"

    # Buscar bedel asignado a ese profesorado
    bedel_asig = None
    if carrera:
        bedel_asig = (
            StaffAsignacion.objects.filter(profesorado=carrera, rol=StaffAsignacion.Rol.BEDEL)
            .select_related("user")
            .first()
        )

    # Si no tiene asignado específico, buscar cualquier bedel del instituto
    if not bedel_asig:
        bedel_asig = StaffAsignacion.objects.filter(rol=StaffAsignacion.Rol.BEDEL).select_related("user").first()

    if not bedel_asig or not bedel_asig.user:
        return {
            "exito": False,
            "carrera": carrera_nombre,
            "mensaje": (
                f"No se encontró un Bedel asignado en el sistema para {carrera_nombre}. "
                f"Por favor acercate presencialmente a Bedelía o Secretaría en el horario habitual de atención."
            ),
        }

    bedel_user = bedel_asig.user
    nombre_bedel = bedel_user.get_full_name() or bedel_user.username

    if not enviar_ahora:
        return {
            "exito": True,
            "enviado": False,
            "bedel": nombre_bedel,
            "carrera": carrera_nombre,
            "mensaje": (
                f"El/la Bedel a cargo de **{carrera_nombre}** es **{nombre_bedel}**.\n"
                f"¿Querés que le envíe formalmente un mensaje interno con tu consulta?"
            ),
        }

    # Enviar notificación interna
    nombre_estudiante = user.get_full_name() or user.username
    asunto = f"Consulta de {nombre_estudiante} (Derivada por Asistente IA)"
    cuerpo = (
        f"Estimado/a Bedel ({nombre_bedel}):\n\n"
        f"El/la estudiante {nombre_estudiante} (DNI: {user.username}, {carrera_nombre}) "
        f"realizó una consulta a través del Asistente Virtual que requiere intervención o "
        f"respuesta formal de Bedelía al no encontrarse en la reglamentación digitalizada:\n\n"
        f"📝 **Consulta del estudiante:**\n"
        f"«{consulta.strip()}»\n\n"
        f"Podés responderle directamente a este mensaje interno desde tu bandeja de entrada."
    )

    try:
        conv = NotificacionesService.enviar_notificacion(
            receptor=bedel_user,
            asunto=asunto,
            cuerpo=cuerpo,
            topic_name="Consultas Bedelía",
            sender=user,
        )
        return {
            "exito": True,
            "enviado": True,
            "bedel": nombre_bedel,
            "carrera": carrera_nombre,
            "conversation_id": getattr(conv, "id", None),
            "mensaje": (
                f"📬 **Consulta enviada a tu Bedelía con éxito**\n\n"
                f"Derivé formalmente tu inquietud a tu Bedel (**{nombre_bedel}**, {carrera_nombre}).\n"
                f"Vas a recibir su respuesta directamente en tu bandeja de **Mensajes** de Autogestión."
            ),
        }
    except Exception:
        return {
            "exito": False,
            "bedel": nombre_bedel,
            "carrera": carrera_nombre,
            "mensaje": (
                f"No se pudo despachar el mensaje automático en este momento. "
                f"Podés escribirle directamente a tu Bedel (**{nombre_bedel}**) desde tu sección **Mensajes**."
            ),
        }
