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
from app.services.admin_audit import AdminAuditService

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

    AdminAuditService(database_session).record(
        current_administrator,
        action="guest.created",
        resource_type="guest",
        resource_id=response.guest.id,
        summary=f"Created guest {response.guest.full_name}.",
        details={"invitation_code": response.guest.invitation_code},
    )

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

    AdminAuditService(database_session).record(
        current_administrator,
        action="guest.updated",
        resource_type="guest",
        resource_id=response.guest.id,
        summary=f"Updated guest {response.guest.full_name}.",
        details={"changed_fields": sorted(request.model_fields_set)},
    )

    database_session.commit()

    return response


@router.post(
    "/{guest_id}/mark-invitation-sent",
    response_model=AdminGuestUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a guest invitation as sent",
)
def mark_invitation_sent(
    guest_id: int,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> AdminGuestUpdateResponse:
    service = AdminGuestManagementService(database_session)
    response = service.mark_invitation_sent(guest_id)

    AdminAuditService(database_session).record(
        current_administrator,
        action="guest.invitation_sent",
        resource_type="guest",
        resource_id=response.guest.id,
        summary=f"Marked invitation for {response.guest.full_name} as sent.",
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

    AdminAuditService(database_session).record(
        current_administrator,
        action="guest.deactivated",
        resource_type="guest",
        resource_id=response.guest_id,
        summary=f"Deactivated guest record #{response.guest_id}.",
    )

    database_session.commit()

    return response
