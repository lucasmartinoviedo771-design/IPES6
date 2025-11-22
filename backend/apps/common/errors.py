from __future__ import annotations

import logging
from typing import Any

from django.core.exceptions import ValidationError
from ninja import NinjaAPI
from ninja.errors import HttpError

from .constants import AppErrorCode

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Excepción controlada que describe errores de negocio."""

    def __init__(
        self,
        status_code: int,
        error_code: AppErrorCode | str,
        message: str,
        *,
        details: Any | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        if isinstance(error_code, AppErrorCode):
            self.error_code = error_code
        else:
            try:
                self.error_code = AppErrorCode(str(error_code))
            except ValueError:
                self.error_code = AppErrorCode.UNKNOWN
        self.message = message
        self.details = details

    def to_payload(self, request) -> dict[str, Any]:
        return build_error_payload(
            error_code=self.error_code.value,
            message=self.message,
            details=self.details,
            request=request,
        )


def app_error(
    status_code: int,
    error_code: AppErrorCode | str,
    message: str,
    *,
    details: Any | None = None,
) -> AppError:
    return AppError(status_code=status_code, error_code=error_code, message=message, details=details)


def raise_app_error(
    status_code: int,
    error_code: AppErrorCode | str,
    message: str,
    *,
    details: Any | None = None,
) -> None:
    raise app_error(status_code=status_code, error_code=error_code, message=message, details=details)


def build_error_payload(
    *,
    error_code: str,
    message: str,
    details: Any | None,
    request,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error_code": error_code,
        "message": message,
    }
    if details is not None:
        payload["details"] = details
    request_id = getattr(request, "request_id", None)
    if request_id:
        payload["request_id"] = request_id
    return payload


def _http_error_code(status_code: int) -> AppErrorCode:
    return AppErrorCode.from_http_status(status_code)


def register_error_handlers(api: NinjaAPI) -> None:
    """Registra los manejadores globales de errores en la instancia principal de Ninja."""

    @api.exception_handler(AppError)
    def handle_app_error(request, exc: AppError):
        payload = exc.to_payload(request)
        return api.create_response(request, payload, status=exc.status_code)

    @api.exception_handler(HttpError)
    def handle_http_error(request, exc: HttpError):
        message = getattr(exc, "message", None) or getattr(exc, "detail", None) or str(exc)
        code = _http_error_code(getattr(exc, "status_code", 500))
        payload = build_error_payload(
            error_code=code.value,
            message=message or "Se produjo un error.",
            details=None,
            request=request,
        )
        return api.create_response(request, payload, status=getattr(exc, "status_code", 500))

    @api.exception_handler(ValidationError)
    def handle_validation_error(request, exc: ValidationError):
        details = exc.message_dict if hasattr(exc, "message_dict") else exc.messages
        payload = build_error_payload(
            error_code=AppErrorCode.VALIDATION_ERROR.value,
            message="Los datos enviados no son válidos.",
            details=details,
            request=request,
        )
        return api.create_response(request, payload, status=400)

    @api.exception_handler(Exception)
    def handle_unexpected_error(request, exc: Exception):
        logger.exception("Unhandled error", exc_info=exc)
        payload = build_error_payload(
            error_code=AppErrorCode.INTERNAL_ERROR.value,
            message="Ocurrió un error inesperado.",
            details=None,
            request=request,
        )
        return api.create_response(request, payload, status=500)
