"""
API para la gestión de la Estructura Académica (Carreras, Planes y Materias).
centraliza la administración de los profesorados, sus planes de estudio 
vigentes y la configuración detallada de cada materia.
"""

import logging
from typing import Optional
from django.shortcuts import get_object_or_404
from django.db.models import ProtectedError
from django.contrib.auth.models import User
from datetime import date
from ninja import Router, Schema
from ninja.errors import HttpError

logger = logging.getLogger(__name__)

from core.auth_ninja import JWTAuth
from core.models import (
    PlanDeEstudio, 
    Profesorado, 
    Materia, 
    InscripcionMateriaEstudiante, 
    Comision,
    ProfesoradoRequisitoDocumentacion
)
from core.permissions import (
    ensure_profesorado_access, 
    ensure_roles, 
    allowed_profesorados,
    get_user_roles,
)
from apps.common.errors import AppError
from apps.common.constants import AppErrorCode

from .schemas import (
    ProfesoradoIn, 
    ProfesoradoOut, 
    PlanDeEstudioIn, 
    PlanDeEstudioOut, 
    MateriaIn, 
    MateriaOut, 
    RequisitoDocumentacionOut,
    CerrarEDIIn,
)


class MateriaInscriptoOut(Schema):
    """Información simplificada de un estudiante inscrito en una materia."""
    id: int
    estudiante_id: int
    estudiante: str
    dni: str
    legajo: str | None = None
    estado: str
    anio: int
    comision_id: int | None = None
    comision_codigo: str | None = None


# Definición de roles con permisos de lectura sobre la estructura académica
STRUCTURE_VIEW_ROLES = {
    "admin", "secretaria", "bedel", "coordinador", "tutor", 
    "jefes", "jefa_aaee", "consulta", "estudiante",
}

# Definición de roles con capacidad de modificar carreras y planes (Backoffice)
STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}


def _require_view(user, profesorado_id: int | None = None) -> None:
    """Valida permisos de lectura global o sobre una carrera específica."""
    ensure_roles(user, STRUCTURE_VIEW_ROLES)
    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _require_edit(user, profesorado_id: int | None = None) -> None:
    """Valida permisos de escritura sobre la estructura académica."""
    ensure_roles(user, STRUCTURE_EDIT_ROLES)
    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _normalized_user_roles(user: User) -> set[str]:
    """Sincroniza y normaliza los nombres de grupos de Django a roles internos."""
    raw_names = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    roles = set(raw_names)
    # Mapeo de prefijos comunes a roles base
    for name in raw_names:
        if name.startswith("bedel"): roles.add("bedel")
        if name.startswith("secretaria"): roles.add("secretaria")
        if name.startswith("coordinador"): roles.add("coordinador")
        if "estudiante" in name: roles.add("estudiante")
        if "docente" in name: roles.add("docente")

    if user.is_superuser or user.is_staff:
        roles.add("admin")
    return roles


def _docente_from_user(user: User):
    """Acceso al perfil docente vinculado al usuario de sistema."""
    return getattr(user, "docente_perfil", None)


# Instanciación de routers para la segmentación de OpenAPI
profesorados_router = Router(tags=["Carreras"])
planes_router = Router(tags=["Planes de Estudio"])
materias_router = Router(tags=["Materias"])


# --- PROFESORADOS (CARRERAS) ---

@profesorados_router.get("/", response=list[ProfesoradoOut], auth=JWTAuth())
def listar_carreras(request, vigentes: bool | None = None):
    """
    Lista todos los profesorados disponibles.
    Aplica filtros de visibilidad basados en los permisos territoriales del usuario.
    """
    qs = Profesorado.objects.all().order_by("nombre")
    if getattr(request.user, "is_authenticated", False):
        _require_view(request.user)
        # Filtro de seguridad: solo carreras a las que el usuario tiene acceso
        allowed = allowed_profesorados(request.user)
        if allowed is not None:
            qs = qs.filter(id__in=allowed)
            
    if vigentes is not None:
        qs = qs.filter(activo=vigentes, inscripcion_abierta=vigentes)
    return qs


@profesorados_router.get("/{profesorado_id}", response=ProfesoradoOut, auth=JWTAuth())
def get_profesorado(request, profesorado_id: int):
    """Recupera la ficha técnica de un profesorado."""
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    _require_view(request.user, profesorado.id)
    return profesorado


@profesorados_router.post("/", response=ProfesoradoOut, auth=JWTAuth())
def crear_profesorado(request, payload: ProfesoradoIn):
    """Crea una nueva oferta académica (Profesorado / Carrera)."""
    _require_edit(request.user)
    profesorado = Profesorado.objects.create(**payload.dict())
    return profesorado


@profesorados_router.put("/{profesorado_id}", response=ProfesoradoOut, auth=JWTAuth())
def actualizar_profesorado(request, profesorado_id: int, payload: ProfesoradoIn):
    """Actualiza la configuración de una carrera existente."""
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    for attr, value in payload.dict().items():
        setattr(profesorado, attr, value)
    profesorado.save()
    return profesorado


@profesorados_router.delete("/{profesorado_id}", response={200: dict, 400: dict}, auth=JWTAuth())
def eliminar_profesorado(request, profesorado_id: int):
    """
    Elimina formalmente un profesorado.
    Falla si existen registros vinculados (Integridad de Referencia).
    """
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    try:
        profesorado.delete()
        return 200, {"success": True}
    except ProtectedError:
        raise HttpError(400, "No se puede eliminar la carrera: existen planes o alumnos asociados.")
    except Exception as e:
        logger.exception("Error eliminando profesorado %s", profesorado_id)
        raise HttpError(400, f"Error técnico al eliminar: {str(e)}")


@profesorados_router.get("/{profesorado_id}/planes", response=list[PlanDeEstudioOut], auth=JWTAuth())
def planes_por_profesorado(request, profesorado_id: int):
    """Busca los planes de estudio vigentes asociados a una carrera."""
    _require_view(request.user, profesorado_id)
    qs = PlanDeEstudio.objects.filter(
        profesorado_id=profesorado_id, 
        vigente=True
    ).order_by("-anio_inicio", "id")
    return list(qs)


@profesorados_router.post("/{profesorado_id}/planes", response=PlanDeEstudioOut, auth=JWTAuth())
def create_plan_for_profesorado(request, profesorado_id: int, payload: PlanDeEstudioIn):
    """Registra una nueva resolución ministerial / Plan de Estudio para la carrera."""
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, **payload.dict())
    return plan


@profesorados_router.get("/{profesorado_id}/requisitos-documentacion", response=list[RequisitoDocumentacionOut], auth=JWTAuth())
def listar_requisitos_documentacion(request, profesorado_id: int):
    """Lista los requisitos documentales (DNI, Títulos, etc) para el legajo de esta carrera."""
    _require_view(request.user, profesorado_id)
    qs = ProfesoradoRequisitoDocumentacion.objects.filter(profesorado_id=profesorado_id).order_by("orden")
    return list(qs)


# --- PLANES DE ESTUDIO ---

@planes_router.get("/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def get_plan(request, plan_id: int):
    """Obtiene el detalle de un plan de estudio y su vigencia."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_view(request.user, plan.profesorado_id)
    return plan


@profesorados_router.get("/planes/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth(), include_in_schema=False)
def obtener_plan_compatibilidad(request, plan_id: int):
    """Ruta de compatibilidad para el frontend que usa /profesorados/planes/{id}"""
    return get_plan(request, plan_id)


@planes_router.put("/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def update_plan(request, plan_id: int, payload: PlanDeEstudioIn):
    """Modifica la configuración de un plan de estudio."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    for attr, value in payload.dict().items():
        setattr(plan, attr, value)
    plan.save()
    return plan


@planes_router.delete("/{plan_id}", response={204: None}, auth=JWTAuth())
def delete_plan(request, plan_id: int):
    """Eliminación lógica (vigente=False) de un plan de estudio."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    plan.vigente = False
    plan.save(update_fields=["vigente"])
    return 204, None


@planes_router.get("/{plan_id}/materias", response=list[MateriaOut], auth=JWTAuth())
def list_materias_for_plan(
    request,
    plan_id: int,
    anio_cursada: int | None = None,
    nombre: str | None = None,
    formato: str | None = None,
    regimen: str | None = None,
    tipo_formacion: str | None = None,
    incluir_historial: bool = False,
):
    """Lista la malla curricular (materias) de un plan con filtros avanzados."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_view(request.user, plan.profesorado_id)
    materias = plan.materias.all()

    # Filtrado por vigencia temporal (por defecto solo activos)
    if not incluir_historial:
        hoy = date.today()
        # Excluir los que ya vencieron
        materias = materias.exclude(fecha_fin__lt=hoy)
        # Excluir los que aún no empezaron
        materias = materias.exclude(fecha_inicio__gt=hoy)

    # Aplicación de filtros según metadata de la materia
    if anio_cursada is not None: materias = materias.filter(anio_cursada=anio_cursada)
    if nombre: materias = materias.filter(nombre__icontains=nombre)
    if formato: materias = materias.filter(formato=formato)
    if regimen: materias = materias.filter(regimen=regimen)
    if tipo_formacion: materias = materias.filter(tipo_formacion=tipo_formacion)

    return materias


@planes_router.post("/{plan_id}/materias", response=MateriaOut, auth=JWTAuth())
def create_materia_for_plan(request, plan_id: int, payload: MateriaIn):
    """Añade una asignatura al diseño curricular del plan."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    if payload.plan_de_estudio_id != plan_id:
        raise HttpError(400, "Inconsistencia: el ID del plan en el payload no coincide con la URL.")
    materia = Materia.objects.create(plan_de_estudio=plan, **payload.dict())
    return materia


# --- MATERIAS ---

@materias_router.get("/", response=list[MateriaOut], auth=JWTAuth())
def listar_materias(
    request, 
    search: str | None = None, 
    profesorado_id: int | None = None,
    solo_activos: bool = False,
    incluir_edis_cerrados: bool = False
):
    """Buscador global de materias con filtros."""
    _require_view(request.user)
    
    # Filtro de seguridad: solo materias de carreras permitidas para el usuario
    allowed = allowed_profesorados(request.user)
    qs = Materia.objects.select_related('plan_de_estudio').all()
    
    if allowed is not None:
        if profesorado_id:
            # Si pide uno, debe estar entre sus permitidos
            if profesorado_id in allowed:
                qs = qs.filter(plan_de_estudio__profesorado_id=profesorado_id)
            else:
                return []
        else:
            # Si no pide uno, solo mostramos de SUS permitidos
            qs = qs.filter(plan_de_estudio__profesorado_id__in=allowed)
    elif profesorado_id:
        # Admins sin restricciones que filtran por uno
        qs = qs.filter(plan_de_estudio__profesorado_id=profesorado_id)

    if search:
        qs = qs.filter(nombre__icontains=search)
    
    if solo_activos:
        qs = qs.exclude(fecha_fin__lt=date.today())

    if not incluir_edis_cerrados:
        qs = qs.exclude(is_edi=True, fecha_fin__isnull=False)
        
    return qs[:500]

@materias_router.get("/{materia_id}", response=MateriaOut, auth=JWTAuth())
def get_materia(request, materia_id: int):
    """Consulta los datos técnicos de una materia."""
    materia = get_object_or_404(Materia, id=materia_id)
    _require_view(request.user, materia.plan_de_estudio.profesorado_id)
    return materia


@materias_router.put("/{materia_id}", response=MateriaOut, auth=JWTAuth())
def update_materia(request, materia_id: int, payload: MateriaIn):
    """Modifica la configuración de una materia (Carga horaria, régimen, etc)."""
    materia = get_object_or_404(Materia, id=materia_id)
    _require_edit(request.user, materia.plan_de_estudio.profesorado_id)
    for attr, value in payload.dict().items():
        setattr(materia, attr, value)
    materia.save()
    return materia


@materias_router.delete("/{materia_id}", response={204: None}, auth=JWTAuth())
def delete_materia(request, materia_id: int):
    """Elimina una materia del plan (Solo permitido si no hay actas/inscriptos)."""
    materia = get_object_or_404(Materia, id=materia_id)
    _require_edit(request.user, materia.plan_de_estudio.profesorado_id)
    materia.delete()
    return 204, None


@materias_router.post("/{materia_id}/cerrar-edi", response=MateriaOut, auth=JWTAuth())
def cerrar_edi(request, materia_id: int, payload: CerrarEDIIn):
    """
    Cierra un EDI vigente y crea uno nuevo.

    Lógica:
    1. Valida que sea un EDI (is_edi=True)
    2. Valida que no esté ya cerrado (fecha_fin=None)
    3. Cierra el EDI viejo: materia_vieja.fecha_fin = fecha_fin
    4. Crea EDI nuevo: copia todos los campos menos nombre/año/régimen
    5. Retorna el EDI nuevo creado
    """
    materia_vieja = get_object_or_404(Materia, id=materia_id)
    _require_edit(request.user, materia_vieja.plan_de_estudio.profesorado_id)

    # Validaciones
    if not materia_vieja.is_edi:
        raise HttpError(400, "Solo se pueden cerrar EDIs (is_edi=True)")
    if materia_vieja.fecha_fin is not None:
        raise HttpError(400, f"Este EDI ya fue cerrado el {materia_vieja.fecha_fin}")

    # Parsear fecha
    try:
        fecha_fin = date.fromisoformat(payload.fecha_fin)
    except ValueError:
        raise HttpError(400, "Formato de fecha inválido. Use YYYY-MM-DD")

    # Cerrar EDI viejo
    materia_vieja.fecha_fin = fecha_fin
    materia_vieja.save()

    # Crear EDI nuevo
    materia_nueva = Materia.objects.create(
        plan_de_estudio=materia_vieja.plan_de_estudio,
        nombre=payload.nuevo_nombre,
        anio_cursada=payload.nuevo_anio_cursada,
        horas_semana=materia_vieja.horas_semana,
        formato=materia_vieja.formato,
        regimen=payload.nuevo_regimen,
        tipo_formacion=materia_vieja.tipo_formacion,
        is_edi=True,
        fecha_fin=None,  # El nuevo está activo
    )

    logger.info(f"EDI #{materia_vieja.id} cerrado. EDI #{materia_nueva.id} creado")
    return materia_nueva


@materias_router.get("/{materia_id}/inscriptos", response=list[MateriaInscriptoOut], auth=JWTAuth())
def list_inscriptos_materia(request, materia_id: int, anio: int | None = None, estado: str | None = None):
    """
    Lista los alumnos inscritos en una materia para un ciclo lectivo.
    
    Lógica de permisos especial:
    - Perfil administrativo: Ve todos los inscritos del profesorado.
    - Perfil Docente: Solo ve los alumnos de sus propias comisiones asignadas.
    """
    materia = get_object_or_404(Materia, id=materia_id)
    roles = get_user_roles(request.user)
    docente_profile = _docente_from_user(request.user)

    solo_docente = False
    # Verificamos si es un docente sin acceso administrativo
    if "docente" in roles and not (roles & STRUCTURE_VIEW_ROLES):
        if not docente_profile:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "Perfil docente no vinculado.")
        
        asignado = Comision.objects.filter(materia_id=materia_id, docente=docente_profile).exists()
        if not asignado:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No posees comisiones en esta asignatura.")
        solo_docente = True
    else:
        # Validación estándar de gestión académica
        _require_view(request.user, materia.plan_de_estudio.profesorado_id)

    # Consulta optimizada con select_related para evitar N+1
    inscripciones = InscripcionMateriaEstudiante.objects.select_related(
        "estudiante__user", "estudiante__persona", "comision"
    ).filter(materia_id=materia_id)

    if solo_docente:
        inscripciones = inscripciones.filter(comision__docente=docente_profile)
    if anio is not None:
        inscripciones = inscripciones.filter(anio=anio)
    if estado:
        inscripciones = inscripciones.filter(estado=estado)

    # Formateo del resultado para la UI
    resultado: list[MateriaInscriptoOut] = []
    for ins in inscripciones.order_by("estudiante__persona__apellido", "estudiante__persona__nombre"):
        est = ins.estudiante
        nombre_completo = est.user.get_full_name() if est.user else est.dni
        resultado.append(MateriaInscriptoOut(
            id=ins.id, 
            estudiante_id=est.id, 
            estudiante=nombre_completo, 
            dni=est.dni,
            legajo=est.legajo, 
            estado=ins.estado, 
            anio=ins.anio,
            comision_id=ins.comision_id,
            comision_codigo=ins.comision.codigo if ins.comision_id else None,
        ))
    return resultado
