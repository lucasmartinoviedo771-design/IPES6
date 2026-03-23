# Re-export everything from submodules so that existing imports like
# `from .helpers import X` continue to work unchanged.

from apps.estudiantes.api.helpers.user_utils import (
    ADMIN_ALLOWED_ROLES,
    _docente_full_name,
    _format_user_display,
    _user_has_roles,
    _ensure_admin,
    _resolve_estudiante,
    _ensure_estudiante_access,
    _resolve_docente_from_user,
    _user_can_manage_mesa_planilla,
    _user_can_override_planilla_lock,
)

from apps.estudiantes.api.helpers.estudiante_admin import (
    DOCUMENTACION_FIELDS,
    _extract_documentacion,
    _listar_carreras_detalle,
    _apply_estudiante_updates,
    _determine_condicion,
    _build_admin_detail,
)

from apps.estudiantes.api.helpers.actas_utils import (
    _format_nota,
    _format_acta_calificacion,
    _acta_condicion,
)

from apps.estudiantes.api.helpers.horarios_utils import (
    ORDINALES,
    _normalizar_regimen,
    _format_time,
    _anio_plan_label,
    _anio_regular_label,
    _construir_tablas_horario,
)

from apps.estudiantes.api.helpers.misc_utils import (
    _es_materia_edi,
    _metadata_str,
    _add_years,
    _calcular_vigencia_regularidad,
    _to_iso,
    _parse_optional_date,
    _correlatividades_qs,
)

__all__ = [
    # user_utils
    "ADMIN_ALLOWED_ROLES",
    "_docente_full_name",
    "_format_user_display",
    "_user_has_roles",
    "_ensure_admin",
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
]
