from typing import List
import string
from datetime import date, datetime, time

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Case, CharField, Count, F, Prefetch, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import File, Form, Query, Router, Schema, Field
from ninja.errors import HttpError
from ninja.files import UploadedFile

from apps.common.api_schemas import ApiResponse
from .schemas import UserSchema, AsignarRolIn
from core.auth_ninja import JWTAuth
from core.models import (
    Bloque,
    Comision,
    Conversation,
    ConversationAudit,
    ConversationParticipant,
    Correlatividad,
    CorrelatividadVersion,
    CorrelatividadVersionDetalle,
    Docente,
    Estudiante,
    HorarioCatedra,
    HorarioCatedraDetalle,
    InscripcionMateriaEstudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Message,
    MessageTopic,
    PedidoAnalitico,
    PlanDeEstudio,
    Preinscripcion,
    Profesorado,
    Regularidad,
    StaffAsignacion,
    Turno,
    VentanaHabilitacion,
)
from core.permissions import (
    allowed_profesorados,
    ensure_profesorado_access,
    ensure_roles,
)

STRUCTURE_VIEW_ROLES = {
    "admin",
    "secretaria",
    "bedel",
    "coordinador",
    "tutor",
    "jefes",
    "jefa_aaee",
    "consulta",
}

STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}

ACADEMIC_MANAGE_ROLES = {"admin", "secretaria", "bedel"}

ACADEMIC_VIEW_ROLES = STRUCTURE_VIEW_ROLES | {"tutor"}

VENTANA_VIEW_ROLES = STRUCTURE_VIEW_ROLES | {"tutor", "estudiante"}

PREINS_GESTION_ROLES = {"admin", "secretaria", "bedel"}

GLOBAL_OVERVIEW_ROLES = {
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador",
    "consulta",
}

SLA_WARNING_DAYS = getattr(settings, "MESSAGES_SLA_WARNING_DAYS", 3)
SLA_DANGER_DAYS = getattr(settings, "MESSAGES_SLA_DANGER_DAYS", 6)

ROLE_MASS_RULES: dict[str, set[str] | None] = {
    "admin": None,
    "secretaria": None,
    "jefa_aaee": None,
    "jefes": None,
    "coordinador": {"estudiante", "docente"},
    "tutor": {"estudiante"},
    "bedel": {"estudiante"},
}

ROLES_DIRECT_ALL = {
    "admin",
    "secretaria",
    "jefa_aaee",
    "jefes",
    "coordinador",
    "tutor",
    "bedel",
}
ROLES_FORBIDDEN_SENDER = set()

ROLE_STAFF_ASSIGNMENT = {
    "bedel": {"bedel"},
    "tutor": {"tutor"},
    "coordinador": {"coordinador"},
}

ALL_ROLES: set[str] = {
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador",
    "consulta",
}

ROLE_ASSIGN_MATRIX: dict[str, list[str]] = {
    "admin": list(ALL_ROLES),
    "secretaria": [role for role in ALL_ROLES if role != "admin"],
    "jefa_aaee": ["bedel", "tutor", "coordinador"],
    "jefes": [],
    "tutor": [],
    "bedel": [],
    "coordinador": [],
    "consulta": [],
}


def _normalized_user_roles(user: User) -> set[str]:
    raw_roles = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    roles = set(raw_roles)
    if "estudiantes" in raw_roles:
        roles.add("estudiante")
    if user.is_superuser or user.is_staff:
        roles.add("admin")
    return roles


def _docente_from_user(user) -> Docente | None:
    if not user or not user.is_authenticated:
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


def _assignable_roles_for_user(user: User) -> set[str]:
    if user.is_superuser or user.is_staff:
        return set(ALL_ROLES)
    assignable: set[str] = set()
    for role in _normalized_user_roles(user):
        assignable.update(ROLE_ASSIGN_MATRIX.get(role, []))
    return assignable


def _get_user_for_docente(docente: Docente) -> User | None:
    candidates = [docente.dni]
    if docente.email:
        candidates.append(docente.email)
    for candidate in candidates:
        if not candidate:
            continue
        user = User.objects.filter(username__iexact=candidate).first()
        if user:
            return user
        user = User.objects.filter(email__iexact=candidate).first()
        if user:
            return user
    return None


def _ensure_user_for_docente(docente: Docente) -> tuple[User, bool, str | None]:
    """
    Garantiza que exista un usuario para el docente.
    - Username: DNI
    - Password inicial: pass + DNI
    """
    existing = _get_user_for_docente(docente)
    if existing:
        updated = False
        update_fields: list[str] = []
        email = docente.email or ""
        first_name = docente.nombre or ""
        last_name = docente.apellido or ""
        if existing.email != email:
            existing.email = email
            update_fields.append("email")
        if existing.first_name != first_name:
            existing.first_name = first_name
            update_fields.append("first_name")
        if existing.last_name != last_name:
            existing.last_name = last_name
            update_fields.append("last_name")
        if update_fields:
            existing.save(update_fields=update_fields)
        return existing, False, None

    dni = (docente.dni or "").strip()
    if not dni:
        raise HttpError(400, "El docente no tiene DNI cargado; no podemos generar un usuario.")

    username = dni
    temp_password = f"pass{dni}"
    user = User.objects.create_user(
        username=username,
        password=temp_password,
        email=docente.email or "",
        first_name=docente.nombre or "",
        last_name=docente.apellido or "",
    )
    return user, True, temp_password


def _ensure_docente_group(user: User):
    group, _ = Group.objects.get_or_create(name="docente")
    user.groups.add(group)


def _user_display(user: User) -> str:
    full_name = (user.get_full_name() or "").strip()
    return full_name or user.get_username()


def _staff_profesorados(user: User, roles: set[str] | None = None) -> set[int]:
    qs = StaffAsignacion.objects.filter(user=user)
    if roles:
        qs = qs.filter(rol__in=roles)
    return set(qs.values_list("profesorado_id", flat=True))


def _student_profesorados(student: Estudiante) -> set[int]:
    return set(student.carreras.values_list("id", flat=True))


def _get_student(user: User) -> Estudiante | None:
    try:
        return user.estudiante
    except Estudiante.DoesNotExist:
        return None


def _serialize_docente(docente: Docente, temp_password: str | None = None) -> "DocenteOut":
    user = _get_user_for_docente(docente)
    return DocenteOut(
        id=docente.id,
        nombre=docente.nombre,
        apellido=docente.apellido,
        dni=docente.dni,
        email=docente.email,
        telefono=docente.telefono,
        cuil=docente.cuil,
        usuario=user.username if user else None,
        temp_password=temp_password,
    )


def _get_staff_for_student(student: Estudiante, role: str) -> set[User]:
    profes = _student_profesorados(student)
    if not profes:
        return set()
    qs = StaffAsignacion.objects.filter(
        profesorado_id__in=profes,
        rol=role,
    ).select_related("user")
    return {assignment.user for assignment in qs if assignment.user and assignment.user.is_active}


def _shared_profesorado(staff_user: User, student: Estudiante, roles: set[str]) -> bool:
    staff_prof = _staff_profesorados(staff_user, roles)
    if not staff_prof:
        return False
    return bool(staff_prof.intersection(_student_profesorados(student)))


def _allowed_mass_roles(sender_roles: set[str]) -> set[str] | None:
    roles: set[str] = set()
    allow_all = False
    for role in sender_roles:
        if role in ROLE_MASS_RULES:
            rule = ROLE_MASS_RULES[role]
            if rule is None:
                allow_all = True
            else:
                roles.update(rule)
    if allow_all:
        return None
    return roles


def _can_send_individual(sender: User, target: User) -> bool:
    if sender == target:
        return False
    sender_roles = _normalized_user_roles(sender)
    if sender_roles & ROLES_FORBIDDEN_SENDER:
        return False
    target_roles = _normalized_user_roles(target)
    # Admins/secretaría/jefes/etc pueden escribir a cualquiera
    if sender_roles & ROLES_DIRECT_ALL:
        if "estudiante" in target_roles:
            student = _get_student(target)
            if not student:
                return False
            if sender_roles & {"bedel"}:
                return _shared_profesorado(sender, student, {"bedel"})
            if sender_roles & {"coordinador"}:
                staff_ok = _shared_profesorado(sender, student, {"coordinador"})
                return staff_ok if staff_ok or _staff_profesorados(sender, {"coordinador"}) else True
            if sender_roles & {"tutor"}:
                return _shared_profesorado(sender, student, {"tutor"})
        return True
    # Estudiantes: solo con bedel/tutor asignado
    if "estudiante" in sender_roles:
        student = _get_student(sender)
        if not student:
            return False
        if not (target_roles & {"bedel", "tutor"}):
            return False
        allowed_users = set()
        allowed_users.update(_get_staff_for_student(student, "bedel"))
        allowed_users.update(_get_staff_for_student(student, "tutor"))
        return target in allowed_users
    # Otros roles (preinscripciones, consulta, etc) no pueden iniciar
    return False


def _get_users_by_role(role: str, limit_profesorados: set[int] | None) -> list[User]:
    """
    Obtiene una lista de usuarios activos para un rol determinado, opcionalmente
    filtrados por un conjunto de profesorados.
    """
    users_qs = User.objects.filter(is_active=True)

    if role == "estudiante":
        student_qs = Estudiante.objects.filter(user__in=users_qs)
        if limit_profesorados:
            student_qs = student_qs.filter(carreras__id__in=limit_profesorados)
        # Get the user IDs from the filtered students
        user_ids = student_qs.values_list("user_id", flat=True).distinct()
        return list(User.objects.filter(id__in=user_ids))

    # For staff roles that are managed via StaffAsignacion
    if role in ROLE_STAFF_ASSIGNMENT:
        assignments = StaffAsignacion.objects.filter(rol=role)
        if limit_profesorados:
            assignments = assignments.filter(profesorado_id__in=limit_profesorados)
        user_ids = assignments.values_list("user_id", flat=True).distinct()
        return list(User.objects.filter(id__in=user_ids))

    # For other roles, filter by group name
    return list(users_qs.filter(groups__name__iexact=role).distinct())


def _resolve_mass_recipients(sender: User, role: str, carreras: list[int] | None) -> list[User]:
    role = role.lower()
    sender_roles = _normalized_user_roles(sender)
    allowed_roles = _allowed_mass_roles(sender_roles)
    if allowed_roles is not None and role not in allowed_roles:
        raise HttpError(403, "No tienes permisos para enviar mensajes masivos a ese rol.")
    limit_profesorados: set[int] | None = None
    if role == "estudiante":
        if sender_roles & {"bedel"}:
            limit_profesorados = _staff_profesorados(sender, {"bedel"})
            if not limit_profesorados:
                raise HttpError(
                    403,
                    "No tienes carreras asignadas para enviar mensajes a estudiantes.",
                )
        elif sender_roles & {"tutor"}:
            limit_profesorados = _staff_profesorados(sender, {"tutor"})
        elif sender_roles & {"coordinador"}:
            limit_profesorados = _staff_profesorados(sender, {"coordinador"}) or None
        if carreras:
            carreras_set = set(carreras)
            if limit_profesorados is not None:
                limit_profesorados = limit_profesorados.intersection(carreras_set)
                if not limit_profesorados:
                    raise HttpError(
                        403,
                        "Las carreras seleccionadas no coinciden con tus asignaciones.",
                    )
            else:
                limit_profesorados = carreras_set
    elif carreras and role in ROLE_STAFF_ASSIGNMENT:
        limit_profesorados = set(carreras)
    users = _get_users_by_role(role, limit_profesorados)
    return [u for u in users if u != sender]


def _conversation_allow_student_reply(
    is_massive: bool, recipients_roles: set[str], payload_flag: bool | None
) -> bool:
    if payload_flag is not None:
        return payload_flag
    return not (is_massive and "estudiante" in recipients_roles)


def _compute_sla_indicator(conversation: Conversation, participant: ConversationParticipant) -> str | None:
    last_message = getattr(conversation, "_last_message", None)
    if not last_message:
        last_message = conversation.messages.order_by("-created_at").first()
        conversation._last_message = last_message
    if not last_message:
        return None
    if last_message.author_id == participant.user_id:
        return None
    if participant.last_read_at and participant.last_read_at >= last_message.created_at:
        return None
    delta_days = (timezone.now() - last_message.created_at).days
    if delta_days >= SLA_DANGER_DAYS:
        return "danger"
    if delta_days >= SLA_WARNING_DAYS:
        return "warning"
    return None


def _conversation_unread(conversation: Conversation, participant: ConversationParticipant) -> bool:
    if not conversation.last_message_at:
        return False
    return not (participant.last_read_at and participant.last_read_at >= conversation.last_message_at)


def _get_conversation_topic(conversation: Conversation) -> str | None:
    if conversation.topic:
        return conversation.topic.name

    return None


def _primary_role(user: User) -> str | None:
    roles = _normalized_user_roles(user)

    if not roles:
        return None

    ROLE_PRIORITY = [
        "admin",
        "secretaria",
        "jefa_aaee",
        "jefes",
        "coordinador",
        "tutor",
        "bedel",
        "consulta",
        "docente",
        "estudiante",
    ]

    for role in ROLE_PRIORITY:
        if role in roles:
            return role

    return sorted(roles)[0]


def _create_conversation(
    *,
    sender: User,
    recipient: User,
    subject: str | None,
    topic: MessageTopic | None,
    body: str,
    allow_student_reply: bool,
    context_type: str | None,
    context_id: str | None,
    is_massive: bool,
) -> Conversation:
    conversation = Conversation.objects.create(
        topic=topic,
        created_by=sender,
        subject=subject or "",
        context_type=context_type,
        context_id=context_id,
        status=Conversation.Status.OPEN,
        is_massive=is_massive,
        allow_student_reply=allow_student_reply,
    )
    now = timezone.now()
    ConversationParticipant.objects.create(
        conversation=conversation,
        user=sender,
        role_snapshot=_primary_role(sender) or "",
        can_reply=True,
        last_read_at=now,
    )
    recipient_roles = _normalized_user_roles(recipient)
    recipient_can_reply = True
    if "estudiante" in recipient_roles and not allow_student_reply:
        recipient_can_reply = False
    ConversationParticipant.objects.create(
        conversation=conversation,
        user=recipient,
        role_snapshot=_primary_role(recipient) or "",
        can_reply=recipient_can_reply,
    )
    message = Message.objects.create(
        conversation=conversation,
        author=sender,
        body=body,
    )
    conversation.last_message_at = message.created_at
    conversation.updated_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    conversation._last_message = message
    return conversation


def _add_message(
    conversation: Conversation,
    author: User,
    body: str,
    attachment: UploadedFile | None = None,
) -> Message:
    if conversation.status == Conversation.Status.CLOSED:
        raise HttpError(400, "La conversación está cerrada.")
    message_kwargs = {
        "conversation": conversation,
        "author": author,
        "body": body,
    }
    if attachment is not None:
        message_kwargs["attachment"] = attachment
    message = Message.objects.create(**message_kwargs)
    conversation.last_message_at = message.created_at
    conversation.updated_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    conversation._last_message = message
    participant = conversation.participants.filter(user=author).first()
    if participant:
        participant.last_read_at = message.created_at
        participant.save(update_fields=["last_read_at"])
    return message


def _ensure_structure_view(user, profesorado_id: int | None = None) -> None:
    ensure_roles(user, STRUCTURE_VIEW_ROLES)

    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _ensure_structure_edit(user, profesorado_id: int | None = None) -> None:
    ensure_roles(user, STRUCTURE_EDIT_ROLES)

    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _ensure_academic_manage(user, profesorado_id: int | None = None) -> None:
    ensure_roles(user, ACADEMIC_MANAGE_ROLES)

    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _ensure_academic_view(user, profesorado_id: int | None = None) -> None:
    ensure_roles(user, ACADEMIC_VIEW_ROLES)

    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


router = Router()


# Schemas for PlanDeEstudio


class PlanDeEstudioIn(Schema):
    resolucion: str

    anio_inicio: int

    anio_fin: int | None = None

    vigente: bool = True


class PlanDeEstudioOut(Schema):
    id: int

    profesorado_id: int

    resolucion: str

    anio_inicio: int

    anio_fin: int | None

    vigente: bool


@router.get("/planes/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def get_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    ensure_roles(request.user, {"admin", "secretaria", "bedel", "tutor", "jefes", "jefa_aaee"})
    ensure_profesorado_access(request.user, plan.profesorado_id)
    return plan


# Schemas for Materia


class MateriaIn(Schema):
    plan_de_estudio_id: int

    anio_cursada: int

    nombre: str

    horas_semana: int  # Changed from carga_horaria_semanal

    formato: str

    regimen: str  # Changed from tipo_cursada

    tipo_formacion: str = Materia.TipoFormacion.FORMACION_GENERAL


def _compatible_cuatrimestres(valor: str | None):
    """Devuelve el conjunto de valores de cuatrimestre/regimen que deben considerarse

    compatibles para detectar superposiciones.



    - ANUAL se superpone con todo (ANU, 1C, 2C)

    - 1C se cruza solo con ANUAL y 1C

    - 2C se cruza solo con ANUAL y 2C

    - None (no especificado) se asume como anual.

    """
    v = (valor or "ANU").upper()

    if v == "ANU":
        return ["ANU", "PCU", "SCU", None]

    if v == "PCU" or v == "1C":
        return ["ANU", "PCU", "1C", None]

    if v == "SCU" or v == "2C":
        return ["ANU", "SCU", "2C", None]
    return ["ANU", v, None]


def _es_taller_residencia(materia: Materia) -> bool:
    nombre = (materia.nombre or "").lower()
    return "taller" in nombre and "residencia" in nombre


class MateriaOut(Schema):
    id: int

    plan_de_estudio_id: int

    anio_cursada: int

    nombre: str

    horas_semana: int  # Changed from carga_horaria_semanal

    formato: str

    regimen: str  # Changed from tipo_cursada

    tipo_formacion: str


class MateriaInscriptoOut(Schema):
    id: int
    estudiante_id: int
    estudiante: str
    dni: str
    legajo: str | None = None
    estado: str
    anio: int
    comision_id: int | None = None
    comision_codigo: str | None = None


# Materia Endpoints


@router.get("/planes/{plan_id}/materias", response=list[MateriaOut], auth=JWTAuth())
def list_materias_for_plan(
    request,
    plan_id: int,
    anio_cursada: int | None = None,
    nombre: str | None = None,
    formato: str | None = None,
    regimen: str | None = None,
    tipo_formacion: str | None = None,
):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)

    _ensure_structure_view(request.user, plan.profesorado_id)

    materias = plan.materias.all()

    if anio_cursada is not None:
        materias = materias.filter(anio_cursada=anio_cursada)

    if nombre is not None:
        materias = materias.filter(nombre__icontains=nombre)  # Case-insensitive contains

    if formato is not None:
        materias = materias.filter(formato=formato)

    if regimen is not None:
        materias = materias.filter(regimen=regimen)

    if tipo_formacion is not None:
        materias = materias.filter(tipo_formacion=tipo_formacion)

    return materias


@router.post("/planes/{plan_id}/materias", response=MateriaOut, auth=JWTAuth())
def create_materia_for_plan(request, plan_id: int, payload: MateriaIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)

    _ensure_structure_edit(request.user, plan.profesorado_id)

    # Ensure the materia is associated with the correct plan_id from the URL

    if payload.plan_de_estudio_id != plan_id:
        raise HttpError(400, "plan_de_estudio_id in payload must match plan_id in URL")

    materia = Materia.objects.create(plan_de_estudio=plan, **payload.dict())

    return materia


@router.get("/materias/{materia_id}", response=MateriaOut, auth=JWTAuth())
def get_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)

    _ensure_structure_view(request.user, materia.plan_de_estudio.profesorado_id)

    return materia


@router.get(
    "/materias/{materia_id}/inscriptos",
    response=list[MateriaInscriptoOut],
    auth=JWTAuth(),
)
def list_inscriptos_materia(
    request,
    materia_id: int,
    anio: int | None = None,
    estado: str | None = None,
):
    materia = get_object_or_404(Materia, id=materia_id)

    roles = _normalized_user_roles(request.user)
    docente_profile = _docente_from_user(request.user)

    solo_docente = False
    if "docente" in roles:
        if not docente_profile:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tienes comisiones asignadas.")
        asignado = Comision.objects.filter(materia_id=materia_id, docente=docente_profile).exists()
        if not asignado:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tienes comisiones asignadas a esta materia.")
        solo_docente = True
    else:
        _ensure_structure_view(request.user, materia.plan_de_estudio.profesorado_id)

    inscripciones = InscripcionMateriaEstudiante.objects.select_related("estudiante__user", "comision").filter(
        materia_id=materia_id
    )

    if solo_docente:
        inscripciones = inscripciones.filter(comision__docente=docente_profile)

    if anio is not None:
        inscripciones = inscripciones.filter(anio=anio)
    if estado:
        inscripciones = inscripciones.filter(estado=estado)

    resultado: list[MateriaInscriptoOut] = []
    for inscripcion in inscripciones.order_by(
        "estudiante__user__last_name",
        "estudiante__user__first_name",
        "estudiante__dni",
    ):
        estudiante = inscripcion.estudiante
        user = getattr(estudiante, "user", None)
        nombre = user.get_full_name() if user and user.get_full_name() else estudiante.dni
        resultado.append(
            MateriaInscriptoOut(
                id=inscripcion.id,
                estudiante_id=estudiante.id,
                estudiante=nombre,
                dni=estudiante.dni,
                legajo=estudiante.legajo,
                estado=inscripcion.estado,
                anio=inscripcion.anio,
                comision_id=inscripcion.comision_id,
                comision_codigo=inscripcion.comision.codigo if inscripcion.comision_id else None,
            )
        )

    return resultado


@router.put("/materias/{materia_id}", response=MateriaOut, auth=JWTAuth())
def update_materia(request, materia_id: int, payload: MateriaIn):
    materia = get_object_or_404(Materia, id=materia_id)

    _ensure_structure_edit(request.user, materia.plan_de_estudio.profesorado_id)

    for attr, value in payload.dict().items():
        setattr(materia, attr, value)

    materia.save()

    return materia


@router.delete("/materias/{materia_id}", response={204: None}, auth=JWTAuth())
def delete_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)

    _ensure_structure_edit(request.user, materia.plan_de_estudio.profesorado_id)

    materia.delete()

    return 204, None


# Schemas for Mensajería


class ConversationParticipantOut(Schema):
    id: int
    user_id: int
    name: str
    roles: list[str]
    can_reply: bool
    last_read_at: datetime | None


class MessageOut(Schema):
    id: int
    author_id: int | None
    author_name: str
    body: str
    created_at: datetime
    attachment_url: str | None
    attachment_name: str | None


class ConversationSummaryOut(Schema):
    id: int
    subject: str
    topic: str | None
    status: str
    is_massive: bool
    allow_student_reply: bool
    last_message_at: datetime | None
    unread: bool
    sla: str | None
    participants: list[ConversationParticipantOut]
    last_message_excerpt: str | None


class ConversationDetailOut(ConversationSummaryOut):
    messages: list[MessageOut]


class ConversationCreateIn(Schema):
    subject: str | None = None
    topic_id: int | None = None
    body: str
    recipients: list[int] | None = None
    roles: list[str] | None = None
    carreras: list[int] | None = None
    allow_student_reply: bool | None = None
    context_type: str | None = None
    context_id: str | None = None


class ConversationCreateOut(Schema):
    created_ids: list[int]
    total_recipients: int


class ConversationListQuery(Schema):
    status: str | None = None
    topic_id: int | None = None
    unread: bool | None = False


class ConversationCountsOut(Schema):
    unread: int
    sla_warning: int
    sla_danger: int


class SimpleProfesoradoOut(Schema):
    id: int
    nombre: str


class SimpleOk(Schema):
    success: bool = True


class MessageTopicOut(Schema):
    id: int
    slug: str
    name: str
    description: str | None


class SimpleUserOut(Schema):
    id: int
    name: str
    roles: list[str]


# Schemas for Docente


class DocenteIn(Schema):
    nombre: str

    apellido: str

    dni: str

    email: str | None = None

    telefono: str | None = None

    cuil: str | None = None


class DocenteRoleAssignIn(Schema):
    role: str
    profesorados: list[int] | None = None


class DocenteRoleAssignOut(Schema):
    success: bool
    user_id: int
    username: str
    role: str
    profesorados: list[int] | None = None
    temp_password: str | None = None


class DocenteOut(Schema):
    id: int
    nombre: str
    apellido: str
    dni: str
    email: str | None = None
    telefono: str | None = None
    cuil: str | None = None
    usuario: str | None = None
    temp_password: str | None = None


# Schemas for Turno


class TurnoIn(Schema):
    nombre: str


class TurnoOut(Schema):
    id: int

    nombre: str


# Schemas for Bloque


class BloqueIn(Schema):
    turno_id: int

    dia: int

    hora_desde: time

    hora_hasta: time

    es_recreo: bool = False


class BloqueOut(Schema):
    id: int

    turno_id: int

    dia: int

    hora_desde: time

    hora_hasta: time

    es_recreo: bool

    # Optional: Add a display for dia and turno name for better readability

    dia_display: str

    turno_nombre: str


# Schemas for HorarioCatedra


class HorarioCatedraIn(Schema):
    espacio_id: int

    turno_id: int

    anio_cursada: int

    cuatrimestre: str | None = None  # ANUAL, C1, C2


class HorarioCatedraOut(Schema):
    id: int

    espacio_id: int

    turno_id: int

    anio_cursada: int

    cuatrimestre: str | None

    # Optional: Add display names for related objects

    espacio_nombre: str

    turno_nombre: str


# Schemas for HorarioCatedraDetalle


class HorarioCatedraDetalleIn(Schema):
    bloque_id: int


class HorarioCatedraDetalleOut(Schema):
    id: int

    horario_catedra_id: int

    bloque_id: int

    # Optional: Add display for bloque details

    bloque_dia: int

    bloque_hora_desde: time

    bloque_hora_hasta: time


# Docente Endpoints


@router.get("/docentes", response=list[DocenteOut], auth=JWTAuth())
def list_docentes(request):
    _ensure_structure_view(request.user)
    docentes = Docente.objects.all().order_by("apellido", "nombre")
    
    # Optimizamos: Traemos todos los usuarios posibles de un solo viaje
    # Para evitar 400 queries, hacemos un mapa en memoria
    dnis = [d.dni for d in docentes if d.dni]
    emails = [d.email for d in docentes if d.email]
    
    users_qs = User.objects.filter(
        Q(username__in=dnis) | Q(email__in=emails)
    ).only("id", "username", "email")
    
    # Creamos mapas para búsqueda ultra rápida
    user_by_username = {u.username.lower(): u.username for u in users_qs}
    user_by_email = {u.email.lower(): u.username for u in users_qs if u.email}
    
    result = []
    for docente in docentes:
        # Buscamos en el mapa en lugar de hacer Docente.objects.filter...
        username = None
        dni_lower = docente.dni.lower() if docente.dni else None
        email_lower = docente.email.lower() if docente.email else None
        
        if dni_lower and dni_lower in user_by_username:
            username = user_by_username[dni_lower]
        elif email_lower and email_lower in user_by_email:
            username = user_by_email[email_lower]
            
        result.append(DocenteOut(
            id=docente.id,
            nombre=docente.nombre,
            apellido=docente.apellido,
            dni=docente.dni,
            email=docente.email,
            telefono=docente.telefono,
            cuil=docente.cuil,
            usuario=username,
            temp_password=None,
        ))
    return result


@router.post("/docentes", response=DocenteOut, auth=JWTAuth())
def create_docente(request, payload: DocenteIn):
    _ensure_structure_edit(request.user)

    docente = Docente.objects.create(**payload.dict())

    user, created_user, temp_password = _ensure_user_for_docente(docente)
    _ensure_docente_group(user)

    return _serialize_docente(docente, temp_password if created_user else None)


@router.get("/docentes/{docente_id}", response=DocenteOut)
def get_docente(request, docente_id: int):
    _ensure_structure_view(request.user)

    docente = get_object_or_404(Docente, id=docente_id)

    return _serialize_docente(docente)


@router.put("/docentes/{docente_id}", response=DocenteOut, auth=JWTAuth())
def update_docente(request, docente_id: int, payload: DocenteIn):
    _ensure_structure_edit(request.user)

    docente = get_object_or_404(Docente, id=docente_id)

    for attr, value in payload.dict().items():
        if attr == "cuil" and value == "":
            setattr(docente, attr, None)

        else:
            setattr(docente, attr, value)

    docente.save()
    user, created_user, temp_password = _ensure_user_for_docente(docente)
    _ensure_docente_group(user)

    return _serialize_docente(docente, temp_password if created_user else None)


@router.post("/docentes/{docente_id}/roles", response=DocenteRoleAssignOut, auth=JWTAuth())
def assign_role_to_docente(request, docente_id: int, payload: DocenteRoleAssignIn):
    docente = get_object_or_404(Docente, id=docente_id)
    role = payload.role.strip().lower()
    if role not in ALL_ROLES:
        raise HttpError(400, "Rol desconocido.")
    assignable = _assignable_roles_for_user(request.user)
    if role not in assignable:
        raise HttpError(403, "No está autorizado para asignar este rol.")
    user, created_user, temp_password = _ensure_user_for_docente(docente)
    _ensure_docente_group(user)
    group, _ = Group.objects.get_or_create(name=role)
    user.groups.add(group)
    profesorados_payload = payload.profesorados or []
    requires_profesorados = role in ROLE_STAFF_ASSIGNMENT
    if requires_profesorados and not profesorados_payload:
        raise HttpError(400, "Debes seleccionar al menos un profesorado para este rol.")
    profesorados_ids = set(profesorados_payload)
    if profesorados_ids:
        existentes = set(Profesorado.objects.filter(id__in=profesorados_ids).values_list("id", flat=True))
        missing = profesorados_ids - existentes
        if missing:
            raise HttpError(404, f"Profesorados inexistentes: {sorted(missing)}")
        allowed = allowed_profesorados(request.user, role_filter=[role])
        if allowed is not None and not profesorados_ids.issubset(allowed):
            raise HttpError(403, "No tiene permisos sobre alguno de los profesorados seleccionados.")
        StaffAsignacion.objects.filter(user=user, rol=role).exclude(profesorado_id__in=profesorados_ids).delete()
        for prof_id in profesorados_ids:
            StaffAsignacion.objects.get_or_create(user=user, rol=role, profesorado_id=prof_id)
    elif requires_profesorados:
        StaffAsignacion.objects.filter(user=user, rol=role).delete()
    assigned_profesorados = sorted(
        StaffAsignacion.objects.filter(user=user, rol=role).values_list("profesorado_id", flat=True)
    )
    return DocenteRoleAssignOut(
        success=True,
        user_id=user.id,
        username=user.username,
        role=role,
        profesorados=assigned_profesorados or None,
        temp_password=temp_password if created_user else None,
    )


@router.delete("/docentes/{docente_id}", response={204: None}, auth=JWTAuth())
def delete_docente(request, docente_id: int):
    _ensure_structure_edit(request.user)

    docente = get_object_or_404(Docente, id=docente_id)

    docente.delete()

    return 204, None


# Turno Endpoints


@router.get("/turnos", response=list[TurnoOut])
def list_turnos(request):
    user = getattr(request, "user", None)

    if getattr(user, "is_authenticated", False):
        _ensure_structure_view(user)

    return Turno.objects.all()


@router.post("/turnos", response=TurnoOut, auth=JWTAuth())
def create_turno(request, payload: TurnoIn):
    _ensure_structure_edit(request.user)

    turno = Turno.objects.create(**payload.dict())

    return turno


# Bloque Endpoints


@router.get("/turnos/{turno_id}/bloques", response=list[BloqueOut])
def list_bloques_for_turno(request, turno_id: int):
    user = getattr(request, "user", None)

    if getattr(user, "is_authenticated", False):
        _ensure_structure_view(user)

    turno = get_object_or_404(Turno, id=turno_id)

    # Add annotations for dia_display and turno_nombre

    bloques = turno.bloques.annotate(
        dia_display=Case(
            *[When(dia=choice[0], then=Value(choice[1])) for choice in Bloque.DIA_CHOICES],
            output_field=CharField(),
        ),
        turno_nombre=Value(turno.nombre, output_field=CharField()),
    )

    return bloques


@router.post("/turnos/{turno_id}/bloques", response=BloqueOut, auth=JWTAuth())
def create_bloque_for_turno(request, turno_id: int, payload: BloqueIn):
    _ensure_structure_edit(request.user)

    turno = get_object_or_404(Turno, id=turno_id)

    bloque = Bloque.objects.create(turno=turno, **payload.dict())

    return bloque


# HorarioCatedra Endpoints


@router.get("/horarios_catedra", response=list[HorarioCatedraOut], auth=JWTAuth())
def list_horarios_catedra(
    request,
    espacio_id: int | None = None,
    turno_id: int | None = None,
    anio_cursada: int | None = None,
    cuatrimestre: str | None = None,
):
    _ensure_structure_view(request.user)

    # Add annotations for espacio_nombre and turno_nombre

    horarios = HorarioCatedra.objects.select_related("espacio", "turno").annotate(
        espacio_nombre=F("espacio__nombre"), turno_nombre=F("turno__nombre")
    )

    allowed = allowed_profesorados(request.user)

    if allowed is not None:
        if not allowed:
            return []

        horarios = horarios.filter(espacio__plan_de_estudio__profesorado_id__in=allowed)

    if espacio_id:
        horarios = horarios.filter(espacio_id=espacio_id)

    if turno_id:
        horarios = horarios.filter(turno_id=turno_id)

    if anio_cursada:
        horarios = horarios.filter(anio_cursada=anio_cursada)

    # Handle cuatrimestre filtering carefully

    if cuatrimestre:
        horarios = horarios.filter(cuatrimestre=cuatrimestre)

    else:
        horarios = horarios.filter(cuatrimestre__isnull=True)

    return horarios


@router.post("/horarios_catedra", response=HorarioCatedraOut, auth=JWTAuth())
def create_horario_catedra(request, payload: HorarioCatedraIn):
    # Basic validation: check if cuatrimestre is provided for non-ANUAL regimen

    espacio = get_object_or_404(Materia, id=payload.espacio_id)

    _ensure_structure_edit(request.user, espacio.plan_de_estudio.profesorado_id)

    if espacio.regimen != Materia.TipoCursada.ANUAL and not payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre is required for non-ANUAL regimen.")

    if espacio.regimen == Materia.TipoCursada.ANUAL and payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre should not be provided for ANUAL regimen.")

    if payload.cuatrimestre and payload.cuatrimestre != espacio.regimen:
        raise HttpError(
            400,
            f"Cuatrimestre '{payload.cuatrimestre}' does not match espacio regimen '{espacio.regimen}'.",
        )

    # Idempotente: si ya existe con misma (espacio, turno, anio_cursada, cuatrimestre) devolverlo

    existing = HorarioCatedra.objects.filter(
        espacio_id=payload.espacio_id,
        turno_id=payload.turno_id,
        anio_cursada=payload.anio_cursada,
        cuatrimestre=payload.cuatrimestre,
    ).first()

    if existing:
        # Asegurar campos calculados requeridos por el schema de respuesta

        existing.espacio_nombre = existing.espacio.nombre

        existing.turno_nombre = existing.turno.nombre

        return existing

    horario = HorarioCatedra.objects.create(
        espacio_id=payload.espacio_id,
        turno_id=payload.turno_id,
        anio_cursada=payload.anio_cursada,
        cuatrimestre=payload.cuatrimestre,
    )

    # Asegurar campos calculados requeridos por el schema de respuesta

    horario.espacio_nombre = horario.espacio.nombre

    horario.turno_nombre = horario.turno.nombre

    return horario


@router.get("/horarios_catedra/{horario_id}", response=HorarioCatedraOut, auth=JWTAuth())
def get_horario_catedra(request, horario_id: int):
    horario = get_object_or_404(HorarioCatedra.objects.select_related("espacio", "turno"), id=horario_id)

    _ensure_structure_view(request.user, horario.espacio.plan_de_estudio.profesorado_id)

    horario.espacio_nombre = horario.espacio.nombre

    horario.turno_nombre = horario.turno.nombre

    return horario


@router.put("/horarios_catedra/{horario_id}", response=HorarioCatedraOut, auth=JWTAuth())
def update_horario_catedra(request, horario_id: int, payload: HorarioCatedraIn):
    horario = get_object_or_404(HorarioCatedra, id=horario_id)

    espacio = get_object_or_404(Materia, id=payload.espacio_id)

    _ensure_structure_edit(request.user, espacio.plan_de_estudio.profesorado_id)

    # Basic validation: check if cuatrimestre is provided for non-ANUAL regimen

    if espacio.regimen != Materia.TipoCursada.ANUAL and not payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre is required for non-ANUAL regimen.")

    if espacio.regimen == Materia.TipoCursada.ANUAL and payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre should not be provided for ANUAL regimen.")

    if payload.cuatrimestre and payload.cuatrimestre != espacio.regimen:
        raise HttpError(
            400,
            f"Cuatrimestre '{payload.cuatrimestre}' does not match espacio regimen '{espacio.regimen}'.",
        )

    for attr, value in payload.dict().items():
        setattr(horario, attr, value)

    horario.save()

    # Asegurar campos calculados requeridos por el schema de respuesta

    horario.espacio_nombre = horario.espacio.nombre

    horario.turno_nombre = horario.turno.nombre

    return horario


@router.delete("/horarios_catedra/{horario_id}", response={204: None}, auth=JWTAuth())
def delete_horario_catedra(request, horario_id: int):
    horario = get_object_or_404(HorarioCatedra, id=horario_id)

    _ensure_structure_edit(request.user, horario.espacio.plan_de_estudio.profesorado_id)

    horario.delete()

    return 204, None


# HorarioCatedraDetalle Endpoints


@router.get(
    "/horarios_catedra/{horario_catedra_id}/detalles",
    response=list[HorarioCatedraDetalleOut],
    auth=JWTAuth(),
)
def list_horario_catedra_detalles(request, horario_catedra_id: int):
    horario_catedra = get_object_or_404(HorarioCatedra, id=horario_catedra_id)

    _ensure_structure_view(request.user, horario_catedra.espacio.plan_de_estudio.profesorado_id)

    # Add annotations for bloque details

    detalles = horario_catedra.detalles.select_related("bloque").annotate(
        bloque_dia=F("bloque__dia"),
        bloque_hora_desde=F("bloque__hora_desde"),
        bloque_hora_hasta=F("bloque__hora_hasta"),
    )

    return detalles


@router.post(
    "/horarios_catedra/{horario_catedra_id}/detalles",
    response={200: HorarioCatedraDetalleOut, 409: ApiResponse},
    auth=JWTAuth(),
)
def create_horario_catedra_detalle(request, horario_catedra_id: int, payload: HorarioCatedraDetalleIn):
    horario_catedra = get_object_or_404(HorarioCatedra, id=horario_catedra_id)

    _ensure_structure_edit(request.user, horario_catedra.espacio.plan_de_estudio.profesorado_id)

    bloque = get_object_or_404(Bloque, id=payload.bloque_id)

    def _build_conflict_response(conflict_detalle: HorarioCatedraDetalle, message: str):
        hc = conflict_detalle.horario_catedra

        espacio = hc.espacio

        turno = hc.turno

        conflict_payload = {
            "horario_id": hc.id,
            "materia_id": espacio.id if espacio else None,
            "materia_nombre": espacio.nombre if espacio else None,
            "turno": turno.nombre if turno else None,
            "anio_cursada": hc.anio_cursada,
            "cuatrimestre": hc.cuatrimestre,
            "bloque": {
                "id": conflict_detalle.bloque_id,
                "dia": conflict_detalle.bloque.get_dia_display(),
                "hora_desde": str(conflict_detalle.bloque.hora_desde)[:5],
                "hora_hasta": str(conflict_detalle.bloque.hora_hasta)[:5],
            },
        }

        return 409, ApiResponse(
            ok=False,
            message=message,
            data={"conflict": conflict_payload},
        )

    conflictos = list(
        HorarioCatedraDetalle.objects.select_related(
            "bloque",
            "horario_catedra__espacio",
            "horario_catedra__turno",
        )
        .filter(
            bloque=bloque,
            horario_catedra__anio_cursada=horario_catedra.anio_cursada,
            horario_catedra__turno=horario_catedra.turno,
            horario_catedra__espacio__plan_de_estudio=horario_catedra.espacio.plan_de_estudio,
            horario_catedra__espacio__anio_cursada=horario_catedra.espacio.anio_cursada,
            horario_catedra__cuatrimestre__in=_compatible_cuatrimestres(horario_catedra.cuatrimestre),
            horario_catedra__espacio__regimen__in=_compatible_cuatrimestres(horario_catedra.espacio.regimen),
        )
        .exclude(horario_catedra=horario_catedra)
    )

    if conflictos:
        es_residencia_actual = _es_taller_residencia(horario_catedra.espacio)

        if es_residencia_actual:
            conflictos_no_residencia = [c for c in conflictos if not _es_taller_residencia(c.horario_catedra.espacio)]

            if conflictos_no_residencia:
                return _build_conflict_response(
                    conflictos_no_residencia[0],
                    "Bloque ocupado por otra catedra en el mismo turno y anio.",
                )

            if len(conflictos) >= 2:
                return _build_conflict_response(
                    conflictos[0],
                    "Bloque ocupado por otros talleres de residencia (maximo 2 en paralelo).",
                )

        else:
            return _build_conflict_response(
                conflictos[0],
                "Bloque ocupado por otra catedra en el mismo turno y anio.",
            )

    detalle, _created = HorarioCatedraDetalle.objects.get_or_create(
        horario_catedra=horario_catedra,
        bloque=bloque,
    )

    detalle.bloque_dia = detalle.bloque.dia

    detalle.bloque_hora_desde = detalle.bloque.hora_desde

    detalle.bloque_hora_hasta = detalle.bloque.hora_hasta

    return detalle


@router.delete("/horarios_catedra_detalles/{detalle_id}", response={204: None}, auth=JWTAuth())
def delete_horario_catedra_detalle(request, detalle_id: int):
    detalle = get_object_or_404(HorarioCatedraDetalle, id=detalle_id)

    _ensure_structure_edit(request.user, detalle.horario_catedra.espacio.plan_de_estudio.profesorado_id)

    detalle.delete()

    return 204, None


# Comision Endpoints


def _restrict_comisiones_queryset(user, queryset):
    allowed = allowed_profesorados(user)

    if allowed is None:
        return queryset

    if not allowed:
        return queryset.none()

    return queryset.filter(materia__plan_de_estudio__profesorado_id__in=allowed)


class ComisionIn(Schema):
    materia_id: int

    anio_lectivo: int

    codigo: str

    turno_id: int

    docente_id: int | None = None

    horario_id: int | None = None

    cupo_maximo: int | None = None

    estado: str | None = None

    observaciones: str | None = None


class ComisionOut(Schema):
    id: int

    materia_id: int

    materia_nombre: str

    plan_id: int

    plan_resolucion: str

    profesorado_id: int

    profesorado_nombre: str

    anio_lectivo: int

    codigo: str

    turno_id: int

    turno_nombre: str

    docente_id: int | None = None

    docente_nombre: str | None = None

    horario_id: int | None = None

    cupo_maximo: int | None = None

    estado: str

    observaciones: str | None = None


def _serialize_comision(comision: Comision) -> ComisionOut:
    materia = comision.materia

    plan = materia.plan_de_estudio

    profesorado = plan.profesorado

    turno = comision.turno

    docente = comision.docente

    return ComisionOut(
        id=comision.id,
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        plan_id=plan.id,
        plan_resolucion=plan.resolucion,
        profesorado_id=profesorado.id,
        profesorado_nombre=profesorado.nombre,
        anio_lectivo=comision.anio_lectivo,
        codigo=comision.codigo,
        turno_id=turno.id,
        turno_nombre=turno.nombre,
        docente_id=docente.id if docente else None,
        docente_nombre=f"{docente.apellido}, {docente.nombre}" if docente else None,
        horario_id=comision.horario_id,
        cupo_maximo=comision.cupo_maximo,
        estado=comision.estado,
        observaciones=comision.observaciones or None,
    )


def _clean_estado(value: str | None) -> str:
    estado = (value or Comision.Estado.ABIERTA).upper()

    allowed = {choice[0] for choice in Comision.Estado.choices}

    if estado not in allowed:
        raise HttpError(400, f"Estado invalido: {estado}")

    return estado


def _resolve_docente(docente_id: int | None) -> Docente | None:
    if docente_id is None:
        return None

    return get_object_or_404(Docente, id=docente_id)


def _resolve_horario(horario_id: int | None) -> HorarioCatedra | None:
    if horario_id is None:
        return None

    return get_object_or_404(HorarioCatedra, id=horario_id)


def _codigo_from_index(index: int) -> str:
    letters = string.ascii_uppercase

    base = len(letters)

    result = ""

    i = index

    while True:
        result = letters[i % base] + result

        i = i // base - 1

        if i < 0:
            break

    return result


@router.get("/comisiones", response=list[ComisionOut], auth=JWTAuth())
def list_comisiones(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    materia_id: int | None = None,
    anio_lectivo: int | None = None,
    turno_id: int | None = None,
    estado: str | None = None,
):
    roles = _normalized_user_roles(request.user)
    docente_profile = _docente_from_user(request.user)

    if "docente" in roles:
        if not docente_profile:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tienes comisiones asignadas.")
        qs = Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "turno",
            "docente",
        ).filter(docente=docente_profile)
    else:
        _ensure_academic_view(request.user)

        qs = Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "turno",
            "docente",
        )

        qs = _restrict_comisiones_queryset(request.user, qs)

    if profesorado_id:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)

    if plan_id:
        qs = qs.filter(materia__plan_de_estudio_id=plan_id)

    if materia_id:
        qs = qs.filter(materia_id=materia_id)

    if anio_lectivo:
        qs = qs.filter(anio_lectivo=anio_lectivo)

    if turno_id:
        qs = qs.filter(turno_id=turno_id)

    if estado:
        qs = qs.filter(estado=estado.upper())

    qs = qs.order_by("-anio_lectivo", "materia__nombre", "codigo")

    return [_serialize_comision(com) for com in qs]


@router.post("/comisiones", response=ComisionOut, auth=JWTAuth())
def create_comision(request, payload: ComisionIn):
    _ensure_academic_manage(request.user)

    materia = get_object_or_404(Materia, id=payload.materia_id)

    ensure_profesorado_access(request.user, materia.plan_de_estudio.profesorado_id)

    turno = get_object_or_404(Turno, id=payload.turno_id)

    docente = _resolve_docente(payload.docente_id)

    horario = _resolve_horario(payload.horario_id)

    estado = _clean_estado(payload.estado)

    comision = Comision.objects.create(
        materia=materia,
        anio_lectivo=payload.anio_lectivo,
        codigo=payload.codigo,
        turno=turno,
        docente=docente,
        horario=horario,
        cupo_maximo=payload.cupo_maximo,
        estado=estado,
        observaciones=payload.observaciones or "",
    )

    return _serialize_comision(comision)


class ComisionBulkGenerateIn(Schema):
    plan_id: int

    anio_lectivo: int

    turnos: list[int] | None = None

    cantidad: int = 1

    estado: str | None = None


@router.post("/comisiones/generar", response=list[ComisionOut], auth=JWTAuth())
def bulk_generate_comisiones(request, payload: ComisionBulkGenerateIn):
    _ensure_academic_manage(request.user)

    if payload.cantidad < 1:
        raise HttpError(400, "Cantidad debe ser al menos 1.")

    plan = get_object_or_404(PlanDeEstudio.objects.select_related("profesorado"), id=payload.plan_id)

    ensure_profesorado_access(request.user, plan.profesorado_id)

    materias = list(plan.materias.all().order_by("anio_cursada", "nombre"))

    if not materias:
        raise HttpError(400, "El plan no posee materias para generar comisiones.")

    estado = _clean_estado(payload.estado)

    if payload.turnos:
        turnos = list(Turno.objects.filter(id__in=payload.turnos))

        if not turnos:
            raise HttpError(400, "No se encontraron turnos con los identificadores provistos.")

        if len(turnos) != len(set(payload.turnos)):
            raise HttpError(400, "Alguno de los turnos solicitados no existe.")

    else:
        turnos = list(Turno.objects.all().order_by("id"))

        if not turnos:
            raise HttpError(400, "No hay turnos dados de alta en el sistema.")

    created: list[Comision] = []

    with transaction.atomic():
        for materia in materias:
            existing_codes = set(
                Comision.objects.filter(
                    materia=materia,
                    anio_lectivo=payload.anio_lectivo,
                ).values_list("codigo", flat=True)
            )

            existentes = len(existing_codes)

            if existentes >= payload.cantidad:
                continue

            faltantes = payload.cantidad - existentes

            code_index = 0

            nuevos_creados = 0

            while nuevos_creados < faltantes:
                codigo = _codigo_from_index(code_index)

                code_index += 1

                if codigo in existing_codes:
                    continue

                existing_codes.add(codigo)

                turno = turnos[(existentes + nuevos_creados) % len(turnos)]

                comision = Comision.objects.create(
                    materia=materia,
                    anio_lectivo=payload.anio_lectivo,
                    codigo=codigo,
                    turno=turno,
                    estado=estado,
                    observaciones="",
                )

                created.append(comision)

                nuevos_creados += 1

    return [_serialize_comision(com) for com in created]


@router.put("/comisiones/{comision_id}", response=ComisionOut)
def update_comision(request, comision_id: int, payload: ComisionIn):
    _ensure_academic_manage(request.user)

    comision = get_object_or_404(Comision, id=comision_id)

    ensure_profesorado_access(request.user, comision.materia.plan_de_estudio.profesorado_id)

    materia = get_object_or_404(Materia, id=payload.materia_id)

    ensure_profesorado_access(request.user, materia.plan_de_estudio.profesorado_id)

    turno = get_object_or_404(Turno, id=payload.turno_id)

    docente = _resolve_docente(payload.docente_id)

    horario = _resolve_horario(payload.horario_id)

    estado = _clean_estado(payload.estado)

    comision.materia = materia

    comision.anio_lectivo = payload.anio_lectivo

    comision.codigo = payload.codigo

    comision.turno = turno

    comision.docente = docente

    comision.horario = horario

    comision.cupo_maximo = payload.cupo_maximo

    comision.estado = estado

    comision.observaciones = payload.observaciones or ""

    comision.save()

    return _serialize_comision(comision)


@router.delete("/comisiones/{comision_id}", response={204: None})
def delete_comision(request, comision_id: int):
    _ensure_academic_manage(request.user)

    comision = get_object_or_404(Comision, id=comision_id)

    ensure_profesorado_access(request.user, comision.materia.plan_de_estudio.profesorado_id)

    comision.delete()

    return 204, None


# Specific endpoint for timetable builder: Get occupied blocks


@router.get("/horarios/ocupacion", response=list[BloqueOut], auth=JWTAuth())
def get_occupied_blocks(request, anio_cursada: int, turno_id: int, cuatrimestre: str | None = None):
    # This endpoint will return all blocks occupied by other schedules

    # for a given year, turn, and optionally cuatrimestre.

    # This is crucial for the frontend to display overlaps.

    _ensure_structure_view(request.user)

    # Filter schedules by anio_cursada and turno

    schedules = HorarioCatedra.objects.filter(anio_cursada=anio_cursada, turno_id=turno_id)

    # If a cuatrimestre is provided, filter schedules that are ANUAL or match the cuatrimestre

    if cuatrimestre:
        schedules = schedules.filter(Q(cuatrimestre=Materia.TipoCursada.ANUAL) | Q(cuatrimestre=cuatrimestre))

    # Get all unique blocks associated with these schedules

    occupied_bloque_ids = (
        HorarioCatedraDetalle.objects.filter(horario_catedra__in=schedules)
        .values_list("bloque_id", flat=True)
        .distinct()
    )

    # Retrieve the actual Bloque objects

    occupied_bloques = Bloque.objects.filter(id__in=occupied_bloque_ids).annotate(
        dia_display=Case(
            *[When(dia=choice[0], then=Value(choice[1])) for choice in Bloque.DIA_CHOICES],
            output_field=CharField(),
        ),
        turno_nombre=Value(get_object_or_404(Turno, id=turno_id).nombre, output_field=CharField()),
    )

    return occupied_bloques


# === Ventanas de Habilitación ===


class VentanaIn(Schema):
    tipo: str

    desde: date

    hasta: date

    activo: bool = True

    periodo: str | None = None


class VentanaOut(Schema):
    id: int

    tipo: str

    desde: date

    hasta: date

    activo: bool

    periodo: str | None = None


@router.get("/ventanas", response=list[VentanaOut], auth=None)
def list_ventanas(request, tipo: str | None = None, estado: str | None = None):
    # Intentar autenticar manualmente si no lo estÃ¡ (porque auth=None deshabilita JWTAuth automÃ¡tico)
    user = request.user
    if not user.is_authenticated:
        try:
            auth_cls = JWTAuth()
            user_resolved = auth_cls(request)
            if user_resolved:
                request.user = user_resolved
                user = user_resolved
        except Exception:
            pass

    # Permitir acceso pÃºblico si es para PreinscripciÃ³n
    if tipo == "PREINSCRIPCION":
        pass
    else:
        # Para otros casos, requerir autenticaciÃ³n y roles
        if not user.is_authenticated:
            raise HttpError(401, "Authentication required")
        
        # Validar roles manualmente (puesto que ensure_roles es un decorador)
        user_roles = _normalized_user_roles(user)
            
        required = {role.lower() for role in VENTANA_VIEW_ROLES}
        if not user_roles.intersection(required):
             raise HttpError(403, "No tiene permisos para ver ventanas.")

    qs = VentanaHabilitacion.objects.all()

    if tipo:
        qs = qs.filter(tipo=tipo)

    today = date.today()

    if estado:
        if estado.lower() == "activa":
            qs = qs.filter(activo=True, desde__lte=today, hasta__gte=today)

        elif estado.lower() == "pendiente":
            qs = qs.filter(activo=True, desde__gt=today)

        elif estado.lower() == "pasada":
            qs = qs.filter(hasta__lt=today)

    return qs.order_by("tipo", "-desde", "-created_at")


@router.post("/ventanas", response=VentanaOut, auth=JWTAuth())
def create_ventana(request, payload: VentanaIn):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})

    obj = VentanaHabilitacion.objects.create(
        tipo=payload.tipo,
        desde=payload.desde,
        hasta=payload.hasta,
        activo=payload.activo,
        periodo=payload.periodo,
    )

    return obj


# ====== Correlatividades de Materias ======


class CorrelatividadSetIn(Schema):
    regular_para_cursar: list[int] = []  # RPC

    aprobada_para_cursar: list[int] = []  # APC

    aprobada_para_rendir: list[int] = []  # APR


class CorrelatividadSetOut(Schema):
    regular_para_cursar: list[int]

    aprobada_para_cursar: list[int]

    aprobada_para_rendir: list[int]


class CorrelatividadVersionBase(Schema):
    nombre: str
    descripcion: str | None = None
    cohorte_desde: int
    cohorte_hasta: int | None = None
    vigencia_desde: date | None = None
    vigencia_hasta: date | None = None
    activo: bool = True


class CorrelatividadVersionCreateIn(CorrelatividadVersionBase):
    duplicar_version_id: int | None = None


class CorrelatividadVersionUpdateIn(CorrelatividadVersionBase):
    pass


class CorrelatividadVersionOut(Schema):
    id: int
    nombre: str
    descripcion: str | None
    cohorte_desde: int
    cohorte_hasta: int | None
    vigencia_desde: date | None
    vigencia_hasta: date | None
    activo: bool
    correlatividades: int
    created_at: datetime
    updated_at: datetime


def _to_set_out(qs) -> dict[str, list[int]]:
    out = {
        "regular_para_cursar": [],
        "aprobada_para_cursar": [],
        "aprobada_para_rendir": [],
    }

    for c in qs:
        if c.tipo == Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR:
            out["regular_para_cursar"].append(c.materia_correlativa_id)

        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR:
            out["aprobada_para_cursar"].append(c.materia_correlativa_id)

        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR:
            out["aprobada_para_rendir"].append(c.materia_correlativa_id)

    return out


def _version_to_schema(version: CorrelatividadVersion) -> CorrelatividadVersionOut:
    return CorrelatividadVersionOut(
        id=version.id,
        nombre=version.nombre,
        descripcion=version.descripcion or None,
        cohorte_desde=version.cohorte_desde,
        cohorte_hasta=version.cohorte_hasta,
        vigencia_desde=version.vigencia_desde,
        vigencia_hasta=version.vigencia_hasta,
        activo=version.activo,
        correlatividades=version.detalles.count(),
        created_at=version.created_at,
        updated_at=version.updated_at,
    )


def _validate_version_range(
    plan_id: int,
    cohorte_desde: int,
    cohorte_hasta: int | None,
    exclude_id: int | None = None,
    *,
    allow_autoclose: bool = False,
):
    if cohorte_hasta is not None and cohorte_hasta < cohorte_desde:
        raise HttpError(400, "El anio final de cohorte debe ser mayor o igual al inicial.")
    qs = CorrelatividadVersion.objects.filter(plan_de_estudio_id=plan_id)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    new_start = cohorte_desde
    new_end = cohorte_hasta if cohorte_hasta is not None else 9999
    for version in qs:
        existing_start = version.cohorte_desde
        existing_end = version.cohorte_hasta if version.cohorte_hasta is not None else 9999
        overlaps = not (new_end < existing_start or new_start > existing_end)
        if not overlaps:
            continue
        if allow_autoclose and existing_start < new_start <= existing_end:
            # La version previa se cerrara automaticamente antes de guardar la nueva.
            continue
        raise HttpError(400, f"El rango de cohortes se superpone con la version '{version.nombre}'.")



def _autoclose_previous_versions(plan_id: int, new_cohorte_desde: int, exclude_id: int | None = None):
    overlaps = CorrelatividadVersion.objects.filter(
        plan_de_estudio_id=plan_id,
        cohorte_desde__lt=new_cohorte_desde,
    )
    if exclude_id:
        overlaps = overlaps.exclude(id=exclude_id)
    overlaps = overlaps.filter(Q(cohorte_hasta__isnull=True) | Q(cohorte_hasta__gte=new_cohorte_desde))
    for version in overlaps:
        if version.cohorte_hasta is None or version.cohorte_hasta >= new_cohorte_desde:
            version.cohorte_hasta = new_cohorte_desde - 1
            version.save(update_fields=["cohorte_hasta", "updated_at"])


def _resolve_version_for_plan(
    *,
    plan: PlanDeEstudio,
    version_id: int | None = None,
    cohorte: int | None = None,
) -> CorrelatividadVersion | None:
    if version_id is not None:
        version = get_object_or_404(CorrelatividadVersion, id=version_id)
        if version.plan_de_estudio_id != plan.id:
            raise HttpError(400, "La versión seleccionada no pertenece al plan indicado.")
        return version
    if cohorte is not None:
        return CorrelatividadVersion.vigente_para(
            plan_id=plan.id,
            profesorado_id=plan.profesorado_id,
            cohorte=cohorte,
        )
    return plan.correlatividad_versiones.order_by("-cohorte_desde").first()


@router.get(
    "/planes/{plan_id}/correlatividades/versiones",
    response=list[CorrelatividadVersionOut],
    auth=JWTAuth(),
)
def listar_correlatividad_versiones(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_structure_view(request.user, plan.profesorado_id)
    versiones = plan.correlatividad_versiones.select_related("plan_de_estudio").order_by("cohorte_desde")
    return [_version_to_schema(v) for v in versiones]


@router.post(
    "/planes/{plan_id}/correlatividades/versiones",
    response=CorrelatividadVersionOut,
    auth=JWTAuth(),
)
def crear_correlatividad_version(
    request,
    plan_id: int,
    payload: CorrelatividadVersionCreateIn,
):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_structure_edit(request.user, plan.profesorado_id)
    if not plan.profesorado_id:
        raise HttpError(400, "El plan seleccionado no está vinculado a un profesorado.")
    _validate_version_range(
        plan.id,
        payload.cohorte_desde,
        payload.cohorte_hasta,
        allow_autoclose=True,
    )

    version = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado_id=plan.profesorado_id,
        nombre=payload.nombre,
        descripcion=payload.descripcion or "",
        cohorte_desde=payload.cohorte_desde,
        cohorte_hasta=payload.cohorte_hasta,
        vigencia_desde=payload.vigencia_desde,
        vigencia_hasta=payload.vigencia_hasta,
        activo=payload.activo,
    )

    _autoclose_previous_versions(plan.id, version.cohorte_desde, exclude_id=version.id)

    if payload.duplicar_version_id:
        origen = get_object_or_404(CorrelatividadVersion, id=payload.duplicar_version_id)
        if origen.plan_de_estudio_id != plan.id:
            raise HttpError(400, "Solo se puede duplicar una versión del mismo plan.")
        detalles = origen.detalles.select_related("correlatividad")
        CorrelatividadVersionDetalle.objects.bulk_create(
            [
                CorrelatividadVersionDetalle(
                    version=version,
                    correlatividad=detalle.correlatividad,
                )
                for detalle in detalles
            ],
            ignore_conflicts=True,
        )

    return _version_to_schema(version)


@router.put(
    "/correlatividades/versiones/{version_id}",
    response=CorrelatividadVersionOut,
    auth=JWTAuth(),
)
def actualizar_correlatividad_version(
    request,
    version_id: int,
    payload: CorrelatividadVersionUpdateIn,
):
    version = get_object_or_404(CorrelatividadVersion, id=version_id)
    plan = version.plan_de_estudio
    _ensure_structure_edit(request.user, plan.profesorado_id)
    _validate_version_range(
        plan.id,
        payload.cohorte_desde,
        payload.cohorte_hasta,
        exclude_id=version.id,
        allow_autoclose=True,
    )
    version.nombre = payload.nombre
    version.descripcion = payload.descripcion or ""
    version.cohorte_desde = payload.cohorte_desde
    version.cohorte_hasta = payload.cohorte_hasta
    version.vigencia_desde = payload.vigencia_desde
    version.vigencia_hasta = payload.vigencia_hasta
    version.activo = payload.activo
    version.save(
        update_fields=[
            "nombre",
            "descripcion",
            "cohorte_desde",
            "cohorte_hasta",
            "vigencia_desde",
            "vigencia_hasta",
            "activo",
            "updated_at",
        ]
    )
    _autoclose_previous_versions(plan.id, version.cohorte_desde, exclude_id=version.id)
    return _version_to_schema(version)


@router.get(
    "/materias/{materia_id}/correlatividades",
    response=CorrelatividadSetOut,
    auth=JWTAuth(),
)
def get_correlatividades_materia(
    request,
    materia_id: int,
    version_id: int | None = None,
    cohorte: int | None = None,
):
    materia = get_object_or_404(Materia, id=materia_id)

    _ensure_structure_view(request.user, materia.plan_de_estudio.profesorado_id)

    version = _resolve_version_for_plan(
        plan=materia.plan_de_estudio,
        version_id=version_id,
        cohorte=cohorte,
    )

    qs = Correlatividad.objects.filter(materia_origen=materia)
    if version:
        qs = qs.filter(versiones__version=version)

    return _to_set_out(qs)


@router.post(
    "/materias/{materia_id}/correlatividades",
    response=CorrelatividadSetOut,
    auth=JWTAuth(),
)
def set_correlatividades_materia(
    request,
    materia_id: int,
    payload: CorrelatividadSetIn,
    version_id: int | None = None,
):
    materia = get_object_or_404(Materia, id=materia_id)

    _ensure_structure_edit(request.user, materia.plan_de_estudio.profesorado_id)

    version = _resolve_version_for_plan(
        plan=materia.plan_de_estudio,
        version_id=version_id,
        cohorte=None,
    )

    # Validar que los IDs pertenecen al mismo plan para evitar incoherencias

    all_ids = set(payload.regular_para_cursar + payload.aprobada_para_cursar + payload.aprobada_para_rendir)

    if all_ids:
        count = Materia.objects.filter(id__in=all_ids, plan_de_estudio=materia.plan_de_estudio).count()

        if count != len(all_ids):
            raise HttpError(
                400,
                "Todas las materias correlativas deben pertenecer al mismo plan de estudio.",
            )

        # Validar que no se exijan materias de años futuros (anio_cursada > anio de la materia)

        anios = dict(Materia.objects.filter(id__in=all_ids).values_list("id", "anio_cursada"))

        futuros = [mid for mid in all_ids if anios.get(mid, 0) > materia.anio_cursada]

        if futuros:
            raise HttpError(
                400,
                "No se pueden requerir correlativas de años futuros para esta materia.",
            )

    with transaction.atomic():
        if version:
            return _set_correlatividades_for_version(materia, version, payload)

        Correlatividad.objects.filter(materia_origen=materia).delete()

        def _bulk_create(ids: list[int], tipo: str):
            objs = [
                Correlatividad(
                    materia_origen_id=materia.id,
                    materia_correlativa_id=mid,
                    tipo=tipo,
                )
                for mid in ids
            ]

            if objs:
                Correlatividad.objects.bulk_create(objs)

        _bulk_create(
            payload.regular_para_cursar,
            Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR,
        )

        _bulk_create(
            payload.aprobada_para_cursar,
            Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR,
        )

        _bulk_create(
            payload.aprobada_para_rendir,
            Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
        )

    qs = Correlatividad.objects.filter(materia_origen=materia)

    return _to_set_out(qs)


def _set_correlatividades_for_version(
    materia: Materia,
    version: CorrelatividadVersion,
    payload: CorrelatividadSetIn,
) -> dict[str, list[int]]:
    desired_pairs = set()

    def _collect(tipo: str, ids: list[int]):
        for mid in ids:
            desired_pairs.add((tipo, mid))

    _collect(Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, payload.regular_para_cursar)
    _collect(Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, payload.aprobada_para_cursar)
    _collect(Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, payload.aprobada_para_rendir)

    existing_details = (
        CorrelatividadVersionDetalle.objects.filter(
            version=version,
            correlatividad__materia_origen=materia,
        )
        .select_related("correlatividad")
    )
    existing_map: dict[tuple[str, int], CorrelatividadVersionDetalle] = {}
    for detalle in existing_details:
        key = (detalle.correlatividad.tipo, detalle.correlatividad.materia_correlativa_id)
        existing_map[key] = detalle

    # Remover correlatividades que ya no aplican para esta versión
    for key, detalle in list(existing_map.items()):
        if key not in desired_pairs:
            corr = detalle.correlatividad
            detalle.delete()
            if not corr.versiones.exists():
                corr.delete()

    # Agregar nuevas correlatividades
    def _attach(tipo: str, mid: int):
        corr, _ = Correlatividad.objects.get_or_create(
            materia_origen=materia,
            materia_correlativa_id=mid,
            tipo=tipo,
        )
        CorrelatividadVersionDetalle.objects.get_or_create(
            version=version,
            correlatividad=corr,
        )

    for mid in payload.regular_para_cursar:
        _attach(Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, mid)
    for mid in payload.aprobada_para_cursar:
        _attach(Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, mid)
    for mid in payload.aprobada_para_rendir:
        _attach(Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, mid)

    qs = Correlatividad.objects.filter(
        materia_origen=materia,
        versiones__version=version,
    )
    return _to_set_out(qs)


class MateriaCorrelatividadRow(Schema):
    id: int

    nombre: str

    anio_cursada: int

    regimen: str

    formato: str

    regular_para_cursar: list[int]

    aprobada_para_cursar: list[int]

    aprobada_para_rendir: list[int]


class DashboardCatedra(Schema):
    id: int

    materia: str

    profesorado: str

    anio_lectivo: int

    turno: str | None


class DashboardDocente(Schema):
    id: int

    nombre: str

    documento: str

    total_catedras: int

    catedras: list[DashboardCatedra]


class DashboardProfesorado(Schema):
    id: int

    nombre: str

    planes: int

    materias: int

    correlativas: int


class DashboardPreinsEstado(Schema):
    estado: str

    total: int


class DashboardPreinsDetalle(Schema):
    id: int

    codigo: str

    estudiante: str

    carrera: str | None

    fecha: str | None


class DashboardPreinscripciones(Schema):
    total: int

    por_estado: list[DashboardPreinsEstado]

    recientes: list[DashboardPreinsDetalle]


class DashboardHorario(Schema):
    profesorado_id: int

    profesorado: str

    anio_cursada: int

    cantidad: int


class DashboardCambioComision(Schema):
    id: int

    estudiante: str

    dni: str

    materia: str

    profesorado: str | None

    comision_actual: str | None

    comision_solicitada: str | None

    estado: str

    actualizado: str


class DashboardPedidoAnalitico(Schema):
    id: int

    estudiante: str

    dni: str

    fecha: str

    motivo: str

    profesorado: str | None


class DashboardMesaTipo(Schema):
    tipo: str

    total: int


class DashboardMesas(Schema):
    total: int

    por_tipo: list[DashboardMesaTipo]


class DashboardRegularidad(Schema):
    id: int

    estudiante: str

    dni: str

    materia: str

    profesorado: str | None

    situacion: str

    nota: str | None

    fecha: str


class DashboardVentana(Schema):
    id: int

    tipo: str

    desde: str

    hasta: str

    activo: bool

    estado: str


class GlobalOverviewOut(Schema):
    docentes: list[DashboardDocente]

    profesorados: list[DashboardProfesorado]

    preinscripciones: DashboardPreinscripciones

    horarios: list[DashboardHorario]

    pedidos_comision: list[DashboardCambioComision]

    pedidos_analiticos: list[DashboardPedidoAnalitico]

    mesas: DashboardMesas

    regularidades: list[DashboardRegularidad]

    ventanas: list[DashboardVentana]


@router.get("/overview/global", response=GlobalOverviewOut, auth=JWTAuth())
def global_overview(request):
    ensure_roles(request.user, GLOBAL_OVERVIEW_ROLES)

    docentes_qs = (
        Docente.objects.annotate(total_catedras=Count("comisiones", distinct=True))
        .filter(total_catedras__gt=0)
        .prefetch_related(
            Prefetch(
                "comisiones",
                queryset=Comision.objects.select_related(
                    "materia__plan_de_estudio__profesorado",
                    "turno",
                ).order_by("-anio_lectivo", "materia__nombre")[:5],
                to_attr="dashboard_comisiones",
            )
        )
        .order_by("-total_catedras", "apellido", "nombre")[:6]
    )

    docentes: list[DashboardDocente] = []

    for docente in docentes_qs:
        catedras: list[DashboardCatedra] = []

        for com in getattr(docente, "dashboard_comisiones", []):
            materia = com.materia

            if not materia:
                continue

            profesorado = materia.plan_de_estudio.profesorado if materia.plan_de_estudio_id else None

            catedras.append(
                DashboardCatedra(
                    id=com.id,
                    materia=materia.nombre,
                    profesorado=profesorado.nombre if profesorado else "",
                    anio_lectivo=com.anio_lectivo,
                    turno=com.turno.nombre if com.turno_id else None,
                )
            )

        docentes.append(
            DashboardDocente(
                id=docente.id,
                nombre=f"{docente.apellido}, {docente.nombre}".strip(", "),
                documento=docente.dni,
                total_catedras=docente.total_catedras,
                catedras=catedras,
            )
        )

    profesorados_qs = Profesorado.objects.annotate(
        planes_total=Count("planes", distinct=True),
        materias_total=Count("planes__materias", distinct=True),
        correlativas_total=Count("planes__materias__correlativas_requeridas", distinct=True),
    ).order_by("nombre")

    profesorados = [
        DashboardProfesorado(
            id=p.id,
            nombre=p.nombre,
            planes=p.planes_total,
            materias=p.materias_total,
            correlativas=p.correlativas_total,
        )
        for p in profesorados_qs
    ]

    pre_total = Preinscripcion.objects.count()

    estado_counts = [
        DashboardPreinsEstado(estado=row["estado"] or "Sin estado", total=row["total"])
        for row in Preinscripcion.objects.values("estado").annotate(total=Count("id")).order_by("estado")
    ]

    recientes_pre = []

    for pre in (
        Preinscripcion.objects.filter(estado="Confirmada")
        .select_related("estudiante__user", "carrera")
        .order_by("-updated_at")[:6]
    ):
        estudiante = pre.estudiante

        user = getattr(estudiante, "user", None)

        recientes_pre.append(
            DashboardPreinsDetalle(
                id=pre.id,
                codigo=pre.codigo,
                estudiante=(user.get_full_name() if user else str(estudiante.dni)),
                carrera=pre.carrera.nombre if pre.carrera_id else None,
                fecha=(pre.updated_at or pre.created_at).isoformat() if (pre.updated_at or pre.created_at) else None,
            )
        )

    preinscripciones = DashboardPreinscripciones(
        total=pre_total,
        por_estado=estado_counts,
        recientes=recientes_pre,
    )

    horarios = [
        DashboardHorario(
            profesorado_id=row["espacio__plan_de_estudio__profesorado__id"],
            profesorado=row["espacio__plan_de_estudio__profesorado__nombre"],
            anio_cursada=row["anio_cursada"],
            cantidad=row["total"],
        )
        for row in (
            HorarioCatedra.objects.values(
                "espacio__plan_de_estudio__profesorado__id",
                "espacio__plan_de_estudio__profesorado__nombre",
                "anio_cursada",
            )
            .annotate(total=Count("id"))
            .order_by(
                "espacio__plan_de_estudio__profesorado__nombre",
                "anio_cursada",
            )
        )
    ]

    cambios_qs = (
        InscripcionMateriaEstudiante.objects.filter(comision_solicitada__isnull=False)
        .select_related(
            "estudiante__user",
            "materia__plan_de_estudio__profesorado",
            "comision",
            "comision_solicitada",
            "comision__turno",
            "comision_solicitada__turno",
        )
        .order_by("-updated_at")[:10]
    )

    cambios = []

    for cambio in cambios_qs:
        estudiante = cambio.estudiante

        user = getattr(estudiante, "user", None)

        materia = cambio.materia

        profesorado = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio_id else None

        cambios.append(
            DashboardCambioComision(
                id=cambio.id,
                estudiante=(user.get_full_name() if user else estudiante.dni),
                dni=estudiante.dni,
                materia=materia.nombre if materia else "",
                profesorado=profesorado.nombre if profesorado else None,
                comision_actual=f"{cambio.comision.codigo} ({cambio.comision.turno.nombre})"
                if cambio.comision_id and cambio.comision.turno_id
                else (cambio.comision.codigo if cambio.comision_id else None),
                comision_solicitada=f"{cambio.comision_solicitada.codigo} ({cambio.comision_solicitada.turno.nombre})"
                if cambio.comision_solicitada_id and cambio.comision_solicitada.turno_id
                else (cambio.comision_solicitada.codigo if cambio.comision_solicitada_id else None),
                estado=cambio.get_estado_display(),
                actualizado=(cambio.updated_at or cambio.created_at).isoformat()
                if (cambio.updated_at or cambio.created_at)
                else "",
            )
        )

    pedidos_qs = PedidoAnalitico.objects.select_related("estudiante__user", "profesorado").order_by("-created_at")[:10]

    pedidos_analiticos = [
        DashboardPedidoAnalitico(
            id=p.id,
            estudiante=(p.estudiante.user.get_full_name() if p.estudiante.user_id else p.estudiante.dni),
            dni=p.estudiante.dni,
            fecha=p.created_at.isoformat(),
            motivo=p.get_motivo_display(),
            profesorado=p.profesorado.nombre if p.profesorado_id else None,
        )
        for p in pedidos_qs
    ]

    inscripciones_qs = (
        InscripcionMesa.objects.filter(estado=InscripcionMesa.Estado.INSCRIPTO)
        .values("mesa__tipo")
        .annotate(total=Count("id"))
    )

    mesas = DashboardMesas(
        total=sum(row["total"] for row in inscripciones_qs),
        por_tipo=[
            DashboardMesaTipo(
                tipo=MesaExamen.Tipo(row["mesa__tipo"]).label,
                total=row["total"],
            )
            for row in inscripciones_qs
        ],
    )

    regularidades_qs = Regularidad.objects.select_related(
        "estudiante__user", "materia__plan_de_estudio__profesorado"
    ).order_by("-fecha_cierre")[:10]

    regularidades = []

    for reg in regularidades_qs:
        estudiante = reg.estudiante

        user = getattr(estudiante, "user", None)

        materia = reg.materia

        profesorado = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio_id else None

        nota = None

        if reg.nota_final_cursada is not None:
            nota = str(reg.nota_final_cursada)

        elif reg.nota_trabajos_practicos is not None:
            nota = str(reg.nota_trabajos_practicos)

        regularidades.append(
            DashboardRegularidad(
                id=reg.id,
                estudiante=(user.get_full_name() if user else estudiante.dni),
                dni=estudiante.dni,
                materia=materia.nombre if materia else "",
                profesorado=profesorado.nombre if profesorado else None,
                situacion=reg.get_situacion_display(),
                nota=nota,
                fecha=reg.fecha_cierre.isoformat(),
            )
        )

    today = date.today()

    ventanas = []

    for ventana in VentanaHabilitacion.objects.order_by("-desde")[:12]:
        if ventana.activo and ventana.desde <= today <= ventana.hasta:
            estado = "Activa"

        elif ventana.desde > today:
            estado = "Pendiente"

        else:
            estado = "Pasada"

        ventanas.append(
            DashboardVentana(
                id=ventana.id,
                tipo=ventana.get_tipo_display() if hasattr(ventana, "get_tipo_display") else ventana.tipo,
                desde=ventana.desde.isoformat(),
                hasta=ventana.hasta.isoformat(),
                activo=ventana.activo,
                estado=estado,
            )
        )

    return GlobalOverviewOut(
        docentes=docentes,
        profesorados=profesorados,
        preinscripciones=preinscripciones,
        horarios=horarios,
        pedidos_comision=cambios,
        pedidos_analiticos=pedidos_analiticos,
        mesas=mesas,
        regularidades=regularidades,
        ventanas=ventanas,
    )


@router.get(
    "/planes/{plan_id}/correlatividades_matrix",
    response=list[MateriaCorrelatividadRow],
    auth=JWTAuth(),
)
def correlatividades_por_plan(
    request,
    plan_id: int,
    anio_cursada: int | None = None,
    nombre: str | None = None,
    regimen: str | None = None,
    formato: str | None = None,
    version_id: int | None = None,
    cohorte: int | None = None,
):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)

    _ensure_structure_view(request.user, plan.profesorado_id)

    materias = plan.materias.all().order_by("anio_cursada", "nombre")

    if anio_cursada is not None:
        materias = materias.filter(anio_cursada=anio_cursada)

    if nombre is not None and nombre != "":
        materias = materias.filter(nombre__icontains=nombre)

    if regimen is not None and regimen != "":
        materias = materias.filter(regimen=regimen)

    if formato is not None and formato != "":
        materias = materias.filter(formato=formato)

    version = _resolve_version_for_plan(plan=plan, version_id=version_id, cohorte=cohorte)

    rows: list[MateriaCorrelatividadRow] = []

    corr_map = {}

    corr_qs = Correlatividad.objects.filter(materia_origen__in=materias)
    if version:
        corr_qs = corr_qs.filter(versiones__version=version)

    for c in corr_qs:
        corr_map.setdefault(c.materia_origen_id, []).append(c)

    for m in materias:
        setvals = _to_set_out(corr_map.get(m.id, []))

        rows.append(
            MateriaCorrelatividadRow(
                id=m.id,
                nombre=m.nombre,
                anio_cursada=m.anio_cursada,
                regimen=m.regimen,
                formato=m.formato,
                regular_para_cursar=setvals["regular_para_cursar"],
                aprobada_para_cursar=setvals["aprobada_para_cursar"],
                aprobada_para_rendir=setvals["aprobada_para_rendir"],
            )
        )

    return rows


@router.put("/ventanas/{ventana_id}", response=VentanaOut, auth=JWTAuth())
def update_ventana(request, ventana_id: int, payload: VentanaIn):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})

    obj = get_object_or_404(VentanaHabilitacion, id=ventana_id)

    obj.tipo = payload.tipo

    obj.desde = payload.desde

    obj.hasta = payload.hasta

    obj.activo = payload.activo

    obj.periodo = payload.periodo

    obj.save()

    return obj


@router.delete("/ventanas/{ventana_id}", response={204: None}, auth=JWTAuth())
def delete_ventana(request, ventana_id: int):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})

    obj = get_object_or_404(VentanaHabilitacion, id=ventana_id)

    obj.delete()

    return 204, None


# ===== Mesas de Examen (Secretaría/Bedel) =====


class MesaIn(Schema):
    materia_id: int

    tipo: str  # 'FIN' | 'EXT' | 'ESP'

    modalidad: str = MesaExamen.Modalidad.REGULAR

    fecha: date

    hora_desde: str | None = None

    hora_hasta: str | None = None

    aula: str | None = None

    cupo: int | None = 0

    ventana_id: int | None = None

    docente_presidente_id: int | None = None

    docente_vocal1_id: int | None = None

    docente_vocal2_id: int | None = None


class MesaDocenteOut(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str | None = None
    dni: str | None = None


class MesaOut(Schema):
    id: int

    materia_id: int

    materia_nombre: str

    profesorado_id: int | None = None

    profesorado_nombre: str | None = None

    plan_id: int | None = None

    plan_resolucion: str | None = None

    anio_cursada: int | None = None

    regimen: str | None = None

    tipo: str

    modalidad: str

    fecha: date

    hora_desde: str | None

    hora_hasta: str | None

    aula: str | None

    cupo: int

    codigo: str | None = None

    docentes: list[MesaDocenteOut] = Field(default_factory=list)


@router.get("/mesas", response=list[MesaOut])
def list_mesas(
    request,
    ventana_id: int | None = None,
    tipo: str | None = None,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    anio: int | None = None,
    cuatrimestre: str | None = None,
    materia_id: int | None = None,
    codigo: str | None = None,
):
    qs = (
        MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado").all().order_by("fecha", "hora_desde")
    )

    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)

    if tipo:
        qs = qs.filter(tipo=tipo)

    if profesorado_id:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)

    if plan_id:
        qs = qs.filter(materia__plan_de_estudio_id=plan_id)

    if anio:
        qs = qs.filter(materia__anio_cursada=anio)

    if cuatrimestre:
        qs = qs.filter(materia__regimen=cuatrimestre)

    if materia_id:
        qs = qs.filter(materia_id=materia_id)

    if codigo:
        qs = qs.filter(codigo__icontains=codigo.strip())

    resultado: list[MesaOut] = []

    for mesa in qs:
        resultado.append(_serialize_mesa(mesa))

    return resultado


def _mesa_docentes_payload(mesa: MesaExamen) -> list[MesaDocenteOut]:
    docentes_info: list[MesaDocenteOut] = []
    mapping = [
        ("PRES", getattr(mesa, "docente_presidente", None)),
        ("VOC1", getattr(mesa, "docente_vocal1", None)),
        ("VOC2", getattr(mesa, "docente_vocal2", None)),
    ]
    for rol, docente in mapping:
        if not docente:
            continue
        nombre = ", ".join(filter(None, [docente.apellido, docente.nombre])).strip(", ")
        docentes_info.append(
            MesaDocenteOut(
                rol=rol,
                docente_id=docente.id,
                nombre=nombre or docente.email or "",
                dni=docente.dni or "",
            )
        )
    return docentes_info


def _serialize_mesa(mesa: MesaExamen) -> MesaOut:
    materia = mesa.materia
    plan = materia.plan_de_estudio if materia else None
    profesorado = plan.profesorado if plan else None
    return MesaOut(
        id=mesa.id,
        materia_id=materia.id if materia else 0,
        materia_nombre=materia.nombre if materia else "",
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        plan_id=plan.id if plan else None,
        plan_resolucion=plan.resolucion if plan else None,
        anio_cursada=materia.anio_cursada if materia else None,
        regimen=materia.regimen if materia else None,
        tipo=mesa.tipo,
        modalidad=mesa.modalidad,
        fecha=mesa.fecha,
        hora_desde=mesa.hora_desde.isoformat() if mesa.hora_desde else None,
        hora_hasta=mesa.hora_hasta.isoformat() if mesa.hora_hasta else None,
        aula=mesa.aula or None,
        cupo=mesa.cupo,
        codigo=mesa.codigo or "",
        docentes=_mesa_docentes_payload(mesa),
    )


def _normalize_mesa_tipo(tipo: str) -> str:
    valid = {choice for choice, _label in MesaExamen.Tipo.choices}
    if tipo not in valid:
        raise HttpError(400, "Tipo de mesa inválido.")
    return tipo


def _normalize_mesa_modalidad(modalidad: str) -> str:
    valid = {choice for choice, _label in MesaExamen.Modalidad.choices}
    if modalidad not in valid:
        raise HttpError(400, "Modalidad de mesa inválida.")
    return modalidad


def _resolve_mesa_ventana(tipo: str, ventana_id: int | None) -> VentanaHabilitacion | None:
    tipo = _normalize_mesa_tipo(tipo)
    if tipo == MesaExamen.Tipo.ESPECIAL:
        # Las mesas especiales no dependen de ventana
        return None
    if not ventana_id:
        raise HttpError(400, "Debe seleccionar una ventana habilitada para este tipo de mesa.")
    ventana = get_object_or_404(VentanaHabilitacion, id=ventana_id)
    if tipo == MesaExamen.Tipo.FINAL and ventana.tipo != VentanaHabilitacion.Tipo.MESAS_FINALES:
        raise HttpError(400, "La ventana seleccionada no corresponde a mesas ordinarias.")
    if (
        tipo == MesaExamen.Tipo.EXTRAORDINARIA
        and ventana.tipo != VentanaHabilitacion.Tipo.MESAS_EXTRA
    ):
        raise HttpError(400, "La ventana seleccionada no corresponde a mesas extraordinarias.")
    return ventana


@router.post("/mesas", response=MesaOut)
def crear_mesa(request, payload: MesaIn):
    mat = get_object_or_404(Materia, id=payload.materia_id)
    tipo = _normalize_mesa_tipo(payload.tipo)
    modalidad = _normalize_mesa_modalidad(payload.modalidad)
    ventana_destino = _resolve_mesa_ventana(tipo, payload.ventana_id)

    mesa = MesaExamen.objects.create(
        materia=mat,
        tipo=tipo,
        modalidad=modalidad,
        fecha=payload.fecha,
        hora_desde=payload.hora_desde or None,
        hora_hasta=payload.hora_hasta or None,
        aula=payload.aula or None,
        cupo=payload.cupo or 0,
        ventana=ventana_destino,
        docente_presidente_id=payload.docente_presidente_id,
        docente_vocal1_id=payload.docente_vocal1_id,
        docente_vocal2_id=payload.docente_vocal2_id,
    )

    return _serialize_mesa(mesa)


@router.put("/mesas/{mesa_id}", response=MesaOut)
def actualizar_mesa(request, mesa_id: int, payload: MesaIn):
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    tipo = _normalize_mesa_tipo(payload.tipo)
    modalidad = _normalize_mesa_modalidad(payload.modalidad)
    ventana_param = payload.ventana_id
    if ventana_param is None and tipo != MesaExamen.Tipo.ESPECIAL:
        ventana_param = mesa.ventana_id
    ventana_destino = _resolve_mesa_ventana(tipo, ventana_param)

    mesa.tipo = tipo
    mesa.modalidad = modalidad
    mesa.ventana = ventana_destino

    for k, v in payload.dict().items():
        if k in {"tipo", "modalidad", "ventana_id"}:
            continue
        if k == "materia_id":
            mesa.materia = get_object_or_404(Materia, id=v)
        elif hasattr(mesa, k):
            setattr(mesa, k, v)

    mesa.save()

    mesa.refresh_from_db()
    return _serialize_mesa(mesa)


@router.delete("/mesas/{mesa_id}", response={204: None})
def eliminar_mesa(request, mesa_id: int):
    mesa = get_object_or_404(MesaExamen, id=mesa_id)

    mesa.delete()

    return 204, None


# Mensajería endpoints


@router.get("/mensajes/temas", response=list[MessageTopicOut], auth=JWTAuth())
def list_message_topics(request):
    qs = MessageTopic.objects.filter(is_active=True).order_by("name")
    return [
        MessageTopicOut(
            id=topic.id,
            slug=topic.slug,
            name=topic.name,
            description=topic.description,
        )
        for topic in qs
    ]


@router.get("/usuarios/buscar", response=list[SimpleUserOut], auth=JWTAuth())
def search_users(request, q: str = Query(...)):
    query = (q or "").strip()
    if len(query) < 2:
        return []
    like = (
        Q(first_name__icontains=query)
        | Q(last_name__icontains=query)
        | Q(username__icontains=query)
        | Q(email__icontains=query)
        | Q(estudiante__dni__icontains=query)
    )
    users = (
        User.objects.filter(like, is_active=True)
        .select_related("estudiante")
        .distinct()
        .order_by("last_name", "first_name", "username")[:20]
    )
    results: list[SimpleUserOut] = []
    for candidate in users:
        if candidate.id == request.user.id:
            continue
        if not _can_send_individual(request.user, candidate):
            continue
        results.append(
            SimpleUserOut(
                id=candidate.id,
                name=_user_display(candidate),
                roles=sorted(_normalized_user_roles(candidate)),
            )
        )
    return results


@router.get("/mensajes/conversaciones", response=list[ConversationSummaryOut], auth=JWTAuth())
def list_conversations(request, filters: ConversationListQuery = Query(...)):  # noqa: B008
    user = request.user
    qs = Conversation.objects.filter(participants__user=user).distinct()
    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.topic_id:
        qs = qs.filter(topic_id=filters.topic_id)
    if filters.unread:
        qs = qs.filter(
            Q(last_message_at__isnull=False),
            Q(participants__user=user),
            Q(participants__last_read_at__lt=F("last_message_at")) | Q(participants__last_read_at__isnull=True),
        )
    qs = qs.prefetch_related(
        Prefetch(
            "participants",
            queryset=ConversationParticipant.objects.select_related("user"),
        ),
        Prefetch(
            "messages",
            queryset=Message.objects.select_related("author").order_by("-created_at")[:1],
            to_attr="_last_message_list",
        ),
        "topic",
    ).order_by("-updated_at")

    results: list[ConversationSummaryOut] = []
    for conversation in qs:
        participants = list(conversation.participants.all())
        viewer_participant = next((p for p in participants if p.user_id == user.id), None)
        if not viewer_participant:
            continue
        last_message = getattr(conversation, "_last_message_list", [])
        last_message = last_message[0] if last_message else None
        conversation._last_message = last_message
        participants_out = [
            ConversationParticipantOut(
                id=participant.id,
                user_id=participant.user_id,
                name=_user_display(participant.user),
                roles=sorted(_normalized_user_roles(participant.user)),
                can_reply=participant.can_reply,
                last_read_at=participant.last_read_at,
            )
            for participant in participants
        ]
        excerpt = None
        if last_message and last_message.body:
            excerpt = last_message.body.strip()[:140]
        results.append(
            ConversationSummaryOut(
                id=conversation.id,
                subject=conversation.subject,
                topic=_get_conversation_topic(conversation),
                status=conversation.status,
                is_massive=conversation.is_massive,
                allow_student_reply=conversation.allow_student_reply,
                last_message_at=conversation.last_message_at,
                unread=_conversation_unread(conversation, viewer_participant),
                sla=_compute_sla_indicator(conversation, viewer_participant),
                participants=participants_out,
                last_message_excerpt=excerpt,
            )
        )
    return results


@router.post("/mensajes/conversaciones", response=ConversationCreateOut, auth=JWTAuth())
def create_conversation_endpoint(request, payload: ConversationCreateIn):
    user = request.user
    sender_roles = _normalized_user_roles(user)
    if sender_roles & ROLES_FORBIDDEN_SENDER:
        raise HttpError(403, "No tienes permisos para iniciar conversaciones.")
    if not payload.body.strip():
        raise HttpError(400, "El mensaje no puede estar vacío.")

    targets: dict[int, dict[str, object]] = {}

    if payload.recipients:
        users = list(User.objects.filter(id__in=payload.recipients, is_active=True))
        found_ids = {u.id for u in users}
        missing = set(payload.recipients) - found_ids
        if missing:
            raise HttpError(404, f"Usuarios no encontrados: {sorted(missing)}")
        for recipient in users:
            if not _can_send_individual(user, recipient):
                raise HttpError(
                    403,
                    f"No tienes permisos para contactar a { _user_display(recipient) }.",
                )
            targets[recipient.id] = {
                "user": recipient,
                "is_massive": False,
                "recipient_roles": _normalized_user_roles(recipient),
            }

    if payload.roles:
        carreras_filter = payload.carreras or []
        for role in payload.roles:
            recipients = _resolve_mass_recipients(user, role, carreras_filter)
            for recipient in recipients:
                entry = targets.setdefault(
                    recipient.id,
                    {
                        "user": recipient,
                        "is_massive": False,
                        "recipient_roles": _normalized_user_roles(recipient),
                    },
                )
                entry["is_massive"] = True
                entry.setdefault("mass_roles", set()).add(role.lower())

    if not targets:
        raise HttpError(400, "Debes seleccionar destinatarios válidos.")

    topic = None
    if payload.topic_id is not None:
        topic = get_object_or_404(MessageTopic, pk=payload.topic_id, is_active=True)

    created_ids: list[int] = []
    for entry in targets.values():
        recipient: User = entry["user"]  # type: ignore[assignment]
        is_massive = bool(entry.get("is_massive"))
        recipient_roles = entry.get("recipient_roles") or set()
        allow_student_reply = _conversation_allow_student_reply(
            is_massive,
            recipient_roles,
            payload.allow_student_reply,
        )
        conversation = _create_conversation(
            sender=user,
            recipient=recipient,
            subject=payload.subject,
            topic=topic,
            body=payload.body,
            allow_student_reply=allow_student_reply,
            context_type=payload.context_type,
            context_id=payload.context_id,
            is_massive=is_massive,
        )
        created_ids.append(conversation.id)

    return ConversationCreateOut(created_ids=created_ids, total_recipients=len(created_ids))


@router.get(
    "/mensajes/conversaciones/{conversation_id}",
    response=ConversationDetailOut,
    auth=JWTAuth(),
)
def get_conversation_detail(request, conversation_id: int, mark_read: bool = Query(False)):
    user = request.user
    conversation = get_object_or_404(
        Conversation.objects.filter(participants__user=user).prefetch_related(
            Prefetch(
                "participants",
                queryset=ConversationParticipant.objects.select_related("user"),
            ),
            Prefetch(
                "messages",
                queryset=Message.objects.select_related("author").order_by("created_at"),
            ),
            "topic",
        ),
        pk=conversation_id,
    )
    participants = list(conversation.participants.all())
    viewer_participant = next((p for p in participants if p.user_id == user.id), None)
    if not viewer_participant:
        raise HttpError(403, "No participas de esta conversación.")
    if mark_read:
        viewer_participant.mark_read()
    conversation._last_message = conversation.messages.last()

    participants_out = [
        ConversationParticipantOut(
            id=participant.id,
            user_id=participant.user_id,
            name=_user_display(participant.user),
            roles=sorted(_normalized_user_roles(participant.user)),
            can_reply=participant.can_reply,
            last_read_at=participant.last_read_at,
        )
        for participant in participants
    ]

    messages_out: list[MessageOut] = []
    for message in conversation.messages.all():
        attachment_url = None
        attachment_name = None
        if message.attachment:
            try:
                attachment_url = request.build_absolute_uri(message.attachment.url)
            except Exception:
                attachment_url = message.attachment.url
            attachment_name = message.attachment.name.rsplit("/", 1)[-1]
        messages_out.append(
            MessageOut(
                id=message.id,
                author_id=message.author_id,
                author_name=_user_display(message.author) if message.author else "Sistema",
                body=message.body,
                created_at=message.created_at,
                attachment_url=attachment_url,
                attachment_name=attachment_name,
            )
        )

    summary = ConversationSummaryOut(
        id=conversation.id,
        subject=conversation.subject,
        topic=_get_conversation_topic(conversation),
        status=conversation.status,
        is_massive=conversation.is_massive,
        allow_student_reply=conversation.allow_student_reply,
        last_message_at=conversation.last_message_at,
        unread=_conversation_unread(conversation, viewer_participant),
        sla=_compute_sla_indicator(conversation, viewer_participant),
        participants=participants_out,
        last_message_excerpt=None,
    )

    return ConversationDetailOut(**summary.dict(), messages=messages_out)


@router.post(
    "/mensajes/conversaciones/{conversation_id}/mensajes",
    response=MessageOut,
    auth=JWTAuth(),
)
def send_message(
    request,
    conversation_id: int,
    body: str = Form(...),
    attachment: UploadedFile | None = File(None),  # noqa: B008
):
    user = request.user
    conversation = get_object_or_404(
        Conversation.objects.prefetch_related(
            Prefetch(
                "participants",
                queryset=ConversationParticipant.objects.select_related("user"),
            )
        ),
        pk=conversation_id,
    )
    participant = conversation.participants.filter(user=user).first()
    if not participant:
        raise HttpError(403, "No participas de esta conversación.")
    if not participant.can_reply:
        raise HttpError(403, "No podes responder en esta conversación.")
    if not body.strip():
        raise HttpError(400, "El mensaje no puede estar vacío.")
    try:
        message = _add_message(conversation, user, body, attachment)
    except ValidationError as exc:
        raise HttpError(400, "; ".join(exc.messages)) from exc

    attachment_url = None
    attachment_name = None
    if message.attachment:
        try:
            attachment_url = request.build_absolute_uri(message.attachment.url)
        except Exception:
            attachment_url = message.attachment.url
        attachment_name = message.attachment.name.rsplit("/", 1)[-1]

    return MessageOut(
        id=message.id,
        author_id=message.author_id,
        author_name=_user_display(message.author) if message.author else "Sistema",
        body=message.body,
        created_at=message.created_at,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
    )


@router.post(
    "/mensajes/conversaciones/{conversation_id}/leer",
    response=SimpleOk,
    auth=JWTAuth(),
)
def mark_conversation_read(request, conversation_id: int):
    participant = get_object_or_404(
        ConversationParticipant,
        conversation_id=conversation_id,
        user=request.user,
    )
    participant.mark_read()
    return SimpleOk()


@router.post(
    "/mensajes/conversaciones/{conversation_id}/solicitar-cierre",
    response=SimpleOk,
    auth=JWTAuth(),
)
def request_conversation_close(request, conversation_id: int):
    conversation = get_object_or_404(
        Conversation.objects.filter(participants__user=request.user),
        pk=conversation_id,
    )
    if conversation.status != Conversation.Status.OPEN:
        raise HttpError(400, "La conversación no está abierta.")
    if conversation.is_massive and conversation.created_by_id != request.user.id:
        raise HttpError(403, "No podés solicitar cierre en un mensaje masivo.")
    conversation.status = Conversation.Status.CLOSE_REQUESTED
    conversation.close_requested_by = request.user
    conversation.close_requested_at = timezone.now()
    conversation.save(update_fields=["status", "close_requested_by", "close_requested_at"])
    ConversationAudit.objects.create(
        conversation=conversation,
        action=ConversationAudit.Action.CLOSE_REQUESTED,
        actor=request.user,
        payload={},
    )
    return SimpleOk()


@router.post(
    "/mensajes/conversaciones/{conversation_id}/cerrar",
    response=SimpleOk,
    auth=JWTAuth(),
)
def close_conversation(request, conversation_id: int):
    conversation = get_object_or_404(
        Conversation.objects.filter(participants__user=request.user),
        pk=conversation_id,
    )
    user = request.user
    sender_roles = _normalized_user_roles(user)
    if conversation.created_by_id not in {user.id, None} and not (sender_roles & {"admin", "secretaria"}):
        raise HttpError(403, "Solo el remitente puede cerrar la conversación.")
    conversation.status = Conversation.Status.CLOSED
    conversation.closed_by = user
    conversation.closed_at = timezone.now()
    conversation.save(update_fields=["status", "closed_by", "closed_at"])
    ConversationAudit.objects.create(
        conversation=conversation,
        action=ConversationAudit.Action.CLOSED,
        actor=user,
        payload={},
    )
    return SimpleOk()


@router.get("/mensajes/resumen/", response=ConversationCountsOut, auth=JWTAuth())
def conversations_summary(request):
    user = request.user
    qs = (
        Conversation.objects.filter(participants__user=user)
        .distinct()
        .prefetch_related(
            Prefetch(
                "participants",
                queryset=ConversationParticipant.objects.select_related("user"),
            ),
            Prefetch(
                "messages",
                queryset=Message.objects.order_by("-created_at")[:1],
                to_attr="_last_message_list",
            ),
        )
    )
    unread = 0
    warning = 0
    danger = 0
    for conversation in qs:
        participants = list(conversation.participants.all())
        viewer_participant = next((p for p in participants if p.user_id == user.id), None)
        if not viewer_participant:
            continue
        last_message = getattr(conversation, "_last_message_list", [])
        conversation._last_message = last_message[0] if last_message else None
        if _conversation_unread(conversation, viewer_participant):
            unread += 1
        indicator = _compute_sla_indicator(conversation, viewer_participant)
        if indicator == "warning":
            warning += 1
        elif indicator == "danger":
            danger += 1
    return ConversationCountsOut(unread=unread, sla_warning=warning, sla_danger=danger)


@router.get("/users/list", response=List[UserSchema], auth=JWTAuth())
def list_users_admin(request):
    docente_dnis = Docente.objects.values_list('dni', flat=True)
    users = User.objects.filter(Q(username__in=docente_dnis) | Q(groups__name__in=['admin', 'bedel', 'docente', 'coordinador', 'tutor']) | Q(is_superuser=True) | Q(is_staff=True)).distinct().prefetch_related('groups').order_by('last_name')
    return [
        {
            "id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "groups": [g.name for g in u.groups.all()]
        } for u in users
    ]

@router.post("/asignar-rol", auth=JWTAuth())
def asignar_rol(request, data: AsignarRolIn):
    user = get_object_or_404(User, id=data.user_id)
    group = get_object_or_404(Group, name=data.role)
    
    if data.action == "remove":
        user.groups.remove(group)
        if data.role in ["bedel", "coordinador", "tutor"]:
             if data.profesorado_ids:
                 StaffAsignacion.objects.filter(user=user, rol=data.role, profesorado_id__in=data.profesorado_ids).delete()
             else:
                 StaffAsignacion.objects.filter(user=user, rol=data.role).delete()
        return {"message": f"Rol {data.role} quitado correctamente"}

    user.groups.add(group)

    if data.role in ["bedel", "coordinador", "tutor"] and data.profesorado_ids:
        for prof_id in data.profesorado_ids:
            StaffAsignacion.objects.get_or_create(
                profesorado_id=prof_id,
                user=user,
                rol=data.role
            )
    return {"message": f"Rol {data.role} asignado correctamente"}

management_router = Router(tags=["management"], auth=JWTAuth())

@management_router.get("/users-list", response=List[UserSchema])
def list_users_admin_v2(request):
    docente_dnis = Docente.objects.values_list('dni', flat=True)
    users = User.objects.filter(Q(username__in=docente_dnis) | Q(groups__name__in=['admin', 'bedel', 'docente', 'coordinador', 'tutor']) | Q(is_superuser=True) | Q(is_staff=True)).distinct().prefetch_related('groups').order_by('last_name')
    return [
        {
            "id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "groups": [g.name for g in u.groups.all()]
        } for u in users
    ]

@management_router.post("/asignar-rol")
def asignar_rol_v2(request, data: AsignarRolIn):
    user = get_object_or_404(User, id=data.user_id)
    group, _ = Group.objects.get_or_create(name=data.role)
    
    if data.action == "remove":
        user.groups.remove(group)
        if data.role in ["bedel", "coordinador", "tutor"]:
             StaffAsignacion.objects.filter(user=user, rol=data.role).delete()
        return {"message": f"Rol {data.role} quitado correctamente"}

    user.groups.add(group)

    if data.role in ["bedel", "coordinador", "tutor"] and data.profesorado_ids:
        for prof_id in data.profesorado_ids:
            StaffAsignacion.objects.get_or_create(
                profesorado_id=prof_id,
                user=user,
                rol=data.role
            )
    return {"message": f"Rol {data.role} asignado correctamente"}
