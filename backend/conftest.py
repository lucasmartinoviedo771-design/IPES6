import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client


@pytest.fixture(autouse=True)
def _media_tmpdir(tmp_path, settings):
    """Isolate MEDIA_ROOT per test run so generated files never leak."""
    media_root = tmp_path / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    settings.MEDIA_ROOT = media_root
    yield


@pytest.fixture
def api_client():
    return Client()


@pytest.fixture
def role_groups(db):
    """Ensure the default role groups exist."""
    from django.apps import apps
    Group = apps.get_model('auth', 'Group')
    groups = {}
    for name in ("admin", "secretaria", "bedel", "alumno"):
        group, _created = Group.objects.get_or_create(name=name)
        groups[name] = group
    return groups


@pytest.fixture
def create_user(db, role_groups):
    """Factory that returns a persisted user with the requested roles."""
    User = get_user_model()

    def _create_user(
        username: str,
        *,
        password: str = "TestPass123!",
        email: str | None = None,
        roles: tuple[str, ...] | list[str] | None = None,
        is_staff: bool = False,
        is_superuser: bool = False,
        **extra,
    ):
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email or f"{username}@example.com",
            is_staff=is_staff,
            is_superuser=is_superuser,
            **extra,
        )
        if roles:
            user.groups.set(role_groups[name] for name in roles)
        return user

    return _create_user


@pytest.fixture
def authenticated_client(api_client, create_user):
    """Create a user, attach a JWT cookie to a client, and return both."""

    def _auth_client(
        username: str = "admin",
        *,
        password: str = "TestPass123!",
        roles: tuple[str, ...] | list[str] | None = None,
        is_staff: bool = False,
        is_superuser: bool = False,
        **extra,
    ):
        user = create_user(
            username=username,
            password=password,
            roles=roles,
            is_staff=is_staff,
            is_superuser=is_superuser,
            **extra,
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        api_client.cookies[settings.JWT_ACCESS_COOKIE_NAME] = str(refresh.access_token)
        return api_client, user

    return _auth_client
