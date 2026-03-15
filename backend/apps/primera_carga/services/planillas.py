from __future__ import annotations
import math
from datetime import date
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from django.db import transaction
from django.core.files.base import ContentFile
from django.contrib.auth.models import User

from core.models import (
    Docente,
    Estudiante,
    InscripcionMateriaEstudiante,
    Materia,
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    PlanillaRegularidadHistorial,
    Profesorado,
    Regularidad,
    RegularidadPlantilla,
)
from apps.estudiantes.services.cursada import estudiante_tiene_materia_aprobada
from apps.primera_carga.audit_utils import verify_regularidad_consistency
from core.permissions import ensure_profesorado_access

from .utils import (
    _to_bool,
    _normalize_value,
    _resolve_situacion,
    _next_planilla_numero,
    _planilla_codigo,
    _limpiar_datos_fila,
    _atomic_rollback,
)
from .pdf import _render_planilla_regularidad_pdf

def _extraer_nota_practicos(columnas: list[dict], datos: dict) -> Decimal | None:
    from .utils import _decimal_from_string
    if not datos:
        return None
    for col in columnas:
        key = col.get("key")
        if not key:
            continue
        valor = datos.get(key)
        nota = _decimal_from_string(valor)
        if nota is not None:
            return nota
    return None

def _ensure_required_row_fields(row: dict) -> None:
    missing = []
    for field in ("orden", "apellido_nombre", "situacion"):
        if row.get(field) in (None, "", []):
            missing.append(field)
    for field in ("nota_final", "asistencia"):
        if row.get(field) == "" or row.get(field) == []:
            missing.append(field)
    if missing:
        raise ValueError(f"Faltan campos obligatorios en la fila: {', '.join(missing)}")

def crear_planilla_regularidad(
    *,
    user: User,
    profesorado_id: int,
    materia_id: int,
    plantilla_id: int,
    dictado: str,
    fecha: date,
    folio: str | None = "",
    plan_resolucion: str | None = "",
    observaciones: str = "",
    datos_adicionales: dict | None = None,
    docentes: list[dict] | None = None,
    filas: list[dict] | None = None,
    estado: str = "final",
    dry_run: bool = False,
    force_upgrade: bool = False,
) -> dict:
    try:
        ensure_profesorado_access(user, profesorado_id, role_filter={"bedel", "secretaria"})
    except Exception:
        es_autoridad = user.asignaciones_profesorado.filter(rol__in=["bedel", "coordinador", "secretaria"]).exists()
        if not es_autoridad and not user.is_superuser:
            raise ValueError("No tiene permisos para cargar planillas en este profesorado.")

    try:
        profesorado = Profesorado.objects.get(pk=profesorado_id)
    except Profesorado.DoesNotExist:
        raise ValueError("El profesorado especificado no existe.")

    try:
        materia = Materia.objects.select_related("plan_de_estudio", "plan_de_estudio__profesorado").get(pk=materia_id)
    except Materia.DoesNotExist:
        raise ValueError("La materia especificada no existe.")

    if materia.plan_de_estudio.profesorado_id != profesorado.id:
        raise ValueError("La materia seleccionada no pertenece al profesorado elegido.")

    try:
        plantilla = RegularidadPlantilla.objects.select_related("formato").get(pk=plantilla_id)
    except RegularidadPlantilla.DoesNotExist:
        raise ValueError("La plantilla indicada no existe.")

    if plantilla.dictado != dictado:
        raise ValueError("El dictado seleccionado no coincide con la plantilla elegida.")

    anio_academico = fecha.year
    numero = _next_planilla_numero(profesorado.id, anio_academico)
    codigo = _planilla_codigo(profesorado, fecha, numero)

    columnas = plantilla.columnas or []
    formato_para_situaciones = materia.formato
    filas = filas or []
    docentes = docentes or []

    if not filas:
        raise ValueError("Debe proporcionar al menos una fila de estudiantes.")

    atomic_ctx = transaction.atomic if not dry_run else _atomic_rollback
    warnings: list[str] = []
    regularidades_registradas = 0

    with atomic_ctx():
        planilla = PlanillaRegularidad.objects.create(
            codigo=codigo,
            numero=numero,
            anio_academico=anio_academico,
            profesorado=profesorado,
            materia=materia,
            plantilla=plantilla,
            formato=plantilla.formato,
            dictado=dictado,
            plan_resolucion=plan_resolucion or materia.plan_de_estudio.resolucion,
            folio=folio or "",
            fecha=fecha,
            observaciones=observaciones or "",
            estado=estado,
            datos_adicionales=datos_adicionales or {},
            created_by=user,
        )

        for idx, docente_data in enumerate(docentes, start=1):
            nombre = docente_data.get("nombre", "").strip()
            if not nombre: continue
            dni_docente = _normalize_value(docente_data.get("dni"))
            docente_obj = None
            docente_id = docente_data.get("docente_id")
            if docente_id:
                docente_obj = Docente.objects.filter(pk=docente_id).first()
            elif dni_docente:
                docente_obj = Docente.objects.filter(persona__dni=dni_docente).first()

            PlanillaRegularidadDocente.objects.create(
                planilla=planilla, docente=docente_obj, nombre=nombre, dni=dni_docente,
                rol=docente_data.get("rol") or PlanillaRegularidadDocente.Rol.PROFESOR,
                orden=docente_data.get("orden") or idx,
            )

        dnis_usados = set()
        ordenes_usados = set()
        for idx, fila_data in enumerate(filas, start=1):
            orden = fila_data.get("orden") or idx
            fila_data["orden"] = orden
            _ensure_required_row_fields(fila_data)
            if orden in ordenes_usados:
                raise ValueError(f"El número de orden {orden} está duplicado.")
            ordenes_usados.add(orden)

            dni = _normalize_value(fila_data.get("dni"))
            if not dni and fila_data.get("apellido_nombre"):
                prefix = f"HIS-{profesorado.id:02d}-"
                count = Estudiante.objects.filter(persona__dni__startswith=prefix).count()
                seq = count + 1
                new_dni = f"{prefix}{seq:04d}"
                while Estudiante.objects.filter(persona__dni=new_dni).exists():
                    seq += 1
                    new_dni = f"{prefix}{seq:04d}"
                dni = new_dni
                warnings.append(f"[Fila {orden}] Se asignó DNI provisorio {dni} al estudiante sin identificación.")

            if dni:
                if dni in dnis_usados:
                    raise ValueError(f"El DNI {dni} aparece más de una vez en la planilla.")
                dnis_usados.add(dni)
            estudiante = Estudiante.objects.filter(persona__dni=dni).first() if dni else None

            if not estudiante and dni:
                apellido_nombre = _normalize_value(fila_data.get("apellido_nombre"))
                if apellido_nombre:
                    if "," in apellido_nombre:
                        parts = apellido_nombre.split(",", 1)
                        last_name = parts[0].strip()
                        first_name = parts[1].strip()
                    else:
                        last_name = apellido_nombre
                        first_name = "-"
                    user_obj = User.objects.filter(username=dni).first()
                    if not user_obj:
                        user_obj = User.objects.create_user(username=dni, password=dni, first_name=first_name, last_name=last_name)
                    from core.models import Persona
                    persona_obj, _ = Persona.objects.update_or_create(dni=dni, defaults={"nombre": first_name, "apellido": last_name})
                    estudiante = Estudiante.objects.create(user=user_obj, persona=persona_obj, estado_legajo=Estudiante.EstadoLegajo.PENDIENTE)
                    try:
                        estudiante.asignar_profesorado(profesorado)
                    except: pass
                    warnings.append(f"[Fila {orden}] Se creó el estudiante {dni} automáticamente.")

            if estudiante:
                try: estudiante.asignar_profesorado(profesorado)
                except: pass

            situacion = _resolve_situacion(fila_data.get("situacion", ""), formato_para_situaciones)
            nota_final_raw = fila_data.get("nota_final")
            nota_final_decimal = None
            if nota_final_raw not in (None, "", [], "---"):
                try:
                    nota_final_decimal = Decimal(str(nota_final_raw)).quantize(Decimal("0.1"))
                except (InvalidOperation, ValueError):
                    raise ValueError(f"La nota final de la fila {orden} debe ser un número válido o '---'.")
            
            nota_final_entera = None
            if nota_final_decimal is not None:
                nota_final_entera = int(nota_final_decimal.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

            asistencia_raw = str(fila_data.get("asistencia") or "").strip()
            if asistencia_raw in (None, "", [], "---"):
                asistencia = None
            else:
                try:
                    asistencia = int(math.ceil(float(asistencia_raw.replace(",", "."))))
                except (ValueError, TypeError):
                    raise ValueError(f"La asistencia de la fila {orden} debe ser un número válido o '---'.")
                if asistencia < 0 or asistencia > 100:
                    raise ValueError(f"La asistencia de la fila {orden} debe estar entre 0 y 100.")

            excepcion = fila_data.get("excepcion")
            excepcion_bool = _to_bool(str(excepcion)) if isinstance(excepcion, str) else bool(excepcion)
            datos_extra = _limpiar_datos_fila(fila_data.get("datos"), columnas)

            fila_obj = PlanillaRegularidadFila.objects.create(
                planilla=planilla, orden=orden, estudiante=estudiante, dni=dni,
                apellido_nombre=_normalize_value(fila_data.get("apellido_nombre")),
                nota_final=nota_final_decimal, asistencia_porcentaje=asistencia,
                situacion=situacion, excepcion=excepcion_bool, datos=datos_extra,
            )

            if not estudiante:
                warnings.append(f"[Fila {orden}] Estudiante con DNI {dni} no encontrado. Se omitió el registro de regularidad.")
                continue

            if situacion in {Regularidad.Situacion.PROMOCIONADO, Regularidad.Situacion.APROBADO}:
                if not force_upgrade and estudiante_tiene_materia_aprobada(estudiante, materia):
                    warnings.append(f"[Fila {orden}] El estudiante {estudiante.dni} ya tiene aprobada la materia {materia.nombre}.")
                    continue

            nota_tp_decimal = _extraer_nota_practicos(columnas, datos_extra)
            inscripcion = InscripcionMateriaEstudiante.objects.filter(estudiante=estudiante, materia=materia).order_by("-anio").first()
            
            Regularidad.objects.update_or_create(
                estudiante=estudiante, materia=materia, fecha_cierre=fecha,
                defaults={
                    "inscripcion": inscripcion,
                    "nota_trabajos_practicos": nota_tp_decimal,
                    "nota_final_cursada": nota_final_entera,
                    "asistencia_porcentaje": asistencia,
                    "excepcion": excepcion_bool,
                    "situacion": situacion,
                    "observaciones": (fila_data.get("observaciones") or "").strip(),
                }
            )
            verify_regularidad_consistency(fila_obj)
            regularidades_registradas += 1

        PlanillaRegularidadHistorial.objects.create(
            planilla=planilla, accion=PlanillaRegularidadHistorial.Accion.CREACION, user=user,
            payload={"numero": numero, "filas": len(filas), "docentes": len(docentes), "regularidades": regularidades_registradas, "warnings": warnings}
        )

        if not dry_run:
            pdf_bytes = _render_planilla_regularidad_pdf(planilla)
            planilla.pdf.save(f"{planilla.codigo}.pdf", ContentFile(pdf_bytes), save=True)

    return obtener_planilla_regularidad_detalle(planilla.id)

def obtener_planilla_regularidad_detalle(planilla_id: int) -> dict:
    try:
        planilla = PlanillaRegularidad.objects.select_related("profesorado", "materia", "plantilla", "formato").get(pk=planilla_id)
    except PlanillaRegularidad.DoesNotExist:
        raise ValueError("La planilla no existe.")
    
    docentes = []
    for d in planilla.docentes.all().order_by("orden", "id"):
        docentes.append({"docente_id": d.docente_id, "nombre": d.nombre, "dni": d.dni, "rol": d.rol, "orden": d.orden})
    filas = []
    for f in planilla.filas.all().order_by("orden", "id"):
        filas.append({
            "orden": f.orden, "dni": f.dni, "apellido_nombre": f.apellido_nombre,
            "nota_final": float(f.nota_final) if f.nota_final else None,
            "asistencia": f.asistencia_porcentaje, "situacion": f.situacion,
            "excepcion": f.excepcion, "datos": f.datos,
        })
    return {
        "id": planilla.id, "codigo": planilla.codigo, "anio_academico": planilla.anio_academico,
        "profesorado_id": planilla.profesorado_id, "profesorado_nombre": planilla.profesorado.nombre,
        "materia_id": planilla.materia_id, "materia_nombre": planilla.materia.nombre,
        "plantilla_id": planilla.plantilla_id, "dictado": planilla.dictado,
        "fecha": planilla.fecha.isoformat(), "folio": planilla.folio, "plan_resolucion": planilla.plan_resolucion,
        "observaciones": planilla.observaciones, "datos_adicionales": planilla.datos_adicionales,
        "docentes": docentes, "filas": filas, "estado": planilla.estado, "pdf_url": planilla.pdf.url if planilla.pdf else None,
    }

def actualizar_planilla_regularidad(
    planilla_id: int, user: User, profesorado_id: int | None = None,
    materia_id: int | None = None, plantilla_id: int | None = None,
    dictado: str | None = None, fecha: date | None = None,
    folio: str | None = None, plan_resolucion: str | None = None,
    observaciones: str | None = None, datos_adicionales: dict | None = None,
    docentes: list[dict] | None = None, filas: list[dict] | None = None,
    estado: str | None = None, dry_run: bool = False,
) -> dict:
    try:
        planilla = PlanillaRegularidad.objects.get(pk=planilla_id)
    except PlanillaRegularidad.DoesNotExist:
        raise ValueError("La planilla no existe.")

    try:
        ensure_profesorado_access(user, planilla.profesorado_id, role_filter={"bedel", "secretaria"})
    except Exception:
        es_autoridad = user.asignaciones_profesorado.filter(rol__in=["bedel", "coordinador", "secretaria"]).exists()
        if not es_autoridad and not user.is_superuser:
            raise ValueError("No tiene permisos para editar planillas de este profesorado.")

    if profesorado_id: planilla.profesorado_id = profesorado_id
    if materia_id: planilla.materia_id = materia_id
    if plantilla_id:
        planilla.plantilla_id = plantilla_id
        p = RegularidadPlantilla.objects.filter(pk=plantilla_id).first()
        if p: planilla.formato = p.formato
    if dictado: planilla.dictado = dictado
    if fecha:
        planilla.fecha = fecha
        planilla.anio_academico = fecha.year
    if folio is not None: planilla.folio = folio
    if plan_resolucion is not None: planilla.plan_resolucion = plan_resolucion
    if observaciones is not None: planilla.observaciones = observaciones
    if estado: planilla.estado = estado
    if datos_adicionales is not None: planilla.datos_adicionales = datos_adicionales

    atomic_ctx = transaction.atomic if not dry_run else _atomic_rollback
    with atomic_ctx():
        planilla.save()
        planilla.refresh_from_db()
        if docentes is not None:
            planilla.docentes.all().delete()
            for idx, d_data in enumerate(docentes, start=1):
                nombre = d_data.get("nombre", "").strip()
                if not nombre: continue
                dni = _normalize_value(d_data.get("dni"))
                d_obj = Docente.objects.filter(pk=d_data.get("docente_id")).first() if d_data.get("docente_id") else (Docente.objects.filter(persona__dni=dni).first() if dni else None)
                PlanillaRegularidadDocente.objects.create(planilla=planilla, docente=d_obj, nombre=nombre, dni=dni, rol=d_data.get("rol") or "profesor", orden=d_data.get("orden") or idx)
        
        if filas is not None:
            planilla.filas.all().delete()
            columnas = planilla.plantilla.columnas or []
            materia_actual = planilla.materia
            for idx, f_data in enumerate(filas, start=1):
                orden = f_data.get("orden") or idx
                dni = _normalize_value(f_data.get("dni"))
                estudiante = Estudiante.objects.filter(persona__dni=dni).first() if dni else None
                situacion = _resolve_situacion(f_data.get("situacion", ""), planilla.materia.formato)
                nota_dec = None
                if f_data.get("nota_final") not in (None, "", "---"):
                    nota_dec = Decimal(str(f_data.get("nota_final"))).quantize(Decimal("0.1"))
                asist = None
                try: asist = int(math.ceil(float(str(f_data.get("asistencia") or "").replace(",", "."))))
                except: pass
                
                fila_obj = PlanillaRegularidadFila.objects.create(
                    planilla=planilla, orden=orden, estudiante=estudiante, dni=dni or "",
                    apellido_nombre=_normalize_value(f_data.get("apellido_nombre") or ""),
                    nota_final=nota_dec, asistencia_porcentaje=asist, situacion=situacion,
                    excepcion=bool(f_data.get("excepcion")), datos=_limpiar_datos_fila(f_data.get("datos"), columnas)
                )
                if estudiante:
                    Regularidad.objects.update_or_create(
                        estudiante=estudiante, materia=materia_actual, fecha_cierre=planilla.fecha,
                        defaults={
                            "nota_final_cursada": int(nota_dec.quantize(Decimal("1"), rounding=ROUND_HALF_UP)) if nota_dec is not None else None,
                            "asistencia_porcentaje": asist, "situacion": situacion, "excepcion": bool(f_data.get("excepcion")),
                        }
                    )
                    verify_regularidad_consistency(fila_obj)
        if not dry_run:
            pdf_bytes = _render_planilla_regularidad_pdf(planilla)
            planilla.pdf.save(f"{planilla.codigo}.pdf", ContentFile(pdf_bytes), save=True)

    return obtener_planilla_regularidad_detalle(planilla.id)
