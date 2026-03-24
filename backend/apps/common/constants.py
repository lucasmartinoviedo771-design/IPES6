"""
Constantes globales y Enums del sistema IPES6.
Define los catálogos de códigos de error y otros valores compartidos
transversalmente entre módulos para mantener la consistencia en las respuestas.
"""

from __future__ import annotations
from enum import Enum


class AppErrorCode(str, Enum):
    """
    Códigos de identificación semántica para errores de la API.
    Facilitan que el frontend pueda internacionalizar o reaccionar 
    a errores específicos sin depender únicamente de códigos HTTP.
    """

    # Identidad y Acceso
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    
    # Recursos y Estado
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    DUPLICATED = "DUPLICATED"
    RESOURCE_LOCKED = "RESOURCE_LOCKED"
    PRECONDITION_FAILED = "PRECONDITION_FAILED"
    
    # Datos y Petición
    VALIDATION_ERROR = "VALIDATION_ERROR"
    BAD_REQUEST = "BAD_REQUEST"
    RATE_LIMITED = "RATE_LIMITED"
    
    # Infraestructura
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_http_status(cls, status_code: int) -> "AppErrorCode":
        """
        Deriva un código de error de negocio a partir de un código de estado HTTP.
        Utilizado por los manejadores de errores globales para normalizar respuestas inesperadas.
        """
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
