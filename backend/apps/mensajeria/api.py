from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Case, CharField, F, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import File, Router, Query, Form
from apps.common.date_utils import format_datetime
from ninja.errors import HttpError
from ninja.files import UploadedFile

from core.auth_ninja import JWTAuth
from core.models import (
    Conversation,
    ConversationAudit,
    ConversationParticipant,
    Docente,
    Estudiante,
    Message,
    MessageTopic,
    StaffAsignacion,
)
from core.permissions import (
    allowed_profesorados,
    ensure_profesorado_access,
    ensure_roles,
    get_user_roles,
)
from apps.common.api_schemas import ApiResponse

from .schemas import (
    ConversationCountsOut,
    ConversationCreateIn,
    ConversationCreateOut,
    ConversationDetailOut,
    ConversationListQuery,
    ConversationParticipantOut,
    ConversationSummaryOut,
    MessageOut,
    MessageTopicOut,
    SimpleUserOut,
)

router = Router(tags=["Mensajería"])

# --- CONSTANTES Y CONFIGURACIÓN ---

SLA_WARNING_DAYS = getattr(settings, "MESSAGES_SLA_WARNING_DAYS", 3)
SLA_DANGER_DAYS = getattr(settings, "MESSAGES_SLA_DANGER_DAYS", 6)

# REGLAS ORIGINALES (COMENTADAS PARA DESPUÉS)
# ROLE_MASS_RULES: dict[str, set[str] | None] = {
#     "admin": None,
#     "secretaria": None,
#     "jefa_aaee": None,
#     "jefes": None,
#     "coordinador": {"estudiante", "docente"},
#     "tutor": {"estudiante"},
#     "bedel": {"estudiante"},
# }
# ROLES_DIRECT_ALL = {"admin", "secretaria", "jefa_aaee", "jefes", "coordinador", "tutor", "bedel"}

# REGLAS ACTIVAS PARA PRUEBAS (SOLO BEDEL <-> ESTUDIANTE)
ROLE_MASS_RULES: dict[str, set[str] | None] = {
    "bedel": {"estudiante"},
}
ROLES_DIRECT_ALL = {"bedel"}

ROLE_STAFF_ASSIGNMENT = {
    "bedel": {"bedel"},
    "tutor": {"tutor"},
    "coordinador": {"coordinador"},
}

ROLES_FORBIDDEN_SENDER = set()

# --- FUNCIONES AUXILIARES ---



def _get_student(user: User) -> Estudiante | None:
    return getattr(user, "estudiante", None)

def _staff_profesorados(user: User, roles: set[str] | None = None) -> set[int]:
    qs = StaffAsignacion.objects.filter(user=user)
    if roles: qs = qs.filter(rol__in=roles)
    return set(qs.values_list("profesorado_id", flat=True))

def _student_profesorados(student: Estudiante) -> set[int]:
    return set(student.carreras.values_list("id", flat=True))

def _get_staff_for_student(student: Estudiante, role: str) -> set[User]:
    profes = _student_profesorados(student)
    if not profes: return set()
    qs = StaffAsignacion.objects.filter(profesorado_id__in=profes, rol=role).select_related("user")
    return {a.user for a in qs if a.user and a.user.is_active}

def _shared_profesorado(staff_user: User, student: Estudiante, roles: set[str]) -> bool:
    staff_prof = _staff_profesorados(staff_user, roles)
    if not staff_prof: return False
    return bool(staff_prof.intersection(_student_profesorados(student)))

def _allowed_mass_roles(sender_roles: set[str]) -> set[str] | None:
    roles: set[str] = set()
    allow_all = False
    for role in sender_roles:
        if role in ROLE_MASS_RULES:
            rule = ROLE_MASS_RULES[role]
            if rule is None: allow_all = True
            else: roles.update(rule)
    return None if allow_all else roles

def _can_send_individual(sender: User, target: User) -> bool:
    if sender == target: return False
    sender_roles = get_user_roles(sender)
    target_roles = get_user_roles(target)
    
    # --- LÓGICA ACTIVA (SOLO BEDEL <-> ESTUDIANTE) ---
    # Caso: Bedel -> Estudiante
    if "bedel" in sender_roles and "estudiante" in target_roles:
        student = _get_student(target)
        if not student: return False
        return _shared_profesorado(sender, student, {"bedel"})
    
    # Caso: Estudiante -> Bedel
    if "estudiante" in sender_roles and "bedel" in target_roles:
        student = _get_student(sender)
        if not student: return False
        allowed_bedels = _get_staff_for_student(student, "bedel")
        return target in allowed_bedels
        
    return False

    # --- LOGICA ORIGINAL (COMENTADA PARA DESPUÉS) ---
    # if sender_roles & ROLES_FORBIDDEN_SENDER: return False
    # if sender_roles & ROLES_DIRECT_ALL:
    #     if "estudiante" in target_roles:
    #         student = _get_student(target)
    #         if not student: return False
    #         if sender_roles & {"bedel"}: return _shared_profesorado(sender, student, {"bedel"})
    #         if sender_roles & {"coordinador"}:
    #             staff_ok = _shared_profesorado(sender, student, {"coordinador"})
    #             return staff_ok if staff_ok or _staff_profesorados(sender, {"coordinador"}) else True
    #         if sender_roles & {"tutor"}: return _shared_profesorado(sender, student, {"tutor"})
    #     return True
    
    # if "estudiante" in sender_roles:
    #     student = _get_student(sender)
    #     if not student: return False
    #     if not (target_roles & {"bedel", "tutor"}): return False
    #     allowed_users = _get_staff_for_student(student, "bedel") | _get_staff_for_student(student, "tutor")
    #     return target in allowed_users
    # return False

def _get_users_by_role(role: str, limit_profesorados: set[int] | None) -> list[User]:
    users_qs = User.objects.filter(is_active=True)
    if role == "estudiante":
        student_qs = Estudiante.objects.filter(user__in=users_qs)
        if limit_profesorados: student_qs = student_qs.filter(carreras__id__in=limit_profesorados)
        return list(User.objects.filter(id__in=student_qs.values_list("user_id", flat=True).distinct()))
    if role in ROLE_STAFF_ASSIGNMENT:
        assignments = StaffAsignacion.objects.filter(rol=role)
        if limit_profesorados: assignments = assignments.filter(profesorado_id__in=limit_profesorados)
        return list(User.objects.filter(id__in=assignments.values_list("user_id", flat=True).distinct()))
    return list(users_qs.filter(groups__name__iexact=role).distinct())

def _compute_sla_indicator(conversation: Conversation, participant: ConversationParticipant) -> str | None:
    last_msg = getattr(conversation, "_last_message", None) or conversation.messages.order_by("-created_at").first()
    if not last_msg or last_msg.author_id == participant.user_id: return None
    if participant.last_read_at and participant.last_read_at >= last_msg.created_at: return None
    delta_days = (timezone.now() - last_msg.created_at).days
    if delta_days >= SLA_DANGER_DAYS: return "danger"
    if delta_days >= SLA_WARNING_DAYS: return "warning"
    return None

def _primary_role(user: User) -> str | None:
    roles = get_user_roles(user)
    PRIORITY = ["admin", "secretaria", "jefa_aaee", "jefes", "coordinador", "tutor", "bedel", "consulta", "docente", "estudiante"]
    for role in PRIORITY:
        if role in roles: return role
    return sorted(roles)[0] if roles else None

def _create_conversation(*, sender, recipient, subject, topic, body, allow_student_reply, context_type, context_id, is_massive) -> Conversation:
    conversation = Conversation.objects.create(
        topic=topic, created_by=sender, subject=subject or "",
        context_type=context_type, context_id=context_id,
        status=Conversation.Status.OPEN, is_massive=is_massive,
        allow_student_reply=allow_student_reply
    )
    now = timezone.now()
    ConversationParticipant.objects.create(conversation=conversation, user=sender, role_snapshot=_primary_role(sender) or "", can_reply=True, last_read_at=now)
    r_roles = get_user_roles(recipient)
    r_can_reply = not ("estudiante" in r_roles and not allow_student_reply)
    ConversationParticipant.objects.create(conversation=conversation, user=recipient, role_snapshot=_primary_role(recipient) or "", can_reply=r_can_reply)
    msg = Message.objects.create(conversation=conversation, author=sender, body=body)
    conversation.last_message_at = msg.created_at
    conversation.updated_at = msg.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    return conversation

# --- ENDPOINTS ---

@router.get("/temas", response=list[MessageTopicOut], auth=JWTAuth())
def list_topics(request):
    return MessageTopic.objects.all().order_by("name")

@router.get("/usuarios/buscar", response=list[SimpleUserOut], auth=JWTAuth())
def search_users(request, q: str):
    if len(q) < 3: return []
    
    query = Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(username__icontains=q)
    
    # También permitir buscar por rol "bedel" o por el nombre de la carrera/profesorado
    q_low = q.lower()
    if "bedel" in q_low or q_low in "bedel":
        query |= Q(asignaciones_profesorado__rol="bedel")
    
    # Búsqueda por nombre de profesorado asignado
    query |= Q(asignaciones_profesorado__profesorado__nombre__icontains=q)

    users = User.objects.filter(query, is_active=True).distinct()[:20]
    print(f"DEBUG SEARCH: q={q}, users_found={[u.username for u in users]}")
    res = []
    for u in users:
        roles = get_user_roles(u)
        if _can_send_individual(request.user, u):
            name = u.get_full_name() or u.username
            
            # Enriquecer nombre con asignación si es staff
            if "bedel" in roles:
                profes_ids = _staff_profesorados(u, {"bedel"})
                if profes_ids:
                    # Traemos nombres de profesorados (podemos usar u.staffasignacion_set si queremos evitar query extra, 
                    # pero _staff_profesorados ya devuelve los IDs)
                    from core.models import Profesorado
                    nombres = list(Profesorado.objects.filter(id__in=profes_ids).values_list("nombre", flat=True))
                    # Limpiar nombres (quitar "Profesorado en", etc)
                    nombres_clean = [n.replace("Profesorado de Educación Secundaria en ", "").replace("Profesorado de Educación ", "").replace("Profesorado en ", "").strip() for n in nombres]
                    name = f"{name} (Bedel {', '.join(nombres_clean)})"
            
            res.append(SimpleUserOut(id=u.id, name=name, roles=list(roles)))
    return res

@router.get("/conversaciones", response=list[ConversationSummaryOut], auth=JWTAuth())
def list_conversations(request, filters: Query[ConversationListQuery]):
    participant_qs = ConversationParticipant.objects.filter(user=request.user).select_related("conversation__topic", "conversation__created_by")
    # Si hay una búsqueda de texto (q), ignoramos el filtro de estado para que sea una búsqueda global
    if filters.status and not filters.q: 
        participant_qs = participant_qs.filter(conversation__status=filters.status)
    if filters.topic_id: participant_qs = participant_qs.filter(conversation__topic_id=filters.topic_id)
    if filters.unread:
        participant_qs = participant_qs.filter(Q(last_read_at__isnull=True) | Q(last_read_at__lt=F("conversation__last_message_at")))
    if filters.q:
        participant_qs = participant_qs.filter(
            Q(conversation__subject__icontains=filters.q) |
            Q(conversation__messages__body__icontains=filters.q)
        ).distinct()
    
    res = []
    for p in participant_qs.order_by("-conversation__last_message_at")[:100]:
        c = p.conversation
        unread = not p.last_read_at or p.last_read_at < (c.last_message_at or c.created_at)
        
        # Obtener el preview del último mensaje
        last_msg = c.messages.order_by("-created_at").first()
        excerpt = (last_msg.body[:50] + "...") if last_msg and len(last_msg.body) > 50 else (last_msg.body if last_msg else None)

        res.append(ConversationSummaryOut(
            id=c.id, subject=c.subject, topic=c.topic.name if c.topic else None,
            status=c.status, is_massive=c.is_massive, allow_student_reply=c.allow_student_reply,
            last_message_at=c.last_message_at.isoformat() if c.last_message_at else None, 
            unread=unread,
            sla=_compute_sla_indicator(c, p),
            participants=[], # Opcional: llenar si es necesario
            last_message_excerpt=excerpt,
            closed_by_name=c.closed_by.get_full_name() or c.closed_by.username if c.closed_by else None,
            closed_at=c.closed_at.isoformat() if c.closed_at else None
        ))
    return res

@router.post("/conversaciones", response=ConversationCreateOut, auth=JWTAuth())
def create_conversation_view(request, payload: ConversationCreateIn):
    sender = request.user
    topic = get_object_or_404(MessageTopic, id=payload.topic_id) if payload.topic_id else None
    recipients = []

    if payload.recipients:
        for r_id in payload.recipients:
            r = get_object_or_404(User, id=r_id)
            if not _can_send_individual(sender, r):
                raise HttpError(403, f"No puedes enviar mensajes a {r.username}")
            recipients.append(r)
    elif payload.roles:
        # Lógica de envío masivo
        for role in payload.roles:
            recipients.extend(_get_users_by_role(role, set(payload.carreras or [])))
    
    if not recipients: raise HttpError(400, "No se especificaron destinatarios.")

    is_massive = len(recipients) > 1
    allow_reply = payload.allow_student_reply if payload.allow_student_reply is not None else not is_massive

    created_ids = []
    with transaction.atomic():
        for r in set(recipients):
            if r == sender: continue
            c = _create_conversation(
                sender=sender, recipient=r, subject=payload.subject, topic=topic,
                body=payload.body, allow_student_reply=allow_reply,
                context_type=payload.context_type, context_id=payload.context_id, is_massive=is_massive
            )
            created_ids.append(c.id)

    return {"created_ids": created_ids, "total_recipients": len(created_ids)}

@router.get("/conversaciones/{conversation_id}", response=ConversationDetailOut, auth=JWTAuth())
def get_conversation(request, conversation_id: int):
    participant = get_object_or_404(ConversationParticipant, conversation_id=conversation_id, user=request.user)
    c = participant.conversation
    messages = c.messages.all().order_by("created_at")
    
    # Marcar como leída
    participant.last_read_at = timezone.now()
    participant.save(update_fields=["last_read_at"])
    
    last_msg = messages.last()
    excerpt = (last_msg.body[:50] + "...") if last_msg and len(last_msg.body) > 50 else (last_msg.body if last_msg else None)
    
    return ConversationDetailOut(
        id=c.id, subject=c.subject, topic=c.topic.name if c.topic else None,
        status=c.status, is_massive=c.is_massive, allow_student_reply=c.allow_student_reply,
        last_message_at=c.last_message_at.isoformat() if c.last_message_at else None,
        unread=False, sla=None,
        participants=[ConversationParticipantOut(
            id=p.id, user_id=p.user_id, name=p.user.get_full_name() or p.user.username,
            roles=list(get_user_roles(p.user)), can_reply=p.can_reply,
            last_read_at=format_datetime(p.last_read_at)
        ) for p in c.participants.all().select_related("user")],
        last_message_excerpt=excerpt,
        closed_by_name=c.closed_by.get_full_name() or c.closed_by.username if c.closed_by else None,
        closed_at=c.closed_at.isoformat() if c.closed_at else None,
        messages=[MessageOut(
            id=m.id, author_id=m.author_id, author_name=m.author.get_full_name() or m.author.username,
            body=m.body, created_at=m.created_at.isoformat(),
            attachment_url=m.attachment.url if m.attachment else None,
            attachment_name=m.attachment.name if m.attachment else None
        ) for m in messages]
    )

@router.post("/conversaciones/{conversation_id}/mensajes", response=MessageOut, auth=JWTAuth())
def post_message(request, conversation_id: int, body: str = Form(...), attachment: UploadedFile = File(None)):
    participant = get_object_or_404(ConversationParticipant, conversation_id=conversation_id, user=request.user)
    if not participant.can_reply or participant.conversation.status == Conversation.Status.CLOSED:
        raise HttpError(403, "No puedes responder a esta conversación.")
    
    msg = Message.objects.create(conversation=participant.conversation, author=request.user, body=body, attachment=attachment)
    participant.conversation.last_message_at = msg.created_at
    participant.conversation.updated_at = msg.created_at
    participant.conversation.save(update_fields=["last_message_at", "updated_at"])
    
    participant.last_read_at = msg.created_at
    participant.save(update_fields=["last_read_at"])
    
    return MessageOut(
        id=msg.id, author_id=msg.author_id, author_name=msg.author.get_full_name() or msg.author.username,
        body=msg.body, created_at=msg.created_at.isoformat(),
        attachment_url=msg.attachment.url if msg.attachment else None,
        attachment_name=msg.attachment.name if msg.attachment else None
    )

@router.get("/resumen/", response=ConversationCountsOut, auth=JWTAuth())
def get_message_counts(request):
    participants = ConversationParticipant.objects.filter(user=request.user, conversation__status=Conversation.Status.OPEN)
    unread = 0
    warning = 0
    danger = 0
    for p in participants.select_related("conversation"):
        c = p.conversation
        if not p.last_read_at or p.last_read_at < c.last_message_at:
            unread += 1
        sla = _compute_sla_indicator(c, p)
        if sla == "warning": warning += 1
        elif sla == "danger": danger += 1
    return {"unread": unread, "sla_warning": warning, "sla_danger": danger}

@router.post("/conversaciones/{conversation_id}/cerrar", auth=JWTAuth())
def close_conversation(request, conversation_id: int):
    # Solo el bedel o admin debería poder cerrar? 
    # Por ahora permitimos a los participantes si el flujo lo requiere.
    part = get_object_or_404(ConversationParticipant, conversation_id=conversation_id, user=request.user)
    c = part.conversation
    c.status = Conversation.Status.CLOSED
    c.closed_by = request.user
    c.closed_at = timezone.now()
    c.save(update_fields=["status", "closed_by", "closed_at"])
    ConversationAudit.objects.create(conversation=c, actor=request.user, action=ConversationAudit.Action.CLOSED)
    return {"ok": True}

@router.post("/conversaciones/{conversation_id}/solicitar-cierre", auth=JWTAuth())
def request_close_conversation(request, conversation_id: int):
    part = get_object_or_404(ConversationParticipant, conversation_id=conversation_id, user=request.user)
    c = part.conversation
    c.status = Conversation.Status.CLOSE_REQUESTED
    c.close_requested_by = request.user
    c.close_requested_at = timezone.now()
    c.save(update_fields=["status", "close_requested_by", "close_requested_at"])
    ConversationAudit.objects.create(conversation=c, actor=request.user, action=ConversationAudit.Action.CLOSE_REQUESTED)
    return {"ok": True}

@router.post("/conversaciones/{conversation_id}/leer", auth=JWTAuth())
def mark_conversation_as_read(request, conversation_id: int):
    part = get_object_or_404(ConversationParticipant, conversation_id=conversation_id, user=request.user)
    part.last_read_at = timezone.now()
    part.save(update_fields=["last_read_at"])
    return {"ok": True}
