"""
Sistema centralizado de gestión de errores y excepciones.
Provee la clase AppError para excepciones de negocio y los manejadores
globales (exception handlers) para NinjaAPI, asegurando que todas las 
respuestas de error tengan una estructura consistente.
"""

from __future__ import annotations
import logging
from typing import Any
from django.core.exceptions import ValidationError
from ninja import NinjaAPI
from ninja.errors import HttpError
from .constants import AppErrorCode

logger = logging.getLogger(__name__)


class AppError(Exception):
    """
    Excepción base para errores de lógica de negocio controlados.
    Permite definir un código de error semántico (error_code) y un mensaje amigable.
    """

    def __init__(
        self,
        status_code: int,
        error_code: AppErrorCode | str,
        message: str,
        *,
        details: Any | None = None,
    ):
        """
        Args:
            status_code: Código de estado HTTP (ej: 400).
            error_code: Código semántico (Enum AppErrorCode).
            message: Descripción legible del error.
            details: Datos adicionales (ej: lista de campos fallidos).
        """
        super().__init__(message)
        self.status_code = status_code
        
        # Validación del código de error contra el Enum central
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
        """Convierte la excepción en un diccionario para la respuesta API."""
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
    """Helper para instanciar un AppError (Factory)."""
    return AppError(status_code=status_code, error_code=error_code, message=message, details=details)


def raise_app_error(
    status_code: int,
    error_code: AppErrorCode | str,
    message: str,
    *,
    details: Any | None = None,
) -> None:
    """Helper para lanzar un AppError en una sola línea."""
    raise app_error(status_code=status_code, error_code=error_code, message=message, details=details)


def build_error_payload(
    *,
    error_code: str,
    message: str,
    details: Any | None,
    request,
) -> dict[str, Any]:
    """
    Construye el cuerpo (JSON) estandarizado de la respuesta de error.
    Incluye el trace_id (request_id) para facilitar el debug con logs.
    """
    payload: dict[str, Any] = {
        "error_code": error_code,
        "message": message,
    }
    if details is not None:
        payload["details"] = details
        
    # Agrega el request_id generado por el middleware de auditoría
    request_id = getattr(request, "request_id", None)
    if request_id:
        payload["request_id"] = request_id
        
    return payload


def register_error_handlers(api: NinjaAPI) -> None:
    """
    Registra los interceptores de excepciones en la instancia principal de Ninja.
    Define cómo se transforman errores de Django o Python en respuestas JSON válidas.
    """

    @api.exception_handler(AppError)
    def handle_app_error(request, exc: AppError):
        """Manejador para errores de negocio (AppError)."""
        payload = exc.to_payload(request)
        return api.create_response(request, payload, status=exc.status_code)

    @api.exception_handler(HttpError)
    def handle_http_error(request, exc: HttpError):
        """Manejador para errores HTTP nativos de Ninja."""
        message = getattr(exc, "message", None) or getattr(exc, "detail", None) or str(exc)
        code = AppErrorCode.from_http_status(getattr(exc, "status_code", 500))
        payload = build_error_payload(
            error_code=code.value,
            message=message or "Se produjo un error de conexión.",
            details=None,
            request=request,
        )
        return api.create_response(request, payload, status=getattr(exc, "status_code", 500))

    @api.exception_handler(ValidationError)
    def handle_validation_error(request, exc: ValidationError):
        """Manejador para fallos de validación de Django (Form/Model)."""
        details = exc.message_dict if hasattr(exc, "message_dict") else exc.messages
        payload = build_error_payload(
            error_code=AppErrorCode.VALIDATION_ERROR.value,
            message="Los datos enviados no superaron las reglas de validación.",
            details=details,
            request=request,
        )
        return api.create_response(request, payload, status=400)

    @api.exception_handler(Exception)
    def handle_unexpected_error(request, exc: Exception):
        """Manejador de 'último recurso' para excepciones no controladas (500)."""
        logger.exception("FATAL: Unhandled exception caught by Ninja interceptor", exc_info=exc)
        payload = build_error_payload(
            error_code=AppErrorCode.INTERNAL_ERROR.value,
            message="Se produjo un error crítico inesperado.",
            details=None,
            request=request,
        )
        return api.create_response(request, payload, status=500)
