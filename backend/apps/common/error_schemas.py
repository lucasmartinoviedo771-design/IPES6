from __future__ import annotations

from typing import Any

from ninja import Schema


class ErrorResponse(Schema):
    error_code: str
    message: str
    details: Any | None = None
    request_id: str | None = None
