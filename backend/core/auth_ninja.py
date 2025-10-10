from ninja.security import HttpBearer
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model

class JWTAuth(HttpBearer):
    def authenticate(self, request, token):
        try:
            untyped = UntypedToken(token)  # valida firma y expiración
            user_id = untyped.payload.get("user_id")
            if not user_id:
                return None
            User = get_user_model()
            request.user = User.objects.get(pk=user_id)  # opcional: cachear
            return request.user  # si devolvés user, Ninja considera autenticado
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None