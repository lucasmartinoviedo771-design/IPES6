from datetime import datetime
from decimal import Decimal
import uuid

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify
from ninja import Router, Schema, Field, Body

from apps.common.api_schemas import ApiResponse
from apps.estudiantes.services.cursada import estudiante_tiene_materia_aprobada
from core.permissions import ensure_profesorado_access, allowed_profesorados
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import (
    ActaExamen,
    ActaExamenEstudiante,
    ActaExamenDocente,
    Docente,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    Profesorado,
)
from .notas_utils import normalized_user_roles, format_user_display

# ==============================================================================
# SCHEMAS
# ==============================================================================

class ActaDocenteLocal(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str
    dni: str | None = None

class ActaEstudianteLocal(Schema):
    numero_orden: int
    permiso_examen: str | None = None
    dni: str
    apellido_nombre: str
    examen_escrito: str | None = None
    examen_oral: str | None = None
    calificacion_definitiva: str
    observaciones: str | None = None

class ActaCreateLocal(Schema):
    tipo: str
    profesorado_id: int
    materia_id: int
    fecha: str
    folio: str
    libro: str | None = None
    observaciones: str | None = None
    docentes: list[ActaDocenteLocal] = Field(default_factory=list)
    estudiantes: list[ActaEstudianteLocal] = Field(default_factory=list)
    total_aprobados: int | None = None
    total_desaprobados: int | None = None
    total_ausentes: int | None = None

class ActaCreateOutLocal(Schema):
    id: int
    codigo: str

class ActaListItem(Schema):
    id: int
    codigo: str
    fecha: str
    materia: str
    libro: str | None = None
    folio: str | None = None
    total_estudiantes: int
    created_at: str
    mesa_id: int | None = None
    esta_cerrada: bool = False

class ActaDetailLocal(Schema):
    id: int
    codigo: str
    fecha: str
    profesorado: str
    materia: str
    materia_anio: int | None = None
    plan_resolucion: str | None = None
    libro: str | None = None
    folio: str | None = None
    observaciones: str | None = None
    total_estudiantes: int
    total_aprobados: int
    total_desaprobados: int
    total_ausentes: int
    created_by: str | None = None
    created_at: str | None = None
    mesa_id: int | None = None
    esta_cerrada: bool = False
    estudiantes: list[ActaEstudianteLocal] = Field(default_factory=list)
    docentes: list[ActaDocenteLocal] = Field(default_factory=list)

# Metadata schemas
class ActaMetadataMateria(Schema):
    id: int
    nombre: str
    anio_cursada: int
    plan_id: int
    plan_resolucion: str

class ActaMetadataPlan(Schema):
    id: int
    resolucion: str
    materias: list[ActaMetadataMateria]

class ActaMetadataProfesorado(Schema):
    id: int
    nombre: str
    planes: list[ActaMetadataPlan]

class ActaMetadataDocente(Schema):
    id: int
    nombre: str
    dni: str | None = None

class ActaMetadataOut(Schema):
    profesorados: list[ActaMetadataProfesorado]
    docentes: list[ActaMetadataDocente]
    nota_opciones: list[dict]

# Rebuild
ActaDocenteLocal.model_rebuild()
ActaEstudianteLocal.model_rebuild()
ActaCreateLocal.model_rebuild()
ActaCreateOutLocal.model_rebuild()
ActaListItem.model_rebuild()
ActaDetailLocal.model_rebuild()


# ==============================================================================
# LOGIC & ENDPOINTS
# ==============================================================================

router = Router(tags=["actas"])

def _nota_label(value: str) -> str:
    if not value:
        return "-"
    if value == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO:
        return "Aus. Jus."
    if value == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO:
        return "Aus. Injus."
    return f"{value}"

def _compute_acta_codigo(profesorado: Profesorado, anio: int, numero: int) -> str:
    prefix = (
        getattr(profesorado, "acronimo", None) or slugify(profesorado.nombre or "") or f"P{profesorado.id}"
    ).upper()
    return f"ACTA-{prefix}-{anio}-{numero:03d}"

def _next_acta_numero(profesorado_id: int, anio: int) -> int:
    ultimo = (
        ActaExamen.objects.filter(profesorado_id=profesorado_id, anio_academico=anio)
        .aggregate(Max("numero"))
        .get("numero__max")
        or 0
    )
    return ultimo + 1

def _clasificar_resultado(nota: str) -> str:
    if nota in (
        ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO,
    ):
        return "ausente"
    try:
        valor = Decimal(nota.replace(",", "."))
    except Exception:
        return "desaprobado"
    return "aprobado" if valor >= 6 else "desaprobado"

def _acta_metadata(user=None) -> ActaMetadataOut:
    profesorados_data: list[ActaMetadataProfesorado] = []
    profesorados_qs = Profesorado.objects.order_by("nombre").prefetch_related("planes")
    
    if user:
        allowed = allowed_profesorados(user)
        if allowed is not None:
            profesorados_qs = profesorados_qs.filter(id__in=allowed)

    for profesorado in profesorados_qs:
        planes_payload: list[ActaMetadataPlan] = []
        planes = (
            PlanDeEstudio.objects.filter(profesorado=profesorado)
            .order_by("resolucion", "id")
            .prefetch_related("materias")
        )
        for plan in planes:
            materias_payload: list[ActaMetadataMateria] = []
            for materia in plan.materias.all().order_by("anio_cursada", "nombre"):
                materias_payload.append(
                    ActaMetadataMateria(
                        id=materia.id,
                        nombre=materia.nombre,
                        anio_cursada=materia.anio_cursada,
                        plan_id=plan.id,
                        plan_resolucion=plan.resolucion,
                    )
                )
            planes_payload.append(
                ActaMetadataPlan(
                    id=plan.id,
                    resolucion=plan.resolucion,
                    materias=materias_payload,
                )
            )
        profesorados_data.append(
            ActaMetadataProfesorado(id=profesorado.id, nombre=profesorado.nombre, planes=planes_payload)
        )

    docentes_payload = [
        ActaMetadataDocente(
            id=doc.id,
            nombre=f"{doc.apellido}, {doc.nombre}".strip(", "),
            dni=doc.dni or None,
        )
        for doc in Docente.objects.order_by("apellido", "nombre", "id")
    ]
    
    NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
    ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
        ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO,
    ]

    nota_options = [{"value": value, "label": _nota_label(value)} for value in ACTA_NOTA_CHOICES]

    return ActaMetadataOut(
        profesorados=profesorados_data,
        docentes=docentes_payload,
        nota_opciones=nota_options,
    )


@router.get(
    "/actas/metadata",
    response={200: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def obtener_acta_metadata(request):
    data = _acta_metadata(user=request.user)
    return ApiResponse(
        ok=True,
        message="Metadata para actas de examen.",
        data=data.dict(),
    )


@router.get(
    "/actas",
    response={200: list[ActaListItem]},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def listar_actas(request, anio: int = None, materia: str = None, libro: str = None, folio: str = None, incluir_equivalencias: bool = False):
    user = request.user
    roles = normalized_user_roles(user)
    
    if roles.intersection({"admin", "secretaria", "titulos"}):
        qs = ActaExamen.objects.all()
    else:
        from core.models import StaffAsignacion
        carreras_ids = StaffAsignacion.objects.filter(
            user=user
        ).values_list("profesorado_id", flat=True)
        qs = ActaExamen.objects.filter(profesorado_id__in=carreras_ids)

    if not incluir_equivalencias:
        qs = qs.exclude(codigo__startswith="EQUIV-")

    if anio:
        qs = qs.filter(fecha__year=anio)
    if materia:
        qs = qs.filter(materia__nombre__icontains=materia)
    if libro:
        qs = qs.filter(libro__icontains=libro)
    if folio:
        qs = qs.filter(folio__icontains=folio)

    has_filters = any([anio, materia, libro, folio])
    limit = 200 if has_filters else 50

    actas = qs.select_related("materia").order_by("-id")[:limit]
    
    result = []
    for acta in actas:
        mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=acta.tipo).first()
        result.append({
            "id": acta.id,
            "codigo": acta.codigo,
            "fecha": acta.fecha.isoformat(),
            "materia": acta.materia.nombre if acta.materia else "Desconocida",
            "libro": acta.libro,
            "folio": acta.folio,
            "total_estudiantes": acta.total_alumnos,
            "created_at": acta.created_at.isoformat() if acta.created_at else "",
            "mesa_id": mesa.id if mesa else None,
            "esta_cerrada": (mesa.planilla_cerrada_en is not None) if mesa else False
        })
    return result


@router.get(
    "/actas/{acta_id}",
    response={200: ActaDetailLocal, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def obtener_acta(request, acta_id: int):
    acta = ActaExamen.objects.select_related("materia", "profesorado", "created_by", "plan").filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    user = request.user
    roles = normalized_user_roles(user)
    if not roles.intersection({"admin", "secretaria", "titulos"}):
        from core.models import StaffAsignacion
        carreras_ids = StaffAsignacion.objects.filter(user=user).values_list("profesorado_id", flat=True)
        if acta.profesorado_id not in carreras_ids:
             return 403, ApiResponse(ok=False, message="No tiene permiso para ver actas de este profesorado.")

    mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=acta.tipo).first()

    estudiantes_qs = acta.estudiantes.all().order_by("numero_orden")
    estudiantes_list = [
        ActaEstudianteLocal(
            numero_orden=a.numero_orden,
            permiso_examen=a.permiso_examen,
            dni=a.dni,
            apellido_nombre=a.apellido_nombre,
            examen_escrito=a.examen_escrito,
            examen_oral=a.examen_oral,
            calificacion_definitiva=a.calificacion_definitiva,
            observaciones=a.observaciones
        ) for a in estudiantes_qs
    ]

    docentes_qs = acta.docentes.all().order_by("orden")
    docentes_list = [
        ActaDocenteLocal(
            docente_id=a.docente_id,
            nombre=a.nombre,
            dni=a.dni,
            rol=a.rol
        ) for a in docentes_qs
    ]

    return ActaDetailLocal(
        id=acta.id,
        codigo=acta.codigo,
        fecha=acta.fecha.isoformat(),
        profesorado=acta.profesorado.nombre,
        materia=acta.materia.nombre if acta.materia else "Desconocida",
        materia_anio=acta.materia.anio_cursada if acta.materia else None,
        plan_resolucion=acta.plan.resolucion if acta.plan else None,
        libro=acta.libro,
        folio=acta.folio,
        observaciones=acta.observaciones,
        total_estudiantes=acta.total_alumnos,
        total_aprobados=acta.total_aprobados or 0,
        total_desaprobados=acta.total_desaprobados or 0,
        total_ausentes=acta.total_ausentes or 0,
        created_by=format_user_display(acta.created_by),
        created_at=acta.created_at.isoformat() if acta.created_at else None,
        mesa_id=mesa.id if mesa else None,
        esta_cerrada=(mesa.planilla_cerrada_en is not None) if mesa else False,
        estudiantes=estudiantes_list,
        docentes=docentes_list
    )


@router.post(
    "/actas",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel"])
def crear_acta_examen(request, payload: ActaCreateLocal = Body(...)):
    NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
    ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
        ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO,
    ]

    try:
        acta_fecha = datetime.strptime(payload.fecha, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        try:
            acta_fecha = datetime.fromisoformat(payload.fecha).date()
        except ValueError:
             return 400, ApiResponse(ok=False, message="Formato de fecha inválido. Use YYYY-MM-DD")

    if payload.tipo not in dict(ActaExamen.Tipo.choices):
        return 400, ApiResponse(ok=False, message="Tipo de acta inválido.")

    try:
        profesorado = Profesorado.objects.get(pk=payload.profesorado_id)
        ensure_profesorado_access(request.user, profesorado.id)
    except Profesorado.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Profesorado no encontrado.")

    try:
        materia = Materia.objects.select_related("plan_de_estudio").get(pk=payload.materia_id)
    except Materia.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Materia no encontrada.")

    plan = materia.plan_de_estudio
    if plan.profesorado_id != profesorado.id:
        return 400, ApiResponse(
            ok=False,
            message="La materia seleccionada no pertenece al profesorado indicado.",
        )

    from django.contrib.auth.models import User
    
    for estudiante_data in payload.estudiantes:
        clean_dni = estudiante_data.dni.strip()
        if not clean_dni:
            continue
            
        estudiante = Estudiante.objects.filter(dni=clean_dni).first()
        
        if not estudiante:
            nombre_completo = estudiante_data.apellido_nombre.strip()
            parts = nombre_completo.split(",")
            if len(parts) == 2:
                last_name = parts[0].strip()
                first_name = parts[1].strip()
            else:
                return 400, ApiResponse(
                    ok=False,
                    message=f"El estudiante con DNI {clean_dni} ({nombre_completo}) no existe y para crearlo automáticamente se requiere el formato 'Apellido, Nombre' (con coma)."
                )

            username = clean_dni
            if User.objects.filter(username=username).exists():
                 user = User.objects.get(username=username)
            else:
                user = User.objects.create_user(username=username, first_name=first_name, last_name=last_name)
                user.set_password(f"pass{clean_dni}")
                user.save()
            
            estudiante = Estudiante.objects.create(
                user=user,
                dni=clean_dni,
                legajo=None,
                estado_legajo=Estudiante.EstadoLegajo.PENDIENTE
            )
        
        estudiante.asignar_profesorado(profesorado)

    anio = acta_fecha.year
    numero = _next_acta_numero(profesorado.id, anio)
    codigo = _compute_acta_codigo(profesorado, anio, numero)

    estudiantes_payload = []
    for estudiante_item in payload.estudiantes:
        if estudiante_item.calificacion_definitiva not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(
                ok=False,
                message=f"Calificación '{estudiante_item.calificacion_definitiva}' inválida para el estudiante {estudiante_item.dni}.",
            )
        if estudiante_item.examen_escrito and estudiante_item.examen_escrito not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Valor inválido en examen escrito para {estudiante_item.dni}.")
        if estudiante_item.examen_oral and estudiante_item.examen_oral not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Valor inválido en examen oral para {estudiante_item.dni}.")
        
        if _clasificar_resultado(estudiante_item.calificacion_definitiva) == "aprobado":
            est_obj = Estudiante.objects.filter(dni=estudiante_item.dni).first()
            if est_obj and estudiante_tiene_materia_aprobada(est_obj, materia):
                return 400, ApiResponse(
                    ok=False,
                    message=f"El estudiante {est_obj.dni} ya tiene aprobada la materia {materia.nombre}. No se puede cargar otra nota de aprobación.",
                )

        estudiantes_payload.append(estudiante_item)

    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for est_item in estudiantes_payload:
        categoria = _clasificar_resultado(est_item.calificacion_definitiva)
        categoria_counts[categoria] += 1

    if payload.total_aprobados is not None and payload.total_aprobados != categoria_counts["aprobado"]:
        return 400, ApiResponse(
            ok=False,
            message="La cantidad de aprobados no coincide con las calificaciones cargadas.",
        )
    if payload.total_desaprobados is not None and payload.total_desaprobados != categoria_counts["desaprobado"]:
        return 400, ApiResponse(
            ok=False,
            message="La cantidad de desaprobados no coincide con las calificaciones cargadas.",
        )
    if payload.total_ausentes is not None and payload.total_ausentes != categoria_counts["ausente"]:
        return 400, ApiResponse(
            ok=False,
            message="La cantidad de ausentes no coincide con las calificaciones cargadas.",
        )

    for docente_data in payload.docentes:
        if not docente_data.docente_id and docente_data.nombre:
            nombre_clean = docente_data.nombre.strip()
            dni_clean = (docente_data.dni or "").strip()
            
            if dni_clean:
                existing_doc = Docente.objects.filter(dni=dni_clean).first()
                if existing_doc:
                    docente_data.docente_id = existing_doc.id
                else:
                    parts = nombre_clean.split(",")
                    if len(parts) >= 2:
                        apellido = parts[0].strip()
                        nombre = " ".join(parts[1:]).strip()
                    else:
                        apellido = nombre_clean
                        nombre = "."

                    new_doc = Docente.objects.create(
                        dni=dni_clean,
                        apellido=apellido,
                        nombre=nombre
                    )
                    docente_data.docente_id = new_doc.id

            else:
                fake_dni = f"HIST-{uuid.uuid4().hex[:8].upper()}"
                
                parts = nombre_clean.split(",")
                if len(parts) >= 2:
                    apellido = parts[0].strip()
                    nombre = " ".join(parts[1:]).strip()
                else:
                    apellido = nombre_clean
                    nombre = "."
                
                new_doc = Docente.objects.create(
                    dni=fake_dni,
                    apellido=apellido,
                    nombre=nombre
                )
                docente_data.docente_id = new_doc.id
                docente_data.dni = fake_dni

    usuario = getattr(request, "user", None)
    with transaction.atomic():
        acta = ActaExamen.objects.create(
            codigo=codigo,
            numero=numero,
            anio_academico=anio,
            tipo=payload.tipo,
            profesorado=profesorado,
            materia=materia,
            plan=plan,
            anio_cursada=materia.anio_cursada,
            fecha=acta_fecha,
            folio=payload.folio,
            libro=payload.libro or "",
            observaciones=payload.observaciones or "",
            total_alumnos=len(estudiantes_payload),
            total_aprobados=categoria_counts["aprobado"],
            total_desaprobados=categoria_counts["desaprobado"],
            total_ausentes=categoria_counts["ausente"],
            created_by=usuario if getattr(usuario, "is_authenticated", False) else None,
            updated_by=usuario if getattr(usuario, "is_authenticated", False) else None,
        )
        
        mesa_modalidad = MesaExamen.Modalidad.REGULAR
        if payload.tipo == ActaExamen.Tipo.LIBRE:
            mesa_modalidad = MesaExamen.Modalidad.LIBRE
        
        docente_presidente = None
        docente_vocal1 = None
        docente_vocal2 = None
        
        for docente_data in payload.docentes or []:
            d_obj = None
            if docente_data.docente_id:
                d_obj = Docente.objects.filter(id=docente_data.docente_id).first()
            
            if docente_data.rol == ActaExamenDocente.Rol.PRESIDENTE:
                docente_presidente = d_obj
            elif docente_data.rol == ActaExamenDocente.Rol.VOCAL1:
                docente_vocal1 = d_obj
            elif docente_data.rol == ActaExamenDocente.Rol.VOCAL2:
                docente_vocal2 = d_obj

        mesa = MesaExamen.objects.filter(
            materia=materia,
            fecha=acta_fecha,
            modalidad=mesa_modalidad,
        ).first()

        if not mesa:
            fecha_str = acta_fecha.strftime("%Y%m%d")
            mesa_codigo = f"MA-{acta.id}-{fecha_str}" 
            mesa = MesaExamen.objects.create(
                materia=materia,
                fecha=acta_fecha,
                tipo=MesaExamen.Tipo.FINAL, 
                modalidad=mesa_modalidad,
                codigo=mesa_codigo,
                docente_presidente=docente_presidente,
                docente_vocal1=docente_vocal1,
                docente_vocal2=docente_vocal2,
                planilla_cerrada_en=timezone.now(),
                planilla_cerrada_por=usuario if getattr(usuario, "is_authenticated", False) else None,
                cupo=0
            )

        for idx, docente_data in enumerate(payload.docentes or [], start=1):
            rol = (
                docente_data.rol
                if docente_data.rol in dict(ActaExamenDocente.Rol.choices)
                else ActaExamenDocente.Rol.PRESIDENTE
            )
            docente_obj = None
            if docente_data.docente_id:
                docente_obj = Docente.objects.filter(id=docente_data.docente_id).first()
            ActaExamenDocente.objects.create(
                acta=acta,
                docente=docente_obj,
                nombre=docente_data.nombre.strip(),
                dni=(docente_data.dni or "").strip(),
                rol=rol,
                orden=idx,
            )

        for est_item in estudiantes_payload:
            ActaExamenEstudiante.objects.create(
                acta=acta,
                numero_orden=est_item.numero_orden,
                permiso_examen=est_item.permiso_examen or "",
                dni=est_item.dni.strip(),
                apellido_nombre=est_item.apellido_nombre.strip(),
                examen_escrito=est_item.examen_escrito or "",
                examen_oral=est_item.examen_oral or "",
                calificacion_definitiva=est_item.calificacion_definitiva,
                observaciones=est_item.observaciones or "",
            )
            
            est_obj = Estudiante.objects.filter(dni=est_item.dni.strip()).first()
            if est_obj:
                nota_decimal = None
                condicion_mesa = InscripcionMesa.Condicion.DESAPROBADO

                calif_upper = est_item.calificacion_definitiva.strip().upper()
                if calif_upper in (str(i) for i in range(1, 11)):
                    try:
                        nota_decimal = Decimal(calif_upper)
                        if nota_decimal >= 6: 
                             condicion_mesa = InscripcionMesa.Condicion.APROBADO
                    except:
                        pass
                elif calif_upper == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO:
                     condicion_mesa = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                elif calif_upper == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO:
                     condicion_mesa = InscripcionMesa.Condicion.AUSENTE
                
                InscripcionMesa.objects.update_or_create(
                    mesa=mesa,
                    estudiante=est_obj,
                    defaults={
                        "estado": InscripcionMesa.Estado.INSCRIPTO,
                        "fecha_resultado": acta_fecha,
                        "condicion": condicion_mesa,
                        "nota": nota_decimal,
                        "folio": payload.folio,
                        "libro": payload.libro,
                        "observaciones": "Carga por Acta de Examen (Primera Carga)",
                        "cuenta_para_intentos": condicion_mesa != InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                    }
                )

    return ApiResponse(
        ok=True,
        message="Acta de examen generada correctamente y reflejada en trayectoria.",
        data=ActaCreateOutLocal(id=acta.id, codigo=acta.codigo).dict(),
    )
