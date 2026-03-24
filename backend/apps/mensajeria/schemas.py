from ninja import Schema
from datetime import datetime

class ConversationParticipantOut(Schema):
    id: int
    user_id: int
    name: str
    roles: list[str]
    can_reply: bool
    last_read_at: str | None

class MessageOut(Schema):
    id: int
    author_id: int | None
    author_name: str
    body: str
    created_at: str
    attachment_url: str | None
    attachment_name: str | None

class ConversationSummaryOut(Schema):
    id: int
    subject: str
    topic: str | None
    status: str
    is_massive: bool
    allow_student_reply: bool
    last_message_at: str | None
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
    q: str | None = None

class ConversationCountsOut(Schema):
    unread: int
    sla_warning: int
    sla_danger: int

class MessageTopicOut(Schema):
    id: int
    slug: str
    name: str
    description: str | None

class SimpleUserOut(Schema):
    id: int
    name: str
    roles: list[str]
