from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.core.exceptions import ApplicationError
from app.schemas import (
    AdminGuestCreateRequest,
    AdminGuestCreateResponse,
    AdminGuestDeleteResponse,
    AdminGuestImportResponse,
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

MAX_GUEST_CSV_BYTES = 2 * 1024 * 1024


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


@router.get(
    "/export.csv",
    summary="Export wedding guests",
)
def export_guests(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> Response:
    content = AdminGuestManagementService(database_session).export_csv()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="wedding-guests.csv"'
        },
    )


@router.post(
    "/import.csv",
    response_model=AdminGuestImportResponse,
    status_code=status.HTTP_200_OK,
    summary="Import wedding guests from CSV",
)
async def import_guests(
    current_administrator: GuestManager,
    database_session: DatabaseSession,
    file: Annotated[UploadFile, File()],
) -> AdminGuestImportResponse:
    data = await file.read(MAX_GUEST_CSV_BYTES + 1)
    if len(data) > MAX_GUEST_CSV_BYTES:
        raise ApplicationError("The guest CSV must be 2 MB or smaller.")

    try:
        content = data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ApplicationError("The guest CSV must use UTF-8 encoding.") from error

    try:
        response = AdminGuestManagementService(database_session).import_csv(content)
    except ValueError as error:
        raise ApplicationError(str(error)) from error

    AdminAuditService(database_session).record(
        current_administrator,
        action="guest.imported",
        resource_type="guest",
        summary=f"Imported {response.imported_count} guests from CSV.",
        details={
            "filename": file.filename or "guests.csv",
            "imported_count": response.imported_count,
            "skipped_count": response.skipped_count,
        },
    )
    database_session.commit()
    return response


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
