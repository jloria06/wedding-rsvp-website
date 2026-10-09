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
from app.services.admin_audit import AdminAuditService
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
    table = next(
        item for item in response.seating.tables if item.name == request.name.strip()
    )
    AdminAuditService(database_session).record(
        current_administrator,
        action="seating_table.created",
        resource_type="seating_table",
        resource_id=table.id,
        summary=f"Created reception table {table.name}.",
        details={"capacity": table.capacity},
    )
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
    table = next(item for item in response.seating.tables if item.id == table_id)
    AdminAuditService(database_session).record(
        current_administrator,
        action="seating_table.updated",
        resource_type="seating_table",
        resource_id=table_id,
        summary=f"Updated reception table {table.name}.",
        details={"changed_fields": sorted(request.model_fields_set)},
    )
    database_session.commit()
    return response


@router.delete("/tables/{table_id}", response_model=SeatingMutationResponse)
def delete_table(
    table_id: int,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> SeatingMutationResponse:
    response = AdminSeatingService(database_session).delete_table(table_id)
    AdminAuditService(database_session).record(
        current_administrator,
        action="seating_table.deleted",
        resource_type="seating_table",
        resource_id=table_id,
        summary=f"Deleted reception table #{table_id}.",
    )
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
    table = next(
        item
        for item in response.seating.tables
        if any(assignment.guest_id == guest_id for assignment in item.assignments)
    )
    assignment = next(
        item for item in table.assignments if item.guest_id == guest_id
    )
    AdminAuditService(database_session).record(
        current_administrator,
        action="seating.assigned",
        resource_type="seat_assignment",
        resource_id=assignment.assignment_id,
        summary=f"Assigned {assignment.guest_name} to {table.name}.",
        details={"guest_id": guest_id, "table_id": table.id},
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
    AdminAuditService(database_session).record(
        current_administrator,
        action="seating.unassigned",
        resource_type="seat_assignment",
        resource_id=guest_id,
        summary=f"Removed guest #{guest_id} from their reception table.",
        details={"guest_id": guest_id},
    )
    database_session.commit()
    return response
