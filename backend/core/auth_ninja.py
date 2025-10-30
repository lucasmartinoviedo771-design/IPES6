from ninja.security.base import AuthBase
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()

class JWTAuth(AuthBase):
    openapi_type = "http"
    openapi_scheme = "bearer"
    openapi_bearer_format = "JWT"

    def __call__(self, request):
        token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)

        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.lower().startswith("bearer "):
                token = auth_header.split(" ", 1)[1]

        if not token:
            return None

        try:
            untyped = UntypedToken(token)
            user_id = untyped.payload.get("user_id")
            if not user_id:
                return None
            user = User.objects.get(pk=user_id)
            request.user = user
            return user
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None
