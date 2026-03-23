import copy
from apps.common.date_utils import format_date, format_datetime


def serialize_pre(pre) -> dict:
    a = pre.alumno
    u = getattr(a, "user", None)

    user_first_name = getattr(u, "first_name", "") if u else ""
    user_last_name = getattr(u, "last_name", "") if u else ""
    user_email = getattr(u, "email", "") if u else ""

    extra = copy.deepcopy(pre.datos_extra or {})
    pre_estudiante_extra = extra.get("estudiante") if isinstance(extra.get("estudiante"), dict) else {}
    persisted_estudiante_extra = getattr(a, "datos_extra", {}) or {}

    def ensure_extra(field: str):
        if extra.get(field) not in (None, ""):
            return
        for source in (pre_estudiante_extra, persisted_estudiante_extra):
            if isinstance(source, dict):
                value = source.get(field)
                if value not in (None, ""):
                    extra[field] = value
                    return

    campos_a_bubbling = [
        "nacionalidad", "estado_civil", "genero", "localidad_nac", "provincia_nac", "pais_nac",
        "tel_fijo", "emergencia_telefono", "emergencia_parentesco",
        "sec_titulo", "sec_establecimiento", "sec_fecha_egreso", "sec_localidad", "sec_provincia", "sec_pais",
        "sup1_titulo", "sup1_establecimiento", "sup1_fecha_egreso", "sup1_localidad", "sup1_provincia", "sup1_pais",
        "trabaja", "empleador", "horario_trabajo", "domicilio_trabajo",
        "cud_informado", "condicion_salud_informada", "condicion_salud_detalle",
    ]
    for campo in campos_a_bubbling:
        ensure_extra(campo)

    return {
        "id": pre.id,
        "codigo": pre.codigo,
        "estado": pre.estado.lower() if pre.estado else "enviada",
        "fecha": format_datetime(pre.created_at),
        "estudiante": {
            "dni": getattr(a, "dni", ""),
            "nombre": user_first_name,
            "apellido": user_last_name,
            "email": user_email,
            "telefono": getattr(a, "telefono", ""),
            "domicilio": getattr(a, "domicilio", ""),
            "fecha_nacimiento": format_date(getattr(a, "fecha_nacimiento", None)),
            "cuil": getattr(pre, "cuil", ""),
        },
        "carrera": {"id": pre.carrera_id, "nombre": getattr(pre.carrera, "nombre", "")},
        "datos_extra": extra,
        "created_at": format_datetime(pre.created_at),
    }
