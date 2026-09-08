from ninja import Schema


class ChatMessage(Schema):
    role: str  # "user" | "assistant" | "model"
    content: str


class ChatRequestIn(Schema):
    mensaje: str
    historial: list[ChatMessage] = []
    contexto_materia_id: int | None = None


class ChatResponseOut(Schema):
    respuesta: str
    sugerencias: list[str] = []
    herramientas_ejecutadas: list[str] = []
    ok: bool = True


class SugerenciasOut(Schema):
    sugerencias: list[str]
