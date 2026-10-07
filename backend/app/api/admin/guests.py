from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas import (
    AdminGuestCreateRequest,
    AdminGuestCreateResponse,
    AdminGuestDeleteResponse,
    AdminGuestListResponse,
    AdminGuestUpdateRequest,
    AdminGuestUpdateResponse,
)
from app.security import DashboardAdministrator, GuestManager
from app.services import AdminGuestManagementService

router = APIRouter(
    prefix="/guests",
    tags=["Admin Guests"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]


@router.get(
    "",
    response_model=AdminGuestListResponse,
    status_code=status.HTTP_200_OK,
    summary="List wedding guests",
)
def list_guests(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> AdminGuestListResponse:
    service = AdminGuestManagementService(database_session)

    return service.list_guests()


@router.post(
    "",
    response_model=AdminGuestCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a wedding guest",
)
def create_guest(
    request: AdminGuestCreateRequest,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> AdminGuestCreateResponse:
    service = AdminGuestManagementService(database_session)

    response = service.create_guest(request)

    database_session.commit()

    return response


@router.patch(
    "/{guest_id}",
    response_model=AdminGuestUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a wedding guest",
)
def update_guest(
    guest_id: int,
    request: AdminGuestUpdateRequest,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> AdminGuestUpdateResponse:
    service = AdminGuestManagementService(database_session)

    response = service.update_guest(
        guest_id,
        request,
    )

    database_session.commit()

    return response


@router.delete(
    "/{guest_id}",
    response_model=AdminGuestDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft delete a wedding guest",
)
def delete_guest(
    guest_id: int,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> AdminGuestDeleteResponse:
    service = AdminGuestManagementService(database_session)

    response = service.soft_delete_guest(guest_id)

    database_session.commit()

    return response
