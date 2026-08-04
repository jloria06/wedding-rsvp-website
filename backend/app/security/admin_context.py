from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError
from app.database.session import get_database_session
from app.models import Administrator
from app.repositories import AdministratorRepository
from app.security.tokens import decode_access_token

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]

bearer_scheme = HTTPBearer(
    auto_error=False,
)


def get_current_administrator(
    database_session: DatabaseSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> Administrator:
    if credentials is None:
        raise AuthorizationError(
            "Administrator authentication is required.",
        )

    if credentials.scheme.lower() != "bearer":
        raise AuthorizationError(
            "Administrator authentication is invalid.",
        )

    try:
        payload = decode_access_token(credentials.credentials)

        administrator_id = int(payload["sub"])

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ) as error:
        raise AuthorizationError(
            "Administrator authentication is invalid or expired.",
        ) from error

    repository = AdministratorRepository(database_session)

    administrator = repository.get_by_id(administrator_id)

    if administrator is None:
        raise AuthorizationError(
            "Administrator authentication is invalid.",
        )

    if not administrator.is_active:
        raise AuthorizationError(
            "Administrator account is disabled.",
        )

    return administrator


CurrentAdministrator = Annotated[
    Administrator,
    Depends(get_current_administrator),
]
