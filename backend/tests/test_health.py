from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_success() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200

    payload = response.json()

    assert payload["success"] is True
    assert payload["status"] == "healthy"
    assert payload["service"] == "Wedding RSVP API"
    assert payload["environment"] == "development"


def test_health_endpoint_reports_database_connection() -> None:
    response = client.get("/api/health")
    payload = response.json()

    database = payload["database"]

    assert database["status"] == "connected"
    assert database["name"] == "wedding_rsvp_development"
    assert database["account"] == "wedding_dev@localhost"
    assert database["version"]


def test_unknown_endpoint_uses_standard_error_format() -> None:
    response = client.get("/api/endpoint-that-does-not-exist")

    assert response.status_code == 404

    payload = response.json()

    assert payload == {
        "success": False,
        "error": {
            "code": "HTTP_404",
            "message": "Not Found",
        },
    }
