from __future__ import annotations

from enum import Enum


class AppErrorCode(str, Enum):
    """Códigos de error de negocio para respuestas estandarizadas."""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    NOT_FOUND = "NOT_FOUND"
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    RATE_LIMITED = "RATE_LIMITED"
    CONFLICT = "CONFLICT"
    DUPLICATED = "DUPLICATED"
    RESOURCE_LOCKED = "RESOURCE_LOCKED"
    PRECONDITION_FAILED = "PRECONDITION_FAILED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    BAD_REQUEST = "BAD_REQUEST"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_http_status(cls, status_code: int) -> "AppErrorCode":
        """Devuelve un código genérico en base al status HTTP."""
        if status_code == 400:
            return cls.BAD_REQUEST
        if status_code == 401:
            return cls.AUTHENTICATION_REQUIRED
        if status_code == 403:
            return cls.PERMISSION_DENIED
        if status_code == 404:
            return cls.NOT_FOUND
        if status_code == 409:
            return cls.CONFLICT
        if status_code == 412:
            return cls.PRECONDITION_FAILED
        if status_code == 423:
            return cls.RESOURCE_LOCKED
        if status_code == 429:
            return cls.RATE_LIMITED
        if status_code >= 500:
            return cls.INTERNAL_ERROR
        return cls.UNKNOWN
