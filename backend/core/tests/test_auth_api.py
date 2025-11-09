import json

import pytest
from django.conf import settings
from django.test.utils import override_settings

pytestmark = pytest.mark.django_db


def test_login_success_sets_cookie_and_payload(api_client, create_user):
    password = "UltraSecret123!"
    create_user(
        "12345678",
        password=password,
        roles=("admin",),
        is_staff=True,
    )

    response = api_client.post(
        "/api/auth/login",
        data=json.dumps({"login": "12345678", "password": password}),
        content_type="application/json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert "access" in payload
    assert "refresh" in payload
    assert payload["user"]["dni"] == "12345678"
    assert payload["user"]["is_staff"] is True
    # Cookie must include the access token for subsequent requests.
    assert settings.JWT_ACCESS_COOKIE_NAME in response.cookies
    assert response.cookies[settings.JWT_ACCESS_COOKIE_NAME]["path"] == settings.JWT_COOKIE_PATH


def test_refresh_returns_new_tokens(api_client, create_user):
    password = "UltraSecret123!"
    create_user("11111111", password=password, roles=("admin",), is_staff=True)

    login_response = api_client.post(
        "/api/auth/login",
        data=json.dumps({"login": "11111111", "password": password}),
        content_type="application/json",
    )
    assert login_response.status_code == 200
    refresh_value = login_response.json()["refresh"]

    refresh_response = api_client.post(
        "/api/auth/refresh",
        data=json.dumps({"refresh": refresh_value}),
        content_type="application/json",
    )
    assert refresh_response.status_code == 200
    data = refresh_response.json()
    assert "access" in data
    assert "refresh" in data
    assert data["refresh"] != refresh_value


@override_settings(LOGIN_RATE_LIMIT_ATTEMPTS=2, LOGIN_RATE_LIMIT_WINDOW_SECONDS=60)
def test_login_rate_limit_returns_429_after_failed_attempts(api_client):
    payload = {"login": "nope@example.com", "password": "bad-password"}

    first_try = api_client.post(
        "/api/auth/login",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert first_try.status_code == 401

    second_try = api_client.post(
        "/api/auth/login",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert second_try.status_code == 429
    assert second_try.json()["detail"].startswith("Demasiados intentos fallidos")


def test_profile_requires_authenticated_user(api_client):
    response = api_client.get("/api/auth/profile")
    assert response.status_code == 401


def test_profile_returns_user_data(authenticated_client):
    client, user = authenticated_client(
        username="20000001",
        roles=("alumno",),
    )
    response = client.get("/api/auth/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["dni"] == "20000001"
    assert "alumno" in data["roles"]
    assert data["is_staff"] is False


def test_change_password_updates_credentials(authenticated_client):
    client, user = authenticated_client(username="99999999")
    payload = {
        "current_password": "TestPass123!",
        "new_password": "NewSecret456!",
    }
    response = client.post(
        "/api/auth/change-password",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["detail"].startswith("Contraseña actualizada")
    user.refresh_from_db()
    assert user.check_password("NewSecret456!")
