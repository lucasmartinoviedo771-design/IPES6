"""Helpers misceláneos: fechas, vigencia de regularidades, correlatividades, etc."""

from __future__ import annotations

from datetime import date, datetime, time

from apps.common.date_utils import format_date, format_datetime, parse_date

from core.models import (
    Correlatividad,
    CorrelatividadVersion,
    Estudiante,
    EquivalenciaDisposicionDetalle,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Regularidad,
)


def _es_materia_edi(nombre: str) -> bool:
    valor = (nombre or "").strip().upper()
    return valor.startswith("EDI") or valor.startswith("ESPACIO DE DEFINICION INSTITUCIONAL")


def _metadata_str(data: dict[str, object]) -> dict[str, str]:
    return {key: str(value) for key, value in data.items() if value not in (None, "", [], {})}


def _add_years(base: date | None, years: int) -> date | None:
    if not base:
        return None
    try:
        return base.replace(year=base.year + years)
    except ValueError:
        return base.replace(month=2, day=28, year=base.year + years)


def _calcular_vigencia_regularidad(estudiante: Estudiante, regularidad: Regularidad) -> tuple[date, int, int]:
    """
    Retorna (vigencia_limite, intentos_usados, intentos_max=3).

    Reglas:
    - El alumno tiene 3 intentos en total (incluida la prórroga).
    - Dentro de los 2 años puede usar esos 3 intentos libremente.
    - Si al cumplirse los 2 años le quedan intentos, tiene una prórroga (hasta 60 días
      o el siguiente llamado disponible) para usar los intentos restantes.
    - Si agota los 3 intentos antes de los 2 años: la regularidad cae sin prórroga.
    """
    from datetime import timedelta
    from core.models import MesaExamen, ActaExamenEstudiante

    INTENTOS_MAX = 3

    if not regularidad.fecha_cierre:
        from django.utils import timezone
        limite = _add_years(timezone.now().date(), 2)
        return limite, 0, INTENTOS_MAX

    fecha_base = _add_years(regularidad.fecha_cierre, 2)

    # Límite de la prórroga post-2-años
    limite_60d = fecha_base + timedelta(days=60)
    primer_llamado_post_base = (
        MesaExamen.objects.filter(
            materia=regularidad.materia,
            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
            fecha__gt=fecha_base,
        )
        .order_by("fecha")
        .values_list("fecha", flat=True)
        .first()
    )
    limite_prorroga = (
        primer_llamado_post_base
        if primer_llamado_post_base and primer_llamado_post_base < limite_60d
        else limite_60d
    )

    # Total de intentos usados (período normal + prórroga, todo suma al mismo pool de 3)
    intentos = ActaExamenEstudiante.objects.filter(
        dni=estudiante.dni,
        acta__materia=regularidad.materia,
        acta__fecha__gt=regularidad.fecha_cierre,
        acta__fecha__lte=limite_prorroga,
    ).count()

    # Si agotó los 3 intentos dentro del período normal: no accede a la prórroga
    intentos_en_periodo = ActaExamenEstudiante.objects.filter(
        dni=estudiante.dni,
        acta__materia=regularidad.materia,
        acta__fecha__gt=regularidad.fecha_cierre,
        acta__fecha__lte=fecha_base,
    ).count()
    if intentos_en_periodo >= INTENTOS_MAX:
        return fecha_base, intentos_en_periodo, INTENTOS_MAX

    return limite_prorroga, intentos, INTENTOS_MAX


def _to_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return format_datetime(value)
    if isinstance(value, date):
        return format_date(value)
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return str(value)


def _parse_optional_date(value: str | None):
    return parse_date(value)


def _tiene_aprobacion_valida(
    estudiante: Estudiante,
    materia: Materia,
    fecha_ref: date | None = None,
    autorizadas_ids: set[int] | None = None,
) -> bool:
    """
    Retorna True si el estudiante tiene la materia aprobada de forma válida,
    es decir: aprobada por cualquier fuente (Regularidad, Equivalencia, Acta)
    Y sin flag en_resguardo activo.

    Fuentes consideradas (en orden de prioridad):
    1. Regularidad con situacion APROBADO o PROMOCIONADO, en_resguardo=False
    2. EquivalenciaDisposicionDetalle, en_resguardo=False
    3. ActaExamenEstudiante con calificacion >= 6 (chequeo dinámico de correlativas)

    Para las Actas, como el documento está sellado, el resguardo se evalúa
    dinámicamente: si las correlativas de la materia estaban satisfechas al
    momento de rendir, la aprobación es válida.

    El parámetro `autorizadas_ids` contiene materias con autorización excepcional
    otorgada por secretaría (ignoran el resguardo).
    """
    from datetime import timedelta
    from core.models import ActaExamenEstudiante

    if autorizadas_ids is None:
        autorizadas_ids = set(estudiante.materias_autorizadas.values_list("id", flat=True))

    materia_id = materia.id

    # Autorización individual — siempre válida sin importar resguardo
    if materia_id in autorizadas_ids:
        return True

    # 1. Regularidad APR/PRO sin resguardo
    if Regularidad.objects.filter(
        estudiante=estudiante,
        materia=materia,
        situacion__in=[Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO],
        en_resguardo=False,
    ).exists():
        return True

    # 2. Equivalencia sin resguardo
    if EquivalenciaDisposicionDetalle.objects.filter(
        disposicion__estudiante=estudiante,
        materia=materia,
        en_resguardo=False,
    ).exists():
        return True

    # 2b. Mesa pandemia aprobada (InscripcionMesa con folio/libro PANDEMIA y condicion APR)
    from core.models import InscripcionMesa
    if InscripcionMesa.objects.filter(
        estudiante=estudiante,
        mesa__materia=materia,
        condicion=InscripcionMesa.Condicion.APROBADO,
        folio="PANDEMIA",
    ).exists():
        return True

    # 3. Acta de examen aprobada — chequeo dinámico de correlativas
    from apps.estudiantes.api.helpers.misc_utils import _correlatividades_qs
    acta_aprobada = ActaExamenEstudiante.objects.filter(
        dni=estudiante.dni,
        acta__materia=materia,
        calificacion_definitiva__in=[str(n) for n in range(6, 11)],
    ).select_related("acta").order_by("acta__fecha").first()

    if acta_aprobada:
        # Verificar que las correlativas necesarias estaban satisfechas
        # (las APROBADA_PARA_RENDIR son las que se exigen para rendir el final)
        req_ids = list(
            _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante)
            .values_list("materia_correlativa_id", flat=True)
        )
        if not req_ids:
            return True  # no tiene correlativas exigidas, la aprobación es válida
        # Cada correlativa requerida debe tener aprobación válida
        for req_id in req_ids:
            req_materia = Materia.objects.filter(id=req_id).first()
            if not req_materia:
                continue
            if not _tiene_aprobacion_valida(estudiante, req_materia, fecha_ref, autorizadas_ids):
                return False  # correlativa sin aprobación válida → acta queda en resguardo dinámico
        return True

    return False


def _calcular_resguardo_equivalencia(
    estudiante: Estudiante,
    materia: Materia,
    autorizadas_ids: set[int] | None = None,
    situacion: str | None = None,
) -> bool:
    """
    Determina si una aprobación/equivalencia para `materia` debe quedar en resguardo.
    Retorna True si debe estar en resguardo (correlativas no satisfechas).

    Para APROBADO/PROMOCIONADO también se verifican las correlativas APROBADA_PARA_RENDIR,
    ya que representan un requisito académico que debe mantenerse válido.
    """
    if autorizadas_ids is None:
        autorizadas_ids = set(estudiante.materias_autorizadas.values_list("id", flat=True))

    if materia.id in autorizadas_ids:
        return False

    req_apr = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, estudiante)
        .values_list("materia_correlativa_id", flat=True)
    )
    req_reg = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, estudiante)
        .values_list("materia_correlativa_id", flat=True)
    )

    for req_id in req_apr:
        req_mat = Materia.objects.filter(id=req_id).first()
        if not req_mat:
            continue
        if not _tiene_aprobacion_valida(estudiante, req_mat, autorizadas_ids=autorizadas_ids):
            return True

    for req_id in req_reg:
        if req_id in autorizadas_ids:
            continue
        req_mat_obj = Materia.objects.filter(id=req_id).first()
        if _tiene_aprobacion_valida(estudiante, req_mat_obj, autorizadas_ids=autorizadas_ids):
            continue
        reg_vigente = False
        for reg_corr in Regularidad.objects.filter(
            estudiante=estudiante,
            materia_id=req_id,
            situacion=Regularidad.Situacion.REGULAR,
            en_resguardo=False,
        ):
            limite, intentos, max_intentos = _calcular_vigencia_regularidad(estudiante, reg_corr)
            hoy = date.today()
            if hoy <= limite and intentos < max_intentos:
                reg_vigente = True
                break
        if not reg_vigente:
            return True

    # Para materias APROBADAS o PROMOCIONADAS: verificar también APROBADA_PARA_RENDIR
    es_aprobada = situacion in (
        Regularidad.Situacion.APROBADO,
        Regularidad.Situacion.PROMOCIONADO,
    )
    if es_aprobada:
        req_rendir = list(
            _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante)
            .values_list("materia_correlativa_id", flat=True)
        )
        for req_id in req_rendir:
            req_mat = Materia.objects.filter(id=req_id).first()
            if not req_mat:
                continue
            if not _tiene_aprobacion_valida(estudiante, req_mat, autorizadas_ids=autorizadas_ids):
                return True

    return False


def _correlatividades_qs(
    materia: Materia,
    tipo: str,
    estudiante: Estudiante | None = None,
):
    qs = Correlatividad.objects.filter(materia_origen=materia, tipo=tipo)
    if not estudiante or not materia.plan_de_estudio_id:
        return qs
    profesorado_id = getattr(materia.plan_de_estudio, "profesorado_id", None)
    if not profesorado_id:
        return qs
    cohorte = estudiante.obtener_anio_ingreso(profesorado_id)
    version = CorrelatividadVersion.vigente_para(
        plan_id=materia.plan_de_estudio_id,
        profesorado_id=profesorado_id,
        cohorte=cohorte,
    )
    if version:
        return qs.filter(versiones__version=version)
    return qs
