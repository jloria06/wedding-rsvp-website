from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.admin_rsvp import (
    AdminRSVPListResponse,
    AdminRSVPMutationResponse,
    AdminRSVPUpsertRequest,
)
from app.security import DashboardAdministrator, GuestManager
from app.services.admin_audit import AdminAuditService
from app.services.admin_rsvp_management import AdminRSVPManagementService

router = APIRouter(prefix="/rsvps", tags=["Admin RSVPs"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=AdminRSVPListResponse)
def list_rsvps(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> AdminRSVPListResponse:
    return AdminRSVPManagementService(database_session).list_rsvps()


@router.get("/export.csv")
def export_rsvps(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> Response:
    content = AdminRSVPManagementService(database_session).export_csv()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="wedding-rsvps.csv"'},
    )


@router.put(
    "/{guest_id}",
    response_model=AdminRSVPMutationResponse,
    status_code=status.HTTP_200_OK,
)
def upsert_rsvp(
    guest_id: int,
    request: AdminRSVPUpsertRequest,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> AdminRSVPMutationResponse:
    response = AdminRSVPManagementService(database_session).upsert_rsvp(
        guest_id, request
    )
    AdminAuditService(database_session).record(
        current_administrator,
        action="rsvp.saved",
        resource_type="rsvp",
        resource_id=response.rsvp.rsvp_id,
        summary=f"Saved RSVP for {response.rsvp.guest_name}.",
        details={
            "guest_id": guest_id,
            "status": response.rsvp.status.value,
            "companion_count": response.rsvp.companion_count,
        },
    )
    database_session.commit()
    return response
