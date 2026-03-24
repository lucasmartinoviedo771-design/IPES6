"""
Servicio central de tokens JWT.
Maneja la generación y validación de tokens de Acceso y Refresh
utilizando el estándar HS256 y el SECRET_KEY de la aplicación.
"""

import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()


class JWTService:
    """
    Motor de servicios para el ciclo de vida de JSON Web Tokens.
    """

    @staticmethod
    def create_access_token(user_id: int) -> str:
        """
        Genera un token de acceso de corta duración (60 minutos).
        Destinado a ser enviado en cada petición protegida.
        """
        payload = {
            "user_id": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
            "iat": datetime.now(timezone.utc),
            "type": "access"
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    @staticmethod
    def create_refresh_token(user_id: int) -> str:
        """
        Genera un token de actualización de larga duración (7 días).
        Permite obtener nuevos access tokens sin re-autenticar al usuario.
        """
        payload = {
            "user_id": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
            "iat": datetime.now(timezone.utc),
            "type": "refresh"
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    @staticmethod
    def decode_token(token: str) -> dict | None:
        """
        Decodifica un token y valida su firma y expiración.
        Retorna el payload si es válido, de lo contrario None.
        """
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

    @staticmethod
    def get_user_from_token(token: str):
        """
        Recupera una instancia de User activa a partir de un token de acceso.
        Realiza validaciones de tipo de token e integridad de base de datos.
        """
        payload = JWTService.decode_token(token)
        if not payload or payload.get("type") != "access":
            return None
        
        user_id = payload.get("user_id")
        if not user_id:
            return None
            
        try:
            return User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            return None
