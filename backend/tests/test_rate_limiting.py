import pytest
from starlette.requests import Request

from app.core.exceptions import ApplicationError
from app.core.rate_limiting import InMemoryRateLimiter


def request_for(address: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [(b"x-forwarded-for", address.encode())],
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        }
    )


def test_rate_limiter_rejects_requests_above_limit() -> None:
    limiter = InMemoryRateLimiter()
    request = request_for("203.0.113.10")
    limiter.check("login", "2/minute", request)
    limiter.check("login", "2/minute", request)
    with pytest.raises(ApplicationError) as error:
        limiter.check("login", "2/minute", request)
    assert error.value.status_code == 429
    assert error.value.error_code == "RATE_LIMIT_EXCEEDED"


def test_rate_limiter_separates_clients_and_scopes() -> None:
    limiter = InMemoryRateLimiter()
    first = request_for("203.0.113.11")
    second = request_for("203.0.113.12")
    limiter.check("login", "1/minute", first)
    limiter.check("verify", "1/minute", first)
    limiter.check("login", "1/minute", second)
