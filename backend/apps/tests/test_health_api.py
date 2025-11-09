import pytest

pytestmark = pytest.mark.django_db


def test_health_endpoint_reports_database_ok(api_client):
    response = api_client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["service"] == "IPES API"
