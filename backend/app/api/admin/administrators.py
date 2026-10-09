from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.admin_administrator import (
    AdminAccountCreateRequest,
    AdminAccountListResponse,
    AdminAccountMutationResponse,
    AdminAccountPasswordResetRequest,
    AdminAccountUpdateRequest,
)
from app.security import SuperAdministrator
from app.services.admin_administrator import AdminAdministratorService
from app.services.admin_audit import AdminAuditService

router = APIRouter(prefix="/administrators", tags=["Admin Accounts"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=AdminAccountListResponse)
def list_administrators(
    current_administrator: SuperAdministrator,
    database_session: DatabaseSession,
) -> AdminAccountListResponse:
    return AdminAdministratorService(database_session).list_accounts()


@router.post(
    "", response_model=AdminAccountMutationResponse, status_code=status.HTTP_201_CREATED
)
def create_administrator(
    request: AdminAccountCreateRequest,
    current_administrator: SuperAdministrator,
    database_session: DatabaseSession,
) -> AdminAccountMutationResponse:
    response = AdminAdministratorService(database_session).create_account(request)
    account = response.administrator
    AdminAuditService(database_session).record(
        current_administrator,
        action="administrator.created",
        resource_type="administrator",
        resource_id=account.id,
        summary=f"Created administrator account @{account.username}.",
        details={"role": account.role.value},
    )
    database_session.commit()
    return response


@router.patch("/{administrator_id}", response_model=AdminAccountMutationResponse)
def update_administrator(
    administrator_id: int,
    request: AdminAccountUpdateRequest,
    current_administrator: SuperAdministrator,
    database_session: DatabaseSession,
) -> AdminAccountMutationResponse:
    response = AdminAdministratorService(database_session).update_account(
        administrator_id, request, current_administrator
    )
    account = response.administrator
    AdminAuditService(database_session).record(
        current_administrator,
        action="administrator.updated",
        resource_type="administrator",
        resource_id=account.id,
        summary=f"Updated administrator account @{account.username}.",
        details={"changed_fields": sorted(request.model_fields_set)},
    )
    database_session.commit()
    return response


@router.post(
    "/{administrator_id}/reset-password",
    response_model=AdminAccountMutationResponse,
)
def reset_administrator_password(
    administrator_id: int,
    request: AdminAccountPasswordResetRequest,
    current_administrator: SuperAdministrator,
    database_session: DatabaseSession,
) -> AdminAccountMutationResponse:
    response = AdminAdministratorService(database_session).reset_password(
        administrator_id, request, current_administrator
    )
    account = response.administrator
    AdminAuditService(database_session).record(
        current_administrator,
        action="administrator.password_reset",
        resource_type="administrator",
        resource_id=account.id,
        summary=f"Reset the temporary password for @{account.username}.",
    )
    database_session.commit()
    return response
