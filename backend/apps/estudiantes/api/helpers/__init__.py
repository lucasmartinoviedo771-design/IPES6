# Re-export everything from submodules so that existing imports like
# `from .helpers import X` continue to work unchanged.

from apps.estudiantes.api.helpers.actas_utils import (
    _acta_condicion,
    _format_acta_calificacion,
    _format_nota,
)
from apps.estudiantes.api.helpers.estudiante_admin import (
    DOCUMENTACION_FIELDS,
    _apply_estudiante_updates,
    _build_admin_detail,
    _determine_condicion,
    _extract_documentacion,
    _listar_carreras_detalle,
    _recalcular_estado_legajo,
)
from apps.estudiantes.api.helpers.horarios_utils import (
    ORDINALES,
    _anio_plan_label,
    _anio_regular_label,
    _construir_tablas_horario,
    _format_time,
    _normalizar_regimen,
)
from apps.estudiantes.api.helpers.misc_utils import (
    _add_years,
    _calcular_resguardo_equivalencia,
    _calcular_vigencia_regularidad,
    _correlatividades_qs,
    _es_materia_edi,
    _metadata_str,
    _parse_optional_date,
    _tiene_aprobacion_valida,
    _to_iso,
)
from apps.estudiantes.api.helpers.user_utils import (
    _docente_full_name,
    _ensure_estudiante_access,
    _format_user_display,
    _resolve_docente_from_user,
    _resolve_estudiante,
    _user_can_manage_mesa_planilla,
    _user_can_override_planilla_lock,
)

__all__ = [
    # user_utils
    "_docente_full_name",
    "_format_user_display",
    "_resolve_estudiante",
    "_ensure_estudiante_access",
    "_resolve_docente_from_user",
    "_user_can_manage_mesa_planilla",
    "_user_can_override_planilla_lock",
    # estudiante_admin
    "DOCUMENTACION_FIELDS",
    "_extract_documentacion",
    "_listar_carreras_detalle",
    "_apply_estudiante_updates",
    "_determine_condicion",
    "_build_admin_detail",
    "_recalcular_estado_legajo",
    # actas_utils
    "_format_nota",
    "_format_acta_calificacion",
    "_acta_condicion",
    # horarios_utils
    "ORDINALES",
    "_normalizar_regimen",
    "_format_time",
    "_anio_plan_label",
    "_anio_regular_label",
    "_construir_tablas_horario",
    # misc_utils
    "_es_materia_edi",
    "_metadata_str",
    "_add_years",
    "_calcular_vigencia_regularidad",
    "_to_iso",
    "_parse_optional_date",
    "_correlatividades_qs",
    "_tiene_aprobacion_valida",
    "_calcular_resguardo_equivalencia",
]
