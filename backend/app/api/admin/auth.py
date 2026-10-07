from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError
from app.database.session import get_database_session
from app.schemas import (
    AdministratorLoginRequest,
    AdministratorLoginResponse,
    AdministratorPasswordChangeRequest,
    AdministratorPasswordChangeResponse,
    AdministratorProfileResponse,
)
from app.security import CurrentAdministrator
from app.services import AdministratorAuthenticationService

router = APIRouter(
    prefix="/auth",
    tags=["Admin Authentication"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]


@router.post(
    "/login",
    response_model=AdministratorLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate an administrator",
)
def login_administrator(
    request: AdministratorLoginRequest,
    database_session: DatabaseSession,
) -> AdministratorLoginResponse:
    service = AdministratorAuthenticationService(database_session)

    try:
        response = service.authenticate(request)
    except AuthenticationError:
        database_session.commit()
        raise

    database_session.commit()

    return response


@router.post(
    "/change-password",
    response_model=AdministratorPasswordChangeResponse,
    status_code=status.HTTP_200_OK,
    summary="Change the current administrator password",
)
def change_administrator_password(
    request: AdministratorPasswordChangeRequest,
    current_administrator: CurrentAdministrator,
    database_session: DatabaseSession,
) -> AdministratorPasswordChangeResponse:
    service = AdministratorAuthenticationService(database_session)

    response = service.change_password(
        current_administrator,
        request,
    )

    database_session.commit()

    return response


@router.get(
    "/me",
    response_model=AdministratorProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the current administrator profile",
)
def get_current_administrator_profile(
    current_administrator: CurrentAdministrator,
) -> AdministratorProfileResponse:
    return AdministratorProfileResponse(
        administrator_id=current_administrator.id,
        username=current_administrator.username,
        email=current_administrator.email,
        first_name=current_administrator.first_name,
        last_name=current_administrator.last_name,
        role=current_administrator.role.value,
        status=current_administrator.status.value,
        is_password_change_required=(current_administrator.is_password_change_required),
    )
