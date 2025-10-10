from typing import Any, Optional
from ninja import Schema

class ApiResponse(Schema):
    ok: bool
    message: Optional[str] = None
    data: Optional[Any] = None
