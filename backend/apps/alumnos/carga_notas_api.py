

from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Max
from django.utils import timezone
from django.utils.text import slugify
from ninja import Router, Schema, Field, Body  # Importamos Schema y Field aqui tambien
from ninja.errors import HttpError
import uuid

from apps.common.api_schemas import ApiResponse
from apps.alumnos.api.reportes_api import _check_correlativas_caidas
from apps.alumnos.services.cursada import estudiante_tiene_materia_aprobada
from core.permissions import ensure_profesorado_access, allowed_profesorados
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import (
    ActaExamen,
    ActaExamenAlumno,
    ActaExamenDocente,
    Comision,
    Docente,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    Profesorado,
    Regularidad,
    RegularidadPlanillaLock,
    InscripcionMateriaAlumno,
)

# Mantenemos los otros schemas que NO daban error importados desde schemas.py
# Si esto vuelve a fallar, te pasare una version SIN NINGUN import de schemas.py
from apps.alumnos.schemas import (
    ActaMetadataOut,
    ActaMetadataProfesorado,
    ActaMetadataPlan,
    ActaMetadataMateria,
    ActaMetadataDocente,
    ActaOralSchema,
    ActaOralListItemSchema,
    RegularidadPlanillaOut,
    RegularidadAlumnoOut,
    RegularidadCargaIn,
    RegularidadCierreIn,
    CargaNotasLookup,
    MateriaOption,
    ComisionOption,
)

carga_notas_router = Router(tags=["carga_notas"], auth=JWTAuth())

# ==============================================================================
# DEFINICION LOCAL DE SCHEMAS DE ACTAS (Para evitar error PydanticUserError)
# ==============================================================================

class ActaDocenteLocal(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str
    dni: str | None = None

class ActaAlumnoLocal(Schema):
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
    # Definicion directa sin comillas, usando default_factory
    docentes: list[ActaDocenteLocal] = Field(default_factory=list)
    alumnos: list[ActaAlumnoLocal] = Field(default_factory=list)
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
    total_alumnos: int
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
    total_alumnos: int
    total_aprobados: int
    total_desaprobados: int
    total_ausentes: int
    created_by: str | None = None
    created_at: str | None = None
    mesa_id: int | None = None
    esta_cerrada: bool = False
    alumnos: list[ActaAlumnoLocal] = Field(default_factory=list)
    docentes: list[ActaDocenteLocal] = Field(default_factory=list)

# Rebuild explicito para asegurar que Pydantic v2 los marque como 'fully defined'
ActaDocenteLocal.model_rebuild()
ActaAlumnoLocal.model_rebuild()
ActaCreateLocal.model_rebuild()
ActaCreateOutLocal.model_rebuild()
ActaListItem.model_rebuild()
ActaDetailLocal.model_rebuild()

# ==============================================================================
# FIN DEFINICION LOCAL
# ==============================================================================

def _normalized_user_roles(user) -> set[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    roles = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        roles.add("admin")
    return roles


def _docente_from_user(user) -> Docente | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    lookup = Q()
    username = (getattr(user, "username", "") or "").strip()
    if username:
        lookup |= Q(dni__iexact=username)
    email = (getattr(user, "email", "") or "").strip()
    if email:
        lookup |= Q(email__iexact=email)
    if not lookup:
        return None
    return Docente.objects.filter(lookup).first()


def _format_user_display(user) -> str | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    full_name = (user.get_full_name() or "").strip()
    if full_name:
        return full_name
    username = getattr(user, "username", None)
    if username:
        return username
    return None


def _user_has_privileged_planilla_access(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser or user.is_staff:
        return True
    group_names = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    return bool(group_names.intersection({"admin", "secretaria", "bedel"}))


def _regularidad_lock_for_scope(
    *,
    comision: Comision | None = None,
    materia: Materia | None = None,
    anio_virtual: int | None = None,
):
    qs = RegularidadPlanillaLock.objects.select_related("cerrado_por")
    if comision:
        return qs.filter(comision=comision).first()
    if materia is not None and anio_virtual is not None:
        return qs.filter(comision__isnull=True, materia=materia, anio_virtual=anio_virtual).first()
    return None


FORMATOS_TALLER = {"TAL", "PRA", "SEM", "LAB"}
_VIRTUAL_COMISION_FACTOR = 10000


def _virtual_comision_id(materia_id: int, anio: int | None) -> int:
    base = materia_id * _VIRTUAL_COMISION_FACTOR + (anio or 0)
    return -base


def _split_virtual_comision_id(raw_id: int) -> tuple[int, int | None]:
    absolute = abs(raw_id)
    materia_id = absolute // _VIRTUAL_COMISION_FACTOR
    anio = absolute % _VIRTUAL_COMISION_FACTOR
    return materia_id, anio or None


def _nota_label(value: str) -> str:
    if not value:
        return "-"
    if value == ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO:
        return "Aus. Jus."
    if value == ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO:
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
        ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
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
        ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
    ]

    nota_options = [{"value": value, "label": _nota_label(value)} for value in ACTA_NOTA_CHOICES]

    return ActaMetadataOut(
        profesorados=profesorados_data,
        docentes=docentes_payload,
        nota_opciones=nota_options,
    )


@carga_notas_router.get(
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


@carga_notas_router.get(
    "/actas",
    response={200: list[ActaListItem]},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def listar_actas(request, anio: int = None, materia: str = None, libro: str = None, folio: str = None):
    user = request.user
    roles = _normalized_user_roles(user)
    
    # Roles con acceso total
    if roles.intersection({"admin", "secretaria", "titulos"}):
        qs = ActaExamen.objects.all()
    else:
        # Roles limitados (Bedel, Coordinador): Filtramos por asignacion
        from core.models import StaffAsignacion
        
        # Obtenemos IDs de profesorados donde el usuario tiene asignacion activa
        carreras_ids = StaffAsignacion.objects.filter(
            user=user
        ).values_list("profesorado_id", flat=True)
        
        # Nota: Si StaffAsignacion no tiene 'activo', quitar esa linea.
        # Fallback si no tiene asignaciones: no ve nada
        qs = ActaExamen.objects.filter(profesorado_id__in=carreras_ids)

    # 1. Filtros
    if anio:
        qs = qs.filter(fecha__year=anio)
    if materia:
        qs = qs.filter(materia__nombre__icontains=materia)
    if libro:
        qs = qs.filter(libro__icontains=libro)
    if folio:
        qs = qs.filter(folio__icontains=folio)

    # 2. Limit: If filtering, allow more results. If not, only last 50.
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
            "total_alumnos": acta.total_alumnos,
            "created_at": acta.created_at.isoformat() if acta.created_at else "",
            "mesa_id": mesa.id if mesa else None,
            "esta_cerrada": (mesa.planilla_cerrada_en is not None) if mesa else False
        })
    return result


@carga_notas_router.get(
    "/actas/{acta_id}",
    response={200: ActaDetailLocal, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def obtener_acta(request, acta_id: int):
    acta = ActaExamen.objects.select_related("materia", "profesorado", "created_by", "plan").filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    # Validacion de permisos segun profesorado (copiando logica de listar)
    user = request.user
    roles = _normalized_user_roles(user)
    if not roles.intersection({"admin", "secretaria", "titulos"}):
        from core.models import StaffAsignacion
        carreras_ids = StaffAsignacion.objects.filter(user=user).values_list("profesorado_id", flat=True)
        if acta.profesorado_id not in carreras_ids:
             return 403, ApiResponse(ok=False, message="No tiene permiso para ver actas de este profesorado.")

    mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=acta.tipo).first()

    alumnos_qs = acta.alumnos.all().order_by("numero_orden")
    alumnos_list = [
        ActaAlumnoLocal(
            numero_orden=a.numero_orden,
            permiso_examen=a.permiso_examen,
            dni=a.dni,
            apellido_nombre=a.apellido_nombre,
            examen_escrito=a.examen_escrito,
            examen_oral=a.examen_oral,
            calificacion_definitiva=a.calificacion_definitiva,
            observaciones=a.observaciones
        ) for a in alumnos_qs
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
        total_alumnos=acta.total_alumnos,
        total_aprobados=acta.total_aprobados or 0,
        total_desaprobados=acta.total_desaprobados or 0,
        total_ausentes=acta.total_ausentes or 0,
        created_by=_format_user_display(acta.created_by),
        created_at=acta.created_at.isoformat() if acta.created_at else None,
        mesa_id=mesa.id if mesa else None,
        esta_cerrada=(mesa.planilla_cerrada_en is not None) if mesa else False,
        alumnos=alumnos_list,
        docentes=docentes_list
    )


@carga_notas_router.post(
    "/actas",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel"])
def crear_acta_examen(request, payload: ActaCreateLocal = Body(...)):
    # Definimos las constantes locales para validacion
    NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
    ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
        ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
    ]

    # Validación y parseo manual de fecha
    try:
        # Intentar formato YYYY-MM-DD
        acta_fecha = datetime.strptime(payload.fecha, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        try:
            # Fallback a ISO format si viene con hora
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

    
    # 1. Auto-creacion / Validacion de estudiantes (Lazy Creation)
    # En lugar de rechazar, creamos los perfiles minimos necesarios para los DNI que no existen.
    
    from django.contrib.auth.models import User
    
    for alumno_data in payload.alumnos:
        clean_dni = alumno_data.dni.strip()
        if not clean_dni:
            continue
            
        estudiante = Estudiante.objects.filter(dni=clean_dni).first()
        
        if not estudiante:
            # Creacion automatica del usuario y estudiante
            nombre_completo = alumno_data.apellido_nombre.strip()
            parts = nombre_completo.split(",")
            if len(parts) == 2:
                last_name = parts[0].strip()
                first_name = parts[1].strip()
            else:
                return 400, ApiResponse(
                    ok=False,
                    message=f"El alumno con DNI {clean_dni} ({nombre_completo}) no existe y para crearlo automáticamente se requiere el formato 'Apellido, Nombre' (con coma)."
                )

            # Crear User
            username = clean_dni
            # Manejo de colision de username raros
            if User.objects.filter(username=username).exists():
                 # Si existe el user pero no estudiante, lo vinculamos.
                 user = User.objects.get(username=username)
            else:
                user = User.objects.create_user(username=username, password=clean_dni, first_name=first_name, last_name=last_name)
            
            # Crear Estudiante
            estudiante = Estudiante.objects.create(
                user=user,
                dni=clean_dni,
                legajo=None, # Se asignara despues o manual
                estado_legajo=Estudiante.EstadoLegajo.PENDIENTE
            )
        
        # Asegurar vinculacion con el profesorado (Inscripcion a carrera)
        # Esto permite que aparezca en los reportes de esa carrera
        estudiante.asignar_profesorado(profesorado)

    anio = acta_fecha.year
    numero = _next_acta_numero(profesorado.id, anio)
    codigo = _compute_acta_codigo(profesorado, anio, numero)

    alumnos_payload = []
    for alumno in payload.alumnos:
        if alumno.calificacion_definitiva not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(
                ok=False,
                message=f"Calificación '{alumno.calificacion_definitiva}' inválida para el alumno {alumno.dni}.",
            )
        if alumno.examen_escrito and alumno.examen_escrito not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Valor inválido en examen escrito para {alumno.dni}.")
        if alumno.examen_oral and alumno.examen_oral not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Valor inválido en examen oral para {alumno.dni}.")
        
        # Validación: Evitar duplicados de aprobados
        if _clasificar_resultado(alumno.calificacion_definitiva) == "aprobado":
            estudiante = Estudiante.objects.filter(dni=alumno.dni).first()
            if estudiante and estudiante_tiene_materia_aprobada(estudiante, materia):
                return 400, ApiResponse(
                    ok=False,
                    message=f"El alumno {alumno.dni} ya tiene aprobada la materia {materia.nombre}. No se puede cargar otra nota de aprobación.",
                )

        alumnos_payload.append(alumno)

    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for alumno in alumnos_payload:
        categoria = _clasificar_resultado(alumno.calificacion_definitiva)
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

    # 2. Auto-creacion de Docentes Históricos (si no tienen ID)
    # Si viene nombre pero no docente_id, creamos un Docente "placeholder" si no existe DNI,
    # o buscamos/creamos por DNI si viene especificado.
    
    for docente_data in payload.docentes:
        if not docente_data.docente_id and docente_data.nombre:
            nombre_clean = docente_data.nombre.strip()
            dni_clean = (docente_data.dni or "").strip()
            
            # Caso 1: Viene DNI especificado manualmente
            if dni_clean:
                # Buscar si ya existe
                existing_doc = Docente.objects.filter(dni=dni_clean).first()
                if existing_doc:
                    docente_data.docente_id = existing_doc.id
                else:
                    # Crear nuevo con ese DNI
                    parts = nombre_clean.split(",")
                    if len(parts) >= 2:
                        apellido = parts[0].strip()
                        nombre = " ".join(parts[1:]).strip()
                    else:
                        # Si no hay coma, asumimos todo apellido (o convención)
                        apellido = nombre_clean
                        nombre = "."

                    new_doc = Docente.objects.create(
                        dni=dni_clean,
                        apellido=apellido,
                        nombre=nombre
                    )
                    docente_data.docente_id = new_doc.id

            # Caso 2: No viene DNI (solo nombre)
            else:
                # Generamos un DNI ficticio para persistirlo
                # Formato: HIST-{hash corto}
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
                # Actualizamos el DNI en el payload para que quede guardado en el acta tambien
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
            total_alumnos=len(alumnos_payload),
            total_aprobados=categoria_counts["aprobado"],
            total_desaprobados=categoria_counts["desaprobado"],
            total_ausentes=categoria_counts["ausente"],
            created_by=usuario if getattr(usuario, "is_authenticated", False) else None,
            updated_by=usuario if getattr(usuario, "is_authenticated", False) else None,
        )
        
        # --- REFLEJO EN MESA DE EXAMEN Y TRAYECTORIA ---
        # 1. Determinar o crear MesaExamen Virtual/Real
        mesa_modalidad = MesaExamen.Modalidad.REGULAR
        if payload.tipo == ActaExamen.Tipo.LIBRE:
            mesa_modalidad = MesaExamen.Modalidad.LIBRE
        
        # Buscar docentes para asignar a la mesa (si se crea nueva)
        docente_presidente = None
        docente_vocal1 = None
        docente_vocal2 = None
        
        for docente_data in payload.docentes or []:
            d_obj = None
            if docente_data.docente_id:
                d_obj = Docente.objects.filter(id=docente_data.docente_id).first()
            
            # Map Acta roles to vars
            if docente_data.rol == ActaExamenDocente.Rol.PRESIDENTE:
                docente_presidente = d_obj
            elif docente_data.rol == ActaExamenDocente.Rol.VOCAL1:
                docente_vocal1 = d_obj
            elif docente_data.rol == ActaExamenDocente.Rol.VOCAL2:
                docente_vocal2 = d_obj

        # Intentamos buscar una mesa existente que coincida
        mesa = MesaExamen.objects.filter(
            materia=materia,
            fecha=acta_fecha,
            modalidad=mesa_modalidad,
        ).first()

        if not mesa:
            # Generamos un codigo mas corto para evitar DataError (max 40 chars)
            # MA = Mesa Automatica / A{id} = Acta ID
            fecha_str = acta_fecha.strftime("%Y%m%d")
            mesa_codigo = f"MA-{acta.id}-{fecha_str}" 
            mesa = MesaExamen.objects.create(
                materia=materia,
                fecha=acta_fecha,
                tipo=MesaExamen.Tipo.FINAL, # Asumimos Final por defecto para Actas
                modalidad=mesa_modalidad,
                codigo=mesa_codigo,
                docente_presidente=docente_presidente,
                docente_vocal1=docente_vocal1,
                docente_vocal2=docente_vocal2,
                planilla_cerrada_en=timezone.now(), # Se asume cerrada si viene de acta
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

        for alumno in alumnos_payload:
            # Crear registro en Acta
            ActaExamenAlumno.objects.create(
                acta=acta,
                numero_orden=alumno.numero_orden,
                permiso_examen=alumno.permiso_examen or "",
                dni=alumno.dni.strip(),
                apellido_nombre=alumno.apellido_nombre.strip(),
                examen_escrito=alumno.examen_escrito or "",
                examen_oral=alumno.examen_oral or "",
                calificacion_definitiva=alumno.calificacion_definitiva,
                observaciones=alumno.observaciones or "",
            )
            
            # --- REFLEJO EN INSCRIPCION MESA (TRAYECTORIA) ---
            estudiante = Estudiante.objects.filter(dni=alumno.dni.strip()).first()
            if estudiante:
                # Parsear nota y condicion
                nota_decimal = None
                condicion_mesa = InscripcionMesa.Condicion.DESAPROBADO # Default

                calif_upper = alumno.calificacion_definitiva.strip().upper()
                if calif_upper in (str(i) for i in range(1, 11)):
                    try:
                        nota_decimal = Decimal(calif_upper)
                        if nota_decimal >= 6: # Umbral 6
                             condicion_mesa = InscripcionMesa.Condicion.APROBADO
                    except:
                        pass
                elif calif_upper == ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO:
                     condicion_mesa = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                elif calif_upper == ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO:
                     condicion_mesa = InscripcionMesa.Condicion.AUSENTE
                
                # Crear o actualizar InscripcionMesa
                InscripcionMesa.objects.update_or_create(
                    mesa=mesa,
                    estudiante=estudiante,
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


NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
    ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
    ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
]

_SITUACIONES = {
    "ASI": [
        {
            "alias": "REGULAR",
            "codigo": Regularidad.Situacion.REGULAR,
            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y parcial/recuperatorio (nota ≥ 6/10).",
        },
        {
            "alias": "DESAPROBADO_TP",
            "codigo": Regularidad.Situacion.DESAPROBADO_TP,
            "descripcion": "Desaprueba TP y sus recuperatorios.",
        },
        {
            "alias": "DESAPROBADO_PA",
            "codigo": Regularidad.Situacion.DESAPROBADO_PA,
            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorios.",
        },
        {
            "alias": "LIBRE-I",
            "codigo": Regularidad.Situacion.LIBRE_I,
            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
        },
        {
            "alias": "LIBRE-AT",
            "codigo": Regularidad.Situacion.LIBRE_AT,
            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
        },
    ],
    "MOD": [
        {
            "alias": "PROMOCION",
            "codigo": Regularidad.Situacion.PROMOCIONADO,
            "descripcion": "Cumple con asistencia (80%), aprueba TP y parcial (nota final ≥ 8).",
        },
        {
            "alias": "REGULAR",
            "codigo": Regularidad.Situacion.REGULAR,
            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y parcial/recuperatorio (nota ≥ 6/10).",
        },
        {
            "alias": "DESAPROBADO_TP",
            "codigo": Regularidad.Situacion.DESAPROBADO_TP,
            "descripcion": "Desaprueba TP y sus recuperatorios.",
        },
        {
            "alias": "DESAPROBADO_PA",
            "codigo": Regularidad.Situacion.DESAPROBADO_PA,
            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorios.",
        },
        {
            "alias": "LIBRE-I",
            "codigo": Regularidad.Situacion.LIBRE_I,
            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
        },
        {
            "alias": "LIBRE-AT",
            "codigo": Regularidad.Situacion.LIBRE_AT,
            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
        },
    ],
    "TAL": [
        {
            "alias": "APROBADO",
            "codigo": Regularidad.Situacion.APROBADO,
            "descripcion": "Cumple con el régimen de asistencia y con las evaluaciones.",
        },
        {
            "alias": "DESAPROBADO_TP",
            "codigo": Regularidad.Situacion.DESAPROBADO_TP,
            "descripcion": "Desaprueba TP y sus recuperatorios.",
        },
        {
            "alias": "LIBRE-I",
            "codigo": Regularidad.Situacion.LIBRE_I,
            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
        },
        {
            "alias": "LIBRE-AT",
            "codigo": Regularidad.Situacion.LIBRE_AT,
            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
        },
    ],
}

ALIAS_TO_SITUACION = {item["alias"]: item["codigo"] for items in _SITUACIONES.values() for item in items}

SITUACION_TO_ALIAS = {v: k for k, v in ALIAS_TO_SITUACION.items()}


def _situaciones_para_formato(formato: str) -> list[dict]:
    if not formato:
        return _SITUACIONES["ASI"]
    formato_key = formato.upper()
    if formato_key in _SITUACIONES:
        return _SITUACIONES[formato_key]

    if formato_key in FORMATOS_TALLER:
        return _SITUACIONES["TAL"]
    return _SITUACIONES["ASI"]

def _alias_desde_situacion(codigo: str | None) -> str | None:
    if not codigo:
        return None
    return SITUACION_TO_ALIAS.get(codigo)


@carga_notas_router.get(
    "/comisiones",
    response=CargaNotasLookup,
    auth=JWTAuth(),
)
def listar_comisiones(
    request,
    profesorado_id: int | None = None,
    materia_id: int | None = None,
    plan_id: int | None = None,
    anio: int | None = None,
    cuatrimestre: str | None = None,
):
    if not plan_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
    if not plan:
        return CargaNotasLookup(materias=[], comisiones=[])

    if profesorado_id and profesorado_id != plan.profesorado_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    roles = _normalized_user_roles(request.user)
    # Si es admin/secretaria/etc, NO filtramos por docente aunque tenga el rol.
    is_privileged = bool(roles.intersection({"admin", "secretaria", "bedel", "titulos", "coordinador"}))
    docente_profile = _docente_from_user(request.user) if "docente" in roles and not is_privileged else None

    comisiones_qs = (
        Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "turno",
        )
        .filter(materia__plan_de_estudio=plan)
        .order_by("-anio_lectivo", "materia__nombre", "codigo")
    )

    if docente_profile:
        comisiones_qs = comisiones_qs.filter(docente=docente_profile)

    if materia_id:
        comisiones_qs = comisiones_qs.filter(materia_id=materia_id)
    if anio:
        comisiones_qs = comisiones_qs.filter(anio_lectivo=anio)
    if cuatrimestre:
        comisiones_qs = comisiones_qs.filter(materia__regimen=cuatrimestre)

    materias_qs = Materia.objects.filter(plan_de_estudio=plan)
    if docente_profile:
        materias_qs = materias_qs.filter(comision__docente=docente_profile).distinct()
    if materia_id:
        materias_qs = materias_qs.filter(id=materia_id)
    materias_qs = materias_qs.order_by("anio_cursada", "nombre")

    materias_out: list[MateriaOption] = [
        MateriaOption(
            id=m.id,
            nombre=m.nombre,
            plan_id=plan.id,
            anio=m.anio_cursada,
            cuatrimestre=m.regimen,
            formato=getattr(m, "formato", None),
        )
        for m in materias_qs
    ]

    comisiones_out: list[ComisionOption] = []
    for com in comisiones_qs:
        materia_obj = com.materia
        plan_obj = materia_obj.plan_de_estudio
        profesorado = plan_obj.profesorado
        comisiones_out.append(
            ComisionOption(
                id=com.id,
                materia_id=materia_obj.id,
                materia_nombre=materia_obj.nombre,
                profesorado_id=profesorado.id,
                profesorado_nombre=profesorado.nombre,
                plan_id=plan_obj.id,
                plan_resolucion=plan_obj.resolucion,
                anio=com.anio_lectivo,
                cuatrimestre=materia_obj.regimen,
                turno=com.turno.nombre if com.turno else "",
                codigo=com.codigo,
            )
        )

    if not docente_profile:
        inscripciones_libres = InscripcionMateriaAlumno.objects.filter(materia__plan_de_estudio=plan, comision__isnull=True)
        if materia_id:
            inscripciones_libres = inscripciones_libres.filter(materia_id=materia_id)
        if anio:
            inscripciones_libres = inscripciones_libres.filter(anio=anio)
        if cuatrimestre:
            inscripciones_libres = inscripciones_libres.filter(materia__regimen=cuatrimestre)

        libres_distintos = inscripciones_libres.values(
            "materia_id",
            "materia__nombre",
            "materia__regimen",
            "materia__formato",
            "anio",
        ).distinct()

        for row in libres_distintos:
            materia_row_id = row["materia_id"]
            materia_nombre = row["materia__nombre"]
            regimen = row["materia__regimen"]
            anio_row = row["anio"]
            comisiones_out.append(
                ComisionOption(
                    id=_virtual_comision_id(materia_row_id, anio_row),
                    materia_id=materia_row_id,
                    materia_nombre=materia_nombre,
                    profesorado_id=plan.profesorado_id,
                    profesorado_nombre=plan.profesorado.nombre,
                    plan_id=plan.id,
                    plan_resolucion=plan.resolucion,
                    anio=anio_row or 0,
                    cuatrimestre=regimen,
                    turno="Sin turno",
                    codigo="Sin comision",
                )
            )

    return CargaNotasLookup(materias=materias_out, comisiones=comisiones_out)


def _build_regularidad_alumnos(inscripciones) -> list[RegularidadAlumnoOut]:
    if not inscripciones:
        return []

    # Detectar materia y año para buscar correlativas caídas
    first_insc = inscripciones[0]
    materia_id = first_insc.materia_id
    anio_cursada = first_insc.anio
    
    # Buscar problemas de correlatividad para todos los alumnos de esta lista
    caidas_report = _check_correlativas_caidas(anio_cursada, materia_id=materia_id)
    
    # Map: estudiante_id -> lista de mensajes
    caidas_map = {}
    for item in caidas_report:
        est_id = item["estudiante_id"]
        if est_id not in caidas_map:
            caidas_map[est_id] = []
        msg = f"{item['materia_correlativa']}: {item['motivo']}"
        caidas_map[est_id].append(msg)

    alumnos: list[RegularidadAlumnoOut] = []
    for idx, insc in enumerate(inscripciones, start=1):
        regularidad = (
            Regularidad.objects.filter(
                inscripcion=insc,
            )
            .order_by("-fecha_cierre", "-id")
            .first()
        )

        alias = _alias_desde_situacion(regularidad.situacion) if regularidad else None
        alumnos.append(
            RegularidadAlumnoOut(
                inscripcion_id=insc.id,
                alumno_id=insc.estudiante_id,
                orden=idx,
                apellido_nombre=insc.estudiante.user.get_full_name() if insc.estudiante.user_id else "",
                dni=insc.estudiante.dni,
                nota_tp=float(regularidad.nota_trabajos_practicos)
                if regularidad and regularidad.nota_trabajos_practicos is not None
                else None,
                nota_final=regularidad.nota_final_cursada if regularidad else None,
                asistencia=regularidad.asistencia_porcentaje if regularidad else None,
                excepcion=regularidad.excepcion if regularidad else False,
                situacion=alias,
                observaciones=regularidad.observaciones if regularidad else None,
                correlativas_caidas=caidas_map.get(insc.estudiante_id, []),
            )
        )
    return alumnos


def _docente_to_string(docente: Docente | None) -> str | None:
    if not docente:
        return None
    apellido = (docente.apellido or "").strip()
    nombre = (docente.nombre or "").strip()
    if apellido and nombre:
        return f"{apellido}, {nombre}"
    return apellido or nombre or None


def _max_regularidad_fecha(inscripciones) -> date | None:
    inscripcion_ids = [insc.id for insc in inscripciones if getattr(insc, "id", None)]
    if not inscripcion_ids:
        return None
    aggregate = Regularidad.objects.filter(inscripcion_id__in=inscripcion_ids).aggregate(max_fecha=Max("fecha_cierre"))
    return aggregate.get("max_fecha")


@carga_notas_router.get(
    "/regularidad",
    response={200: RegularidadPlanillaOut, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def obtener_planilla_regularidad(request, comision_id: int):
    can_override_lock = _user_has_privileged_planilla_access(request.user)
    if comision_id >= 0:
        comision = (
            Comision.objects.select_related("materia__plan_de_estudio__profesorado", "turno", "docente")
            .filter(id=comision_id)
            .first()
        )
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")

        situaciones = _situaciones_para_formato(comision.materia.formato)
        materia = comision.materia
        plan = materia.plan_de_estudio if materia else None
        profesorado = plan.profesorado if plan else None

        inscripciones_qs = (
            InscripcionMateriaAlumno.objects.filter(
                comision_id=comision.id,
                anio=comision.anio_lectivo,
            )
            .select_related("estudiante__user", "materia")
            .order_by(
                "estudiante__user__last_name",
                "estudiante__user__first_name",
                "estudiante__dni",
            )
        )

        inscripciones = list(inscripciones_qs)
        alumnos = _build_regularidad_alumnos(inscripciones)
        turno_nombre = comision.turno.nombre if comision.turno else ""
        fecha_cierre = _max_regularidad_fecha(inscripciones)
        docente_principal = _docente_to_string(comision.docente)
        docentes = [docente_principal] if docente_principal else []
        lock = _regularidad_lock_for_scope(comision=comision)
        esta_cerrada = lock is not None

        return RegularidadPlanillaOut(
            materia_id=comision.materia_id,
            materia_nombre=comision.materia.nombre,
            materia_anio=materia.anio_cursada if materia else None,
            formato=comision.materia.formato,
            regimen=materia.regimen if materia else None,
            comision_id=comision.id,
            comision_codigo=comision.codigo,
            anio=comision.anio_lectivo,
            turno=turno_nombre,
            profesorado_id=profesorado.id if profesorado else None,
            profesorado_nombre=profesorado.nombre if profesorado else None,
            plan_id=plan.id if plan else None,
            plan_resolucion=plan.resolucion if plan else None,
            docentes=docentes,
            fecha_cierre=fecha_cierre,
            esta_cerrada=esta_cerrada,
            cerrada_en=lock.cerrado_en.isoformat() if lock else None,
            cerrada_por=_format_user_display(lock.cerrado_por) if lock else None,
            puede_editar=(not esta_cerrada) or can_override_lock,
            puede_cerrar=not esta_cerrada,
            puede_reabrir=esta_cerrada and can_override_lock,
            situaciones=situaciones,
            alumnos=alumnos,
        )

    materia_id, anio_virtual = _split_virtual_comision_id(comision_id)

    materia = Materia.objects.select_related("plan_de_estudio__profesorado").filter(id=materia_id).first()
    if not materia:
        return 404, ApiResponse(
            ok=False,
            message="Materia no encontrada para la comision virtual.",
        )

    situaciones = _situaciones_para_formato(materia.formato)

    inscripciones_qs = (
        InscripcionMateriaAlumno.objects.filter(
            materia_id=materia.id,
            comision__isnull=True,
        )
        .select_related("estudiante__user", "materia")
        .order_by(
            "estudiante__user__last_name",
            "estudiante__user__first_name",
            "estudiante__dni",
        )
    )
    if anio_virtual is not None:
        inscripciones_qs = inscripciones_qs.filter(anio=anio_virtual)

    inscripciones = list(inscripciones_qs)
    alumnos = _build_regularidad_alumnos(inscripciones)
    fecha_cierre = _max_regularidad_fecha(inscripciones)
    plan = materia.plan_de_estudio
    profesorado = plan.profesorado if plan else None
    lock_anio = anio_virtual if anio_virtual is not None else 0
    lock = _regularidad_lock_for_scope(materia=materia, anio_virtual=lock_anio)
    esta_cerrada = lock is not None

    return RegularidadPlanillaOut(
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        materia_anio=materia.anio_cursada,
        formato=materia.formato,
        regimen=materia.regimen,
        comision_id=comision_id,
        comision_codigo="Sin comision",
        anio=anio_virtual if anio_virtual is not None else date.today().year,
        turno="Sin turno",
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        plan_id=plan.id if plan else None,
        plan_resolucion=plan.resolucion if plan else None,
        docentes=[],
        fecha_cierre=fecha_cierre,
        esta_cerrada=esta_cerrada,
        cerrada_en=lock.cerrado_en.isoformat() if lock else None,
        cerrada_por=_format_user_display(lock.cerrado_por),
        puede_editar=(not esta_cerrada) or can_override_lock,
        puede_cerrar=not esta_cerrada,
        puede_reabrir=esta_cerrada and can_override_lock,
        situaciones=situaciones,
        alumnos=alumnos,
    )


@carga_notas_router.post(
    "/regularidad",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def guardar_planilla_regularidad(request, payload: RegularidadCargaIn = Body(...)):
    is_virtual = payload.comision_id < 0
    comision = None
    materia = None
    anio_virtual = None
    lock = None
    can_override_lock = _user_has_privileged_planilla_access(request.user)

    if is_virtual:
        materia_id, anio_virtual = _split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=materia_id).first()
        if not materia:
            return 404, ApiResponse(
                ok=False,
                message="Materia no encontrada para la comision virtual.",
            )
        lock_key = anio_virtual if anio_virtual is not None else 0
        lock = _regularidad_lock_for_scope(materia=materia, anio_virtual=lock_key)
    else:
        comision = Comision.objects.select_related("materia").filter(id=payload.comision_id).first()
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")
        materia = comision.materia
        lock = _regularidad_lock_for_scope(comision=comision)

        if not can_override_lock:
            # Verify if the user is the assigned teacher
            if not comision.docente:
                 return 403, ApiResponse(ok=False, message="La comisión no tiene docente asignado. Solo admin puede editar.")
            
            user_dni = getattr(request.user, "username", "")
            if comision.docente.dni != user_dni:
                 return 403, ApiResponse(ok=False, message="No tienes permiso para editar esta comisión.")

    if lock and not can_override_lock:
        return 403, ApiResponse(
            ok=False,
            message="La planilla ya fue cerrada. Solo secretaría o admin pueden modificarla.",
        )

    situaciones_validas = {item["alias"] for item in _situaciones_para_formato(materia.formato)}

    if not payload.alumnos:
        return 400, ApiResponse(ok=False, message="No se enviaron alumnos para guardar.")

    fecha = payload.fecha_cierre or date.today()

    with transaction.atomic():
        for alumno in payload.alumnos:
            if alumno.situacion not in situaciones_validas:
                return 400, ApiResponse(
                    ok=False,
                    message=f"Situacion '{alumno.situacion}' no permitida para el formato de la materia.",
                )

            situacion_codigo = ALIAS_TO_SITUACION.get(alumno.situacion)
            if not situacion_codigo:
                return 400, ApiResponse(ok=False, message=f"Situacion desconocida: {alumno.situacion}")

            if alumno.situacion == "PROMOCION" and alumno.nota_final is not None and alumno.nota_final < 8:
                return 400, ApiResponse(
                    ok=False,
                    message="La nota final debe ser >= 8 para registrar PROMOCION.",
                )

            inscripcion_qs = InscripcionMateriaAlumno.objects.filter(
                id=alumno.inscripcion_id,
            )

            if is_virtual:
                inscripcion_qs = inscripcion_qs.filter(
                    materia_id=materia.id,
                    comision__isnull=True,
                )
                if anio_virtual is not None:
                    inscripcion_qs = inscripcion_qs.filter(anio=anio_virtual)
            else:
                inscripcion_qs = inscripcion_qs.filter(comision_id=comision.id)

            inscripcion = inscripcion_qs.select_related("estudiante", "materia").first()

            if not inscripcion:
                if is_virtual:
                    message = f"Inscripcion {alumno.inscripcion_id} no corresponde a la materia sin comision."
                else:
                    message = f"Inscripcion {alumno.inscripcion_id} no pertenece a la comision."
                return 400, ApiResponse(ok=False, message=message)

            # --- NEW VALIDATION FOR EDI SUBJECTS AND INTRODUCTORY COURSE ---
            if materia.nombre.startswith("EDI: "):
                estudiante = inscripcion.estudiante
                try:
                    checklist = PreinscripcionChecklist.objects.get(preinscripcion__alumno=estudiante)
                    if not checklist.curso_introductorio_aprobado and situacion_codigo in [
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                        Regularidad.Situacion.REGULAR,
                    ]:
                            raise HttpError(
                                400,
                                f"El estudiante {estudiante.dni} no tiene el curso introductorio aprobado. "
                                f"La situación de la materia EDI '{materia.nombre}' no puede ser 'Aprobado', "
                                f"'Promocionado' o 'Regular'. Debe ser 'Condicional' o similar.",
                            )
                except PreinscripcionChecklist.DoesNotExist:
                    # If no checklist exists, assume introductory course is not approved for this validation
                    if situacion_codigo in [
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                        Regularidad.Situacion.REGULAR,
                    ]:
                        raise HttpError(
                            400,
                            (
                                f"El estudiante {estudiante.dni} no tiene un checklist de preinscripción. "
                                f"La situación de la materia EDI '{materia.nombre}' no puede ser 'Aprobado', "
                                f"'Promocionado' o 'Regular'."
                            ),
                        ) from None
            # --- END NEW VALIDATION ---

            Regularidad.objects.update_or_create(
                inscripcion=inscripcion,
                defaults={
                    "estudiante": inscripcion.estudiante,
                    "materia": inscripcion.materia,
                    "fecha_cierre": fecha,
                    "nota_trabajos_practicos": Decimal(str(alumno.nota_tp)) if alumno.nota_tp is not None else None,
                    "nota_final_cursada": alumno.nota_final,
                    "asistencia_porcentaje": alumno.asistencia,
                    "excepcion": alumno.excepcion,
                    "situacion": situacion_codigo,
                    "observaciones": alumno.observaciones or "",
                },
            )

    return ApiResponse(ok=True, message="Notas de regularidad guardadas correctamente.")


@carga_notas_router.post(
    "/regularidad/cierre",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def gestionar_regularidad_cierre(request, payload: RegularidadCierreIn = Body(...)):
    is_virtual = payload.comision_id < 0
    comision: Comision | None = None
    materia: Materia | None = None
    anio_virtual: int | None = None
    lock = None

    if is_virtual:
        materia_id, anio_virtual = _split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=materia_id).first()
        if not materia:
            return 404, ApiResponse(ok=False, message="Materia no encontrada para el cierre solicitado.")
        lock_key = anio_virtual if anio_virtual is not None else 0
        lock = _regularidad_lock_for_scope(materia=materia, anio_virtual=lock_key)
    else:
        comision = Comision.objects.filter(id=payload.comision_id).first()
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")
        lock = _regularidad_lock_for_scope(comision=comision)

    accion = payload.accion.lower()
    can_override = _user_has_privileged_planilla_access(request.user)

    if accion == "cerrar":
        if lock:
            return ApiResponse(ok=True, message="La planilla ya se encontraba cerrada.")
        RegularidadPlanillaLock.objects.create(
            comision=comision,
            materia=None if comision else materia,
            anio_virtual=None if comision else (anio_virtual if anio_virtual is not None else 0),
            cerrado_por=request.user if getattr(request.user, "is_authenticated", False) else None,
        )
        return ApiResponse(ok=True, message="Planilla cerrada correctamente.")

    if accion == "reabrir":
        if not can_override:
            return 403, ApiResponse(
                ok=False,
                message="Solo secretaría o admin pueden reabrir una planilla cerrada.",
            )
        if lock:
            lock.delete()
        return ApiResponse(ok=True, message="Planilla reabierta correctamente.")

    return 400, ApiResponse(ok=False, message="Accion de cierre no reconocida.")


def _get_inscripcion_mesa_or_404(mesa_id: int, inscripcion_id: int) -> InscripcionMesa:
    inscripcion = (
        InscripcionMesa.objects.select_related("mesa", "estudiante")
        .filter(id=inscripcion_id, mesa_id=mesa_id)
        .first()
    )
    if not inscripcion:
        raise HttpError(404, "La inscripcion indicada no pertenece a la mesa seleccionada.")
    return inscripcion


@carga_notas_router.get(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ActaOralSchema, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def obtener_acta_oral(request, mesa_id: int, inscripcion_id: int):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    acta: MesaActaOral | None = getattr(inscripcion, "acta_oral", None)
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta oral no registrada para el estudiante.")

    return ActaOralSchema(
        acta_numero=acta.acta_numero or None,
        folio_numero=acta.folio_numero or None,
        fecha=acta.fecha,
        curso=acta.curso or None,
        nota_final=acta.nota_final or None,
        observaciones=acta.observaciones or None,
        temas_alumno=acta.temas_alumno or [],
        temas_docente=acta.temas_docente or [],
    )


@carga_notas_router.post(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def guardar_acta_oral(request, mesa_id: int, inscripcion_id: int, payload: ActaOralSchema = Body(...)):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    temas_alumno = [
        {"tema": item.tema, "score": item.score}
        for item in (payload.temas_alumno or [])
        if item.tema
    ]
    temas_docente = [
        {"tema": item.tema, "score": item.score}
        for item in (payload.temas_docente or [])
        if item.tema
    ]

    MesaActaOral.objects.update_or_create(
        inscripcion=inscripcion,
        defaults={
            "mesa": inscripcion.mesa,
            "acta_numero": payload.acta_numero or "",
            "folio_numero": payload.folio_numero or "",
            "fecha": payload.fecha,
            "curso": payload.curso or "",
            "nota_final": payload.nota_final or "",
            "observaciones": payload.observaciones or "",
            "temas_alumno": temas_alumno,
            "temas_docente": temas_docente,
        },
    )

    return ApiResponse(ok=True, message="Acta oral guardada correctamente.")


@carga_notas_router.get(
    "/mesas/{mesa_id}/oral-actas",
    response={200: list[ActaOralListItemSchema], 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_actas_orales(request, mesa_id: int):
    mesa = MesaExamen.objects.filter(id=mesa_id).first()
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")

    actas = (
        MesaActaOral.objects.filter(mesa_id=mesa_id)
        .select_related("inscripcion__estudiante__user")
        .order_by(
            "inscripcion__estudiante__user__last_name",
            "inscripcion__estudiante__user__first_name",
        )
    )

    payload: list[ActaOralListItemSchema] = []
    for acta in actas:
        estudiante = acta.inscripcion.estudiante
        full_name = estudiante.user.get_full_name().strip() or f"{estudiante.user.last_name} {estudiante.user.first_name}".strip()
        payload.append(
            ActaOralListItemSchema(
                inscripcion_id=acta.inscripcion_id,
                alumno=full_name,
                dni=estudiante.dni,
                acta_numero=acta.acta_numero or None,
                folio_numero=acta.folio_numero or None,
                fecha=acta.fecha,
                curso=acta.curso or None,
                nota_final=acta.nota_final or None,
                observaciones=acta.observaciones or None,
                temas_alumno=acta.temas_alumno or [],
                temas_docente=acta.temas_docente or [],
            )
        )

    return payload


class ActaHeaderUpdateIn(Schema):
    fecha: date
    libro: str | None = None
    folio: str | None = None


@carga_notas_router.put(
    "/actas/{acta_id}/header",
    response={200: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria"])
def actualizar_cabecera_acta(request, acta_id: int, payload: ActaHeaderUpdateIn):
    """
    Permite corregir fecha, libro y folio de un Acta ya generada.
    Intenta actualizar también la Mesa de Examen asociada para mantener consistencia.
    """
    acta = ActaExamen.objects.filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    # 1. Buscar mesa asociada con los datos VIEJOS (antes de update)
    # Usamos la misma lógica de filtrado que en listar_actas
    mesa = MesaExamen.objects.filter(
        materia_id=acta.materia_id, 
        fecha=acta.fecha, 
        modalidad=acta.tipo
    ).first()

    # 2. Actualizar Acta
    acta.fecha = payload.fecha
    if payload.libro is not None:
        acta.libro = payload.libro
    if payload.folio is not None:
        acta.folio = payload.folio
    
    acta.save()

    # 3. Actualizar Mesa (si existe y fue encontrada)
    if mesa:
        mesa.fecha = payload.fecha
        mesa.save()

    return ApiResponse(ok=True, message="Cabecera del acta actualizada correctamente.")