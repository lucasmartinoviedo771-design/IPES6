"""Helpers misceláneos: fechas, vigencia de regularidades, correlatividades, etc."""

from __future__ import annotations

from datetime import date, datetime, time

from apps.common.date_utils import format_date, format_datetime, parse_date
from core.models import (
    Correlatividad,
    CorrelatividadVersion,
    EquivalenciaDisposicionDetalle,
    Estudiante,
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
    - Si el estudiante re-cursó la materia y tiene una regularidad posterior, los intentos
      de este período solo cuentan hasta la fecha de esa nueva regularidad (no se mezclan).
    """
    from datetime import timedelta

    from core.models import ActaExamenEstudiante

    INTENTOS_MAX = 3

    if not regularidad.fecha_cierre:
        from django.utils import timezone

        limite = _add_years(timezone.now().date(), 2)
        return limite, 0, INTENTOS_MAX

    fecha_base = _add_years(regularidad.fecha_cierre, 2)

    # Si existe una regularidad posterior para la misma materia, este período termina ahí.
    # Los intentos posteriores a esa fecha pertenecen al nuevo período.
    prox_reg = (
        Regularidad.objects.filter(
            estudiante=regularidad.estudiante,
            materia=regularidad.materia,
            situacion=Regularidad.Situacion.REGULAR,
            fecha_cierre__gt=regularidad.fecha_cierre,
        )
        .order_by("fecha_cierre")
        .first()
    )
    fecha_tope_superior = prox_reg.fecha_cierre if prox_reg else None

    if fecha_tope_superior:
        # Con regularidad posterior: el período de vigencia termina en la nueva fecha_cierre.
        # No hay prórroga más allá de eso.
        limite_efectivo = min(fecha_base, fecha_tope_superior)
        intentos = ActaExamenEstudiante.objects.filter(
            dni=estudiante.dni,
            acta__materia=regularidad.materia,
            acta__fecha__gt=regularidad.fecha_cierre,
            acta__fecha__lte=fecha_tope_superior,
        ).count()
        intentos_en_periodo = intentos
    else:
        # Sin regularidad posterior: lógica con prórroga.
        # Filtrar mesas por plan_de_estudio_id para no tomar fechas de otra carrera
        # que comparta el mismo objeto Materia.
        limite_60d = fecha_base + timedelta(days=60)
        plan_id = getattr(regularidad.materia, "plan_de_estudio_id", None)
        mesa_qs = MesaExamen.objects.filter(
            materia=regularidad.materia,
            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
            fecha__gt=fecha_base,
        )
        if plan_id:
            mesa_qs = mesa_qs.filter(materia__plan_de_estudio_id=plan_id)
        primer_llamado_post_base = mesa_qs.order_by("fecha").values_list("fecha", flat=True).first()
        limite_prorroga = (
            primer_llamado_post_base
            if primer_llamado_post_base and primer_llamado_post_base < limite_60d
            else limite_60d
        )
        limite_efectivo = limite_prorroga
        intentos = ActaExamenEstudiante.objects.filter(
            dni=estudiante.dni,
            acta__materia=regularidad.materia,
            acta__fecha__gt=regularidad.fecha_cierre,
            acta__fecha__lte=limite_prorroga,
        ).count()
        intentos_en_periodo = ActaExamenEstudiante.objects.filter(
            dni=estudiante.dni,
            acta__materia=regularidad.materia,
            acta__fecha__gt=regularidad.fecha_cierre,
            acta__fecha__lte=fecha_base,
        ).count()

    if intentos_en_periodo >= INTENTOS_MAX:
        return fecha_base if not fecha_tope_superior else limite_efectivo, intentos_en_periodo, INTENTOS_MAX

    return limite_efectivo, intentos, INTENTOS_MAX


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
    _cache: dict[int, bool] | None = None,
    _computing: set[int] | None = None,
) -> bool:
    """
    Retorna True si el estudiante tiene la materia aprobada de forma válida,
    es decir: aprobada por cualquier fuente (Regularidad, Equivalencia, Acta)
    Y sin flag en_resguardo activo.

    Fuentes consideradas (en orden de prioridad):
    1. Regularidad con situacion APROBADO o PROMOCIONADO — re-verifica dinámicamente
       las correlativas APROBADA_PARA_RENDIR aunque el flag en_resguardo sea False.
       Si detecta que una correlativa base caducó, actualiza en_resguardo=True en DB
       (auto-sana el flag sin depender del cron recalcular_resguardo).
    2. EquivalenciaDisposicionDetalle, en_resguardo=False — ídem re-verificación.
    3. ActaExamenEstudiante con calificacion >= 6 (chequeo dinámico de correlativas)

    Parámetros internos (no pasar desde afuera):
    - _cache: dict materia_id → bool, evita re-consultar la misma materia en la
      misma cadena de evaluación (performance).
    - _computing: set de materia_ids que están siendo evaluados en este frame de
      recursión, usado para detectar ciclos en el grafo de correlativas.

    El parámetro `autorizadas_ids` contiene materias con autorización excepcional
    otorgada por secretaría (ignoran el resguardo).
    """
    from core.models import ActaExamenEstudiante

    if autorizadas_ids is None:
        autorizadas_ids = set(estudiante.materias_autorizadas.values_list("id", flat=True))
    if _cache is None:
        _cache = {}
    if _computing is None:
        _computing = set()

    materia_id = materia.id

    # Autorización individual — siempre válida sin importar resguardo
    if materia_id in autorizadas_ids:
        return True

    # Cache hit — resultado ya calculado en esta cadena
    if materia_id in _cache:
        return _cache[materia_id]

    # Ciclo detectado en el grafo de correlativas — asumir válido para no bloquear
    if materia_id in _computing:
        return True

    _computing.add(materia_id)
    try:
        result = _evaluar_aprobacion(estudiante, materia, materia_id, fecha_ref, autorizadas_ids, _cache, _computing)
    finally:
        _computing.discard(materia_id)

    _cache[materia_id] = result
    return result


def _evaluar_aprobacion(
    estudiante: Estudiante,
    materia: Materia,
    materia_id: int,
    fecha_ref: date | None,
    autorizadas_ids: set[int],
    _cache: dict[int, bool],
    _computing: set[int],
) -> bool:
    """Lógica interna de _tiene_aprobacion_valida, separada para claridad."""
    from core.models import ActaExamenEstudiante

    # 1. Regularidad APR/PRO — re-verifica correlativas APROBADA_PARA_RENDIR en tiempo real
    reg = Regularidad.objects.filter(
        estudiante=estudiante,
        materia=materia,
        situacion__in=[Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO],
        en_resguardo=False,
    ).first()

    if reg:
        req_ids = list(
            _correlatividades_qs(
                materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante
            ).values_list("materia_correlativa_id", flat=True)
        )
        correlativas_ok = True
        for req_id in req_ids:
            req_mat = Materia.objects.filter(id=req_id).first()
            if not req_mat:
                continue
            if not _tiene_aprobacion_valida(estudiante, req_mat, fecha_ref, autorizadas_ids, _cache, _computing):
                correlativas_ok = False
                break

        if correlativas_ok:
            return True

        # Correlativa de base caducó → auto-sanar el flag en DB sin esperar el cron
        Regularidad.objects.filter(pk=reg.pk).update(en_resguardo=True)
        # No retornar True — continúa a verificar otras fuentes

    # 2. Equivalencia sin resguardo — re-verifica correlativas en tiempo real
    eq = EquivalenciaDisposicionDetalle.objects.filter(
        disposicion__estudiante=estudiante,
        materia=materia,
        en_resguardo=False,
    ).first()

    if eq:
        req_ids = list(
            _correlatividades_qs(
                materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante
            ).values_list("materia_correlativa_id", flat=True)
        )
        correlativas_ok = True
        for req_id in req_ids:
            req_mat = Materia.objects.filter(id=req_id).first()
            if not req_mat:
                continue
            if not _tiene_aprobacion_valida(estudiante, req_mat, fecha_ref, autorizadas_ids, _cache, _computing):
                correlativas_ok = False
                break

        if correlativas_ok:
            return True

        EquivalenciaDisposicionDetalle.objects.filter(pk=eq.pk).update(en_resguardo=True)

    # 2b. Mesa pandemia aprobada (InscripcionMesa con folio/libro PANDEMIA y condicion APR)

    if InscripcionMesa.objects.filter(
        estudiante=estudiante,
        mesa__materia=materia,
        condicion=InscripcionMesa.Condicion.APROBADO,
        folio="PANDEMIA",
    ).exists():
        return True

    # 3. Acta de examen aprobada — chequeo dinámico de correlativas
    # Incluye notas numéricas >= 6 y las etiquetas textuales APR/EQUI usadas
    # para equivalencias externas y aprobaciones no numéricas.
    _CALIFS_APROBADAS = [str(n) for n in range(6, 11)] + ["APR", "EQUI", "APROBADO", "EQUIVALENCIA"]
    acta_aprobada = (
        ActaExamenEstudiante.objects.filter(
            dni=estudiante.dni,
            acta__materia=materia,
            calificacion_definitiva__in=_CALIFS_APROBADAS,
        )
        .select_related("acta")
        .order_by("acta__fecha")
        .first()
    )

    if acta_aprobada:
        req_ids = list(
            _correlatividades_qs(
                materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante
            ).values_list("materia_correlativa_id", flat=True)
        )
        if not req_ids:
            return True
        for req_id in req_ids:
            req_materia = Materia.objects.filter(id=req_id).first()
            if not req_materia:
                continue
            if not _tiene_aprobacion_valida(estudiante, req_materia, fecha_ref, autorizadas_ids, _cache, _computing):
                return False
        return True

    return False


def _calcular_resguardo_equivalencia(
    estudiante: Estudiante,
    materia: Materia,
    autorizadas_ids: set[int] | None = None,
    situacion: str | None = None,
    _cache: dict[int, bool] | None = None,
) -> bool:
    """
    Determina si una aprobación/equivalencia para `materia` debe quedar en resguardo.
    Retorna True si debe estar en resguardo (correlativas no satisfechas).

    Para APROBADO/PROMOCIONADO también se verifican las correlativas APROBADA_PARA_RENDIR,
    ya que representan un requisito académico que debe mantenerse válido.
    """
    if autorizadas_ids is None:
        autorizadas_ids = set(estudiante.materias_autorizadas.values_list("id", flat=True))
    if _cache is None:
        _cache = {}

    if materia.id in autorizadas_ids:
        return False

    req_apr = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, estudiante).values_list(
            "materia_correlativa_id", flat=True
        )
    )
    req_reg = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, estudiante).values_list(
            "materia_correlativa_id", flat=True
        )
    )

    for req_id in req_apr:
        req_mat = Materia.objects.filter(id=req_id).first()
        if not req_mat:
            continue
        if not _tiene_aprobacion_valida(estudiante, req_mat, autorizadas_ids=autorizadas_ids, _cache=_cache):
            return True

    for req_id in req_reg:
        if req_id in autorizadas_ids:
            continue
        req_mat_obj = Materia.objects.filter(id=req_id).first()
        if _tiene_aprobacion_valida(estudiante, req_mat_obj, autorizadas_ids=autorizadas_ids, _cache=_cache):
            continue
        # Solo evaluar la regularidad más reciente: si la última está vencida/agotada,
        # las anteriores también lo están (son más viejas).
        reg_corr_reciente = (
            Regularidad.objects.filter(
                estudiante=estudiante,
                materia_id=req_id,
                situacion=Regularidad.Situacion.REGULAR,
                en_resguardo=False,
            )
            .order_by("-fecha_cierre")
            .first()
        )
        if not reg_corr_reciente:
            return True
        limite, intentos, max_intentos = _calcular_vigencia_regularidad(estudiante, reg_corr_reciente)
        if date.today() > limite or intentos >= max_intentos:
            return True

    # Para materias APROBADAS o PROMOCIONADAS: verificar también APROBADA_PARA_RENDIR
    es_aprobada = situacion in (
        Regularidad.Situacion.APROBADO,
        Regularidad.Situacion.PROMOCIONADO,
    )
    if es_aprobada:
        req_rendir = list(
            _correlatividades_qs(
                materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante
            ).values_list("materia_correlativa_id", flat=True)
        )
        for req_id in req_rendir:
            req_mat = Materia.objects.filter(id=req_id).first()
            if not req_mat:
                continue
            if not _tiene_aprobacion_valida(estudiante, req_mat, autorizadas_ids=autorizadas_ids, _cache=_cache):
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
