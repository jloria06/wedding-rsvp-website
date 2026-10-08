from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, ResourceNotFoundError
from app.models import (
    AttendanceType,
    Guest,
    GuestStatus,
    RSVP,
    RSVPStatus,
    SeatAssignment,
    SeatingTable,
)
from app.schemas.admin_seating import (
    SeatAssignmentRequest,
    SeatingAssignmentItem,
    SeatingMutationResponse,
    SeatingOverviewResponse,
    SeatingPartyItem,
    SeatingTableCreateRequest,
    SeatingTableItem,
    SeatingTableUpdateRequest,
)


class AdminSeatingService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_overview(self) -> SeatingOverviewResponse:
        parties = self._reception_parties()
        party_by_guest_id = {party.guest_id: party for party in parties}
        assigned_guest_ids: set[int] = set()
        tables: list[SeatingTableItem] = []

        records = self.database_session.scalars(
            select(SeatingTable)
            .options(selectinload(SeatingTable.assignments))
            .order_by(SeatingTable.sort_order, SeatingTable.name, SeatingTable.id)
            .execution_options(populate_existing=True)
        ).all()

        for record in records:
            assignments: list[SeatingAssignmentItem] = []
            assigned_seats = 0
            for assignment in record.assignments:
                party = party_by_guest_id.get(assignment.guest_id)
                if party is None:
                    continue
                assigned_guest_ids.add(party.guest_id)
                assigned_seats += party.party_size
                assignments.append(
                    SeatingAssignmentItem(
                        **party.model_dump(),
                        assignment_id=assignment.id,
                        assigned_at=assignment.created_at,
                    )
                )
            assignments.sort(key=lambda item: item.guest_name.lower())
            tables.append(
                SeatingTableItem(
                    id=record.id,
                    name=record.name,
                    capacity=record.capacity,
                    notes=record.notes,
                    assigned_seats=assigned_seats,
                    remaining_seats=record.capacity - assigned_seats,
                    assignments=assignments,
                )
            )

        total_capacity = sum(table.capacity for table in tables)
        assigned_seats = sum(table.assigned_seats for table in tables)
        return SeatingOverviewResponse(
            tables=tables,
            unassigned_parties=[
                party for party in parties if party.guest_id not in assigned_guest_ids
            ],
            total_capacity=total_capacity,
            assigned_seats=assigned_seats,
            remaining_seats=total_capacity - assigned_seats,
        )

    def create_table(self, request: SeatingTableCreateRequest) -> SeatingMutationResponse:
        name = request.name.strip()
        self._ensure_unique_name(name)
        highest_sort_order = self.database_session.scalar(
            select(SeatingTable.sort_order).order_by(SeatingTable.sort_order.desc()).limit(1)
        )
        self.database_session.add(
            SeatingTable(
                name=name,
                capacity=request.capacity,
                notes=self._clean(request.notes),
                sort_order=(highest_sort_order or 0) + 1,
            )
        )
        self.database_session.flush()
        return SeatingMutationResponse(
            message="Reception table created successfully.",
            seating=self.get_overview(),
        )

    def update_table(
        self, table_id: int, request: SeatingTableUpdateRequest
    ) -> SeatingMutationResponse:
        table = self._get_table(table_id)
        if request.name is not None:
            name = request.name.strip()
            self._ensure_unique_name(name, excluding_table_id=table_id)
            table.name = name
        if request.capacity is not None:
            occupied = self._assigned_seats(table_id)
            if request.capacity < occupied:
                raise ConflictError(
                    f"Capacity cannot be lower than the {occupied} assigned seats."
                )
            table.capacity = request.capacity
        if "notes" in request.model_fields_set:
            table.notes = self._clean(request.notes)
        self.database_session.flush()
        return SeatingMutationResponse(
            message="Reception table updated successfully.",
            seating=self.get_overview(),
        )

    def delete_table(self, table_id: int) -> SeatingMutationResponse:
        table = self._get_table(table_id)
        if table.assignments:
            raise ConflictError("Remove all parties from this table before deleting it.")
        self.database_session.delete(table)
        self.database_session.flush()
        return SeatingMutationResponse(
            message="Reception table deleted successfully.",
            seating=self.get_overview(),
        )

    def assign_party(
        self, guest_id: int, request: SeatAssignmentRequest, administrator_id: int
    ) -> SeatingMutationResponse:
        table = self._get_table(request.table_id)
        party = next(
            (item for item in self._reception_parties() if item.guest_id == guest_id),
            None,
        )
        if party is None:
            raise ConflictError(
                "Only active guests attending the reception can receive a table."
            )

        assignment = self.database_session.scalar(
            select(SeatAssignment).where(SeatAssignment.guest_id == guest_id)
        )
        current_party_size = (
            party.party_size
            if assignment is not None and assignment.table_id == table.id
            else 0
        )
        available = table.capacity - self._assigned_seats(table.id) + current_party_size
        if party.party_size > available:
            raise ConflictError(
                f"{table.name} has {available} seats remaining, but this party needs {party.party_size}."
            )

        moved = assignment is not None
        if assignment is None:
            assignment = SeatAssignment(guest_id=guest_id)
            self.database_session.add(assignment)
        assignment.table_id = table.id
        assignment.assigned_by_id = administrator_id
        self.database_session.flush()
        return SeatingMutationResponse(
            message=(
                "Party moved successfully." if moved else "Party assigned successfully."
            ),
            seating=self.get_overview(),
        )

    def unassign_party(self, guest_id: int) -> SeatingMutationResponse:
        assignment = self.database_session.scalar(
            select(SeatAssignment).where(SeatAssignment.guest_id == guest_id)
        )
        if assignment is None:
            raise ResourceNotFoundError("Seat assignment not found.")
        self.database_session.delete(assignment)
        self.database_session.flush()
        return SeatingMutationResponse(
            message="Party removed from the table.",
            seating=self.get_overview(),
        )

    def _reception_parties(self) -> list[SeatingPartyItem]:
        guests = self.database_session.scalars(
            select(Guest)
            .join(RSVP, RSVP.guest_id == Guest.id)
            .where(
                Guest.deleted_at.is_(None),
                Guest.status != GuestStatus.BLOCKED,
                RSVP.status == RSVPStatus.ATTENDING,
                RSVP.attendance_type.in_(
                    [
                        AttendanceType.CEREMONY_AND_RECEPTION,
                        AttendanceType.RECEPTION_ONLY,
                    ]
                ),
            )
            .options(selectinload(Guest.rsvp).selectinload(RSVP.companions))
            .order_by(Guest.last_name, Guest.first_name, Guest.id)
        ).all()
        return [
            SeatingPartyItem(
                guest_id=guest.id,
                invitation_code=guest.invitation_code,
                guest_name=guest.full_name,
                household_name=guest.household_name,
                party_size=1 + len(guest.rsvp.companions),
                companion_names=[item.full_name for item in guest.rsvp.companions],
            )
            for guest in guests
            if guest.rsvp is not None
        ]

    def _assigned_seats(self, table_id: int) -> int:
        party_sizes = {
            party.guest_id: party.party_size for party in self._reception_parties()
        }
        guest_ids = self.database_session.scalars(
            select(SeatAssignment.guest_id).where(SeatAssignment.table_id == table_id)
        ).all()
        return sum(party_sizes.get(guest_id, 0) for guest_id in guest_ids)

    def _get_table(self, table_id: int) -> SeatingTable:
        table = self.database_session.scalar(
            select(SeatingTable)
            .where(SeatingTable.id == table_id)
            .options(selectinload(SeatingTable.assignments))
        )
        if table is None:
            raise ResourceNotFoundError("Reception table not found.")
        return table

    def _ensure_unique_name(
        self, name: str, excluding_table_id: int | None = None
    ) -> None:
        statement = select(SeatingTable.id).where(SeatingTable.name == name)
        if excluding_table_id is not None:
            statement = statement.where(SeatingTable.id != excluding_table_id)
        if self.database_session.scalar(statement) is not None:
            raise ConflictError("A reception table with this name already exists.")

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None
