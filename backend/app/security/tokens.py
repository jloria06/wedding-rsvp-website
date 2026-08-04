from datetime import UTC, datetime, timedelta

import jwt

from app.core import get_settings

settings = get_settings()


def create_access_token(
    administrator_id: int,
    username: str,
    role: str,
) -> str:
    now = datetime.now(UTC)

    payload = {
        "sub": str(administrator_id),
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=8),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict[str, object]:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=["HS256"],
    )
