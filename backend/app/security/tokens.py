from datetime import UTC, datetime, timedelta

import jwt

from app.core import get_settings

settings = get_settings()


def create_access_token(
    administrator_id: int,
    username: str,
    role: str,
    password_changed_at: datetime | None,
) -> str:
    now = datetime.now(UTC)

    payload = {
        "sub": str(administrator_id),
        "username": username,
        "role": role,
        "password_changed_at": password_change_marker(password_changed_at),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, object]:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


def password_change_marker(changed_at: datetime | None) -> str | None:
    if changed_at is None:
        return None

    if changed_at.tzinfo is None:
        changed_at = changed_at.replace(tzinfo=UTC)

    return changed_at.astimezone(UTC).isoformat()
