from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import ApplicationError


class InMemoryRateLimiter:
    PERIOD_SECONDS = {"second": 1, "minute": 60, "hour": 3600}

    def __init__(self) -> None:
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, scope: str, limit: str, request: Request) -> None:
        maximum, window = self._parse_limit(limit)
        identifier = self._client_identifier(request)
        now = monotonic()
        key = (scope, identifier)
        with self._lock:
            requests = self._requests[key]
            while requests and requests[0] <= now - window:
                requests.popleft()
            if len(requests) >= maximum:
                raise ApplicationError(
                    "Too many requests. Please wait and try again.",
                    status_code=429,
                    error_code="RATE_LIMIT_EXCEEDED",
                )
            requests.append(now)

    @classmethod
    def _parse_limit(cls, value: str) -> tuple[int, int]:
        count_text, period_text = value.strip().lower().split("/", 1)
        count = int(count_text)
        period = period_text.rstrip("s")
        if count < 1 or period not in cls.PERIOD_SECONDS:
            raise ValueError(f"Invalid rate limit: {value}")
        return count, cls.PERIOD_SECONDS[period]

    @staticmethod
    def _client_identifier(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        return request.client.host if request.client else "unknown"


limiter = InMemoryRateLimiter()
settings = get_settings()


def enforce_admin_login_rate_limit(request: Request) -> None:
    limiter.check("admin-login", settings.admin_login_rate_limit, request)


def enforce_guest_verify_rate_limit(request: Request) -> None:
    limiter.check("guest-verify", settings.guest_verify_rate_limit, request)


def enforce_rsvp_rate_limit(request: Request) -> None:
    limiter.check("rsvp-submit", settings.rsvp_rate_limit, request)
