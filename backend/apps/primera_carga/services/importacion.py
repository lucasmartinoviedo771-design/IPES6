from __future__ import annotations
import csv
import io
from datetime import date
from django.db import transaction
from django.contrib.auth.models import Group, User
from django.core.management.base import CommandError

from core.models import (
    Docente,
    EquivalenciaCurricular,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    PlanillaRegularidadDocente,
    Preinscripcion,
    PreinscripcionChecklist,
    Profesorado,
    Regularidad,
    RegularidadPlantilla,
    SystemLog,
)
from .utils import (
    _to_bool,
    _parse_date,
    _normalize_header,
    _normalize_value,
    _normalize_label,
    _get_profesorado_from_cache,
    _atomic_rollback,
    _normalize_estado_legajo,
)
from .planillas import crear_planilla_regularidad

REQUIRED_COLUMNS_ESTUDIANTES = {
    "DNI", "apellido", "nombre", "email", "password_plane", "must_change_password",
    "is_active", "fecha_nacimiento", "teléfono", "domicilio", "estado_legajo",
    "carreras", "anio_ingreso", "genero", "Cuil", "rol_extra",
}

REQUIRED_COLUMNS_FOLIOS_FINALES = {
    "DNI", "Materia", "Tipo Mesa", "Modalidad Mesa", "Fecha Mesa", "Folio", "Libro",
}

REQUIRED_COLUMNS_EQUIVALENCIAS = {
    "Codigo Equivalencia", "Nombre Equivalencia", "Materia", "Año Cursada", "Plan de Estudio Resolucion",
}

def _import_estudiante_record(
    record: dict,
    *,
    profesorado: Profesorado,
    estudiante_group: Group,
) -> tuple[Estudiante, bool]:
    dni = (record.get("dni") or record.get("DNI") or "").strip()
    if not dni:
        raise ValueError("El DNI es obligatorio.")

    first_name = (record.get("nombre") or record.get("first_name") or "").strip()
    last_name = (record.get("apellido") or record.get("last_name") or "").strip()
    email = (record.get("email") or "").strip()
    password = (record.get("password_plane") or record.get("password") or "").strip()

    is_active = _to_bool(str(record.get("is_active"))) if record.get("is_active") not in (None, "") else True
    must_change = _to_bool(str(record.get("must_change_password"))) if record.get("must_change_password") not in (None, "") else True

    raw_fecha = record.get("fecha_nacimiento") or record.get("fecha_nac")
    fecha_nacimiento = raw_fecha if isinstance(raw_fecha, date) else (_parse_date(str(raw_fecha)) if raw_fecha else None)

    from core.models import Persona
    persona, _ = Persona.objects.update_or_create(
        dni=dni,
        defaults={
            "nombre": first_name,
            "apellido": last_name,
            "email": email,
            "telefono": (record.get("telefono") or record.get("teléfono") or "").strip(),
            "domicilio": (record.get("domicilio") or "").strip(),
            "fecha_nacimiento": fecha_nacimiento,
            "genero": (record.get("genero") or "").strip(),
            "cuil": (record.get("cuil") or record.get("Cuil") or "").strip(),
        }
    )

    user = User.objects.filter(username=dni).first() or User.objects.filter(email=email).first() if email else None
    user_created = False
    if not user:
        user = User.objects.create_user(username=dni, email=email, password=password or dni)
        user_created = True
    
    user.first_name = first_name
    user.last_name = last_name
    user.is_active = is_active
    user.save()
    user.groups.add(estudiante_group)

    estudiante, student_created = Estudiante.objects.get_or_create(
        persona=persona,
        defaults={
            "user": user,
            "estado_legajo": _normalize_estado_legajo(record.get("estado_legajo")),
            "observaciones": (record.get("observaciones") or "").strip(),
            "legajo": (record.get("legajo") or "").strip(),
            "must_change_password": must_change,
        }
    )
    if not student_created:
        estudiante.user = user
        if record.get("estado_legajo") is not None:
            estudiante.estado_legajo = _normalize_estado_legajo(record.get("estado_legajo"))
        estudiante.save()

    anio_ingreso_str = (record.get("anio_ingreso") or "").strip()
    cohorte_str = (record.get("cohorte") or "").strip()
    try:
        anio_ingreso_int = int(anio_ingreso_str) if anio_ingreso_str else date.today().year
    except ValueError:
        anio_ingreso_int = date.today().year

    estudiante.asignar_profesorado(profesorado, anio_ingreso=anio_ingreso_int, cohorte=cohorte_str)

    pre, pre_created = Preinscripcion.objects.get_or_create(
        alumno=estudiante,
        carrera=profesorado,
        anio=anio_ingreso_int,
        defaults={
            "estado": "finalizada",
            "activa": True,
            "codigo": f"PRE-{anio_ingreso_int}-{estudiante.id:04d}",
        }
    )
    if pre_created:
        PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)

    return estudiante, student_created

def process_estudiantes_csv(file_content: str, dry_run: bool = False) -> dict:
    processed_count = 0
    skipped_count = 0
    errors = []
    f = io.StringIO(file_content)
    reader = csv.DictReader(f, delimiter=";")
    headers = [_normalize_header(h) for h in reader.fieldnames or []]
    normalized_headers = {_normalize_label(h) for h in headers}
    missing = {orig for orig in REQUIRED_COLUMNS_ESTUDIANTES if _normalize_label(orig) not in normalized_headers}
    if missing:
        return {"ok": False, "errors": [f"Faltan columnas: {', '.join(sorted(missing))}"]}

    estudiante_group, _ = Group.objects.get_or_create(name="estudiante")
    carreras_cache = {}
    atomic_context = transaction.atomic if not dry_run else _atomic_rollback
    with atomic_context():
        for idx, raw_row in enumerate(reader, start=2):
            try:
                normalized_row = {_normalize_header(k): _normalize_value(v) for k, v in raw_row.items()}
                dni = normalized_row.get("DNI", "").strip()
                if not dni:
                    skipped_count += 1
                    errors.append(f"[Fila {idx}] Sin DNI.")
                    continue
                carrera_nombre = normalized_row.get("carreras", "").strip()
                profesorado = carreras_cache.get(carrera_nombre) or _get_profesorado_from_cache(carreras_cache, carrera_nombre)
                _import_estudiante_record(normalized_row, profesorado=profesorado, estudiante_group=estudiante_group)
                processed_count += 1
            except Exception as e:
                skipped_count += 1
                errors.append(f"[Fila {idx}] Error: {e}")
    if errors and not dry_run:
        SystemLog.objects.create(tipo="IMPORT_ERROR", mensaje=f"Error estudiantes CSV ({len(errors)})", metadata={"errors": errors[:20]})
    return {"ok": not bool(errors), "processed": processed_count, "skipped": skipped_count, "errors": errors}

def crear_estudiante_manual(*, user: User, data: dict) -> dict:
    estudiante_group, _ = Group.objects.get_or_create(name="estudiante")
    profesorado = Profesorado.objects.get(pk=data["profesorado_id"])
    with transaction.atomic():
        estudiante, created = _import_estudiante_record(data, profesorado=profesorado, estudiante_group=estudiante_group)
    return {"estudiante_id": estudiante.id, "dni": estudiante.dni, "nombre": estudiante.user.get_full_name(), "created": created}

def process_folios_finales_csv(file_content: str, dry_run: bool = False) -> dict:
    processed_count = 0
    skipped_count = 0
    errors = []
    f = io.StringIO(file_content)
    reader = csv.DictReader(f, delimiter=";")
    headers = [_normalize_header(h) for h in reader.fieldnames or []]
    missing = REQUIRED_COLUMNS_FOLIOS_FINALES - set(headers)
    if missing: return {"ok": False, "errors": [f"Faltan columnas: {', '.join(sorted(missing))}"]}
    atomic_context = transaction.atomic if not dry_run else _atomic_rollback
    with atomic_context():
        for idx, raw_row in enumerate(reader, start=2):
            try:
                norm = {_normalize_header(k): _normalize_value(v) for k, v in raw_row.items()}
                dni = norm.get("DNI", "").strip()
                estudiante = Estudiante.objects.filter(persona__dni=dni).first()
                if not estudiante: raise ValueError(f"Estudiante {dni} no encontrado.")
                materia = Materia.objects.filter(nombre=norm.get("Materia")).first()
                mesa = MesaExamen.objects.filter(materia=materia, tipo=norm.get("Tipo Mesa"), modalidad=norm.get("Modalidad Mesa"), fecha=_parse_date(norm.get("Fecha Mesa"))).first()
                insc = InscripcionMesa.objects.filter(estudiante=estudiante, mesa=mesa).first()
                if not insc: raise ValueError("Inscripción no encontrada.")
                insc.folio, insc.libro = norm.get("Folio"), norm.get("Libro")
                insc.save()
                processed_count += 1
            except Exception as e:
                skipped_count += 1
                errors.append(f"[Fila {idx}] Error: {e}")
    return {"ok": not bool(errors), "processed": processed_count, "skipped": skipped_count, "errors": errors}

def process_equivalencias_csv(file_content: str, dry_run: bool = False) -> dict:
    processed_count = 0
    skipped_count = 0
    errors = []
    f = io.StringIO(file_content)
    reader = csv.DictReader(f, delimiter=";")
    headers = [_normalize_header(h) for h in reader.fieldnames or []]
    missing = REQUIRED_COLUMNS_EQUIVALENCIAS - set(headers)
    if missing: return {"ok": False, "errors": [f"Faltan columnas: {', '.join(sorted(missing))}"]}
    atomic_context = transaction.atomic if not dry_run else _atomic_rollback
    with atomic_context():
        for idx, raw_row in enumerate(reader, start=2):
            try:
                norm = {_normalize_header(k): _normalize_value(v) for k, v in raw_row.items()}
                plan = PlanDeEstudio.objects.get(resolucion=norm.get("Plan de Estudio Resolucion"))
                materia = Materia.objects.get(nombre=norm.get("Materia"), anio_cursada=int(norm.get("Año Cursada")), plan_de_estudio=plan)
                equi, _ = EquivalenciaCurricular.objects.get_or_create(codigo=norm.get("Codigo Equivalencia"), defaults={"nombre": norm.get("Nombre Equivalencia") or norm.get("Codigo Equivalencia")})
                equi.materias.add(materia)
                processed_count += 1
            except Exception as e:
                skipped_count += 1
                errors.append(f"[Fila {idx}] Error: {e}")
    return {"ok": not bool(errors), "processed": processed_count, "skipped": skipped_count, "errors": errors}

def registrar_regularidad_individual_historica(user: User, data: dict) -> dict:
    dni = data["dni"]
    estudiante = Estudiante.objects.filter(persona__dni=dni).first()
    if not estudiante: raise ValueError(f"Estudiante {dni} no encontrado.")
    materia = Materia.objects.get(pk=data["materia_id"])
    # Mapeo de formato de materia (ASI, MOD, TAL, PRA, etc.) a slug de RegularidadFormato
    formato_map = {
        "ASI": "asignatura",
        "MOD": "modulo",
        "TAL": "taller",
        "PRA": "taller", # Prácticas usan el formato taller habitualmente
        "LAB": "taller",
        "SEM": "taller",
    }
    slug_formato = formato_map.get(materia.formato, (materia.formato or "").lower())
    dictado_val = data.get("dictado", "ANUAL")
    plantilla = RegularidadPlantilla.objects.filter(formato__slug=slug_formato, dictado=dictado_val).first()
    if not plantilla:
        # Fallback a la primera plantilla de ese formato si no hay coincidencia exacta
        plantilla = RegularidadPlantilla.objects.filter(formato__slug=slug_formato).first()
        if plantilla:
            dictado_val = plantilla.dictado  # Forzamos el dictado de la plantilla para evitar error de mismatch
    
    if not plantilla:
        raise ValueError(f"No existe ninguna plantilla configurada para el formato '{materia.formato}' ({slug_formato}).")
    
    docente_id = data.get("docente_id")
    docente_nombre = data.get("docente_nombre")
    if docente_id or docente_nombre:
        docentes = [{
            "docente_id": docente_id,
            "nombre": docente_nombre or "",
            "rol": "profesor",
            "orden": 1
        }]
    else:
        docentes = [{"nombre": "SISTEMA (Carga Histórica)", "rol": "profesor", "orden": 1}]
    filas = [{
        "orden": 1, "dni": dni, "apellido_nombre": f"{estudiante.user.last_name}, {estudiante.user.first_name}",
        "nota_final": data.get("nota_final"), "asistencia": data.get("asistencia"),
        "situacion": data["situacion"], "excepcion": data.get("excepcion", False),
        "observaciones": data.get("observaciones", "Carga histórica"), "datos": {}
    }]
    return crear_planilla_regularidad(
        user=user, profesorado_id=data["profesorado_id"], materia_id=materia.id,
        plantilla_id=plantilla.id, dictado=dictado_val,
        fecha=_parse_date(data["fecha"]) if isinstance(data["fecha"], str) else data["fecha"],
        folio=data.get("folio", ""), plan_resolucion=materia.plan_de_estudio.resolucion,
        docentes=docentes, filas=filas, force_upgrade=data.get("force_upgrade", False)
    )
