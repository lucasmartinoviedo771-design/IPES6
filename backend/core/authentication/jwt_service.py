import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class JWTService:
    @staticmethod
    def create_access_token(user_id: int) -> str:
        payload = {
            "user_id": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),  # Access token expira en 1h
            "iat": datetime.now(timezone.utc),
            "type": "access"
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    @staticmethod
    def create_refresh_token(user_id: int) -> str:
        payload = {
            "user_id": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(days=7),  # Refresh token expira en 7 días
            "iat": datetime.now(timezone.utc),
            "type": "refresh"
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    @staticmethod
    def decode_token(token: str) -> dict | None:
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

    @staticmethod
    def get_user_from_token(token: str):
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
