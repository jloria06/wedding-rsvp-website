from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.admin_seating import (
    SeatAssignmentRequest,
    SeatingMutationResponse,
    SeatingOverviewResponse,
    SeatingTableCreateRequest,
    SeatingTableUpdateRequest,
)
from app.security import DashboardAdministrator, GuestManager
from app.services.admin_seating import AdminSeatingService

router = APIRouter(prefix="/seating", tags=["Admin Seating"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=SeatingOverviewResponse)
def get_seating(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> SeatingOverviewResponse:
    return AdminSeatingService(database_session).get_overview()


@router.post(
    "/tables",
    response_model=SeatingMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_table(
    request: SeatingTableCreateRequest,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> SeatingMutationResponse:
    response = AdminSeatingService(database_session).create_table(request)
    database_session.commit()
    return response


@router.patch("/tables/{table_id}", response_model=SeatingMutationResponse)
def update_table(
    table_id: int,
    request: SeatingTableUpdateRequest,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> SeatingMutationResponse:
    response = AdminSeatingService(database_session).update_table(table_id, request)
    database_session.commit()
    return response


@router.delete("/tables/{table_id}", response_model=SeatingMutationResponse)
def delete_table(
    table_id: int,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> SeatingMutationResponse:
    response = AdminSeatingService(database_session).delete_table(table_id)
    database_session.commit()
    return response


@router.put("/assignments/{guest_id}", response_model=SeatingMutationResponse)
def assign_party(
    guest_id: int,
    request: SeatAssignmentRequest,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> SeatingMutationResponse:
    response = AdminSeatingService(database_session).assign_party(
        guest_id, request, current_administrator.id
    )
    database_session.commit()
    return response


@router.delete("/assignments/{guest_id}", response_model=SeatingMutationResponse)
def unassign_party(
    guest_id: int,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> SeatingMutationResponse:
    response = AdminSeatingService(database_session).unassign_party(guest_id)
    database_session.commit()
    return response
