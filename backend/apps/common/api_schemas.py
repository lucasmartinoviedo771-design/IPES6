from typing import Any

from ninja import Schema


class ApiResponse(Schema):
    ok: bool
    message: str | None = None
    data: Any | None = None
