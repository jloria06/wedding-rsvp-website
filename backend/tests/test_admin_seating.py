import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.database.base import Base
from app.models import (
    AttendanceType,
    Companion,
    Guest,
    GuestStatus,
    RSVP,
    RSVPStatus,
)
from app.schemas.admin_seating import (
    SeatAssignmentRequest,
    SeatingTableCreateRequest,
    SeatingTableUpdateRequest,
)
from app.services.admin_seating import AdminSeatingService


def build_attending_guest(
    code: str,
    *,
    companions: int = 0,
    attendance_type: AttendanceType = AttendanceType.CEREMONY_AND_RECEPTION,
) -> Guest:
    guest = Guest(
        invitation_code=code,
        first_name=code.title(),
        last_name="Guest",
        household_name=f"{code.title()} Household",
        maximum_companions=companions,
        status=GuestStatus.VERIFIED,
    )
    guest.rsvp = RSVP(
        status=RSVPStatus.ATTENDING,
        attendance_type=attendance_type,
        companion_count=companions,
        companions=[
            Companion(first_name=f"Companion {index + 1}", last_name="Guest")
            for index in range(companions)
        ],
    )
    return guest


def test_seating_assigns_whole_parties_and_tracks_capacity() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        reception_guest = build_attending_guest("RECEPTION", companions=2)
        ceremony_guest = build_attending_guest(
            "CEREMONY", attendance_type=AttendanceType.CEREMONY_ONLY
        )
        session.add_all([reception_guest, ceremony_guest])
        session.flush()
        service = AdminSeatingService(session)

        created = service.create_table(
            SeatingTableCreateRequest(name="Table 1", capacity=4)
        )
        table_id = created.seating.tables[0].id
        assert len(created.seating.unassigned_parties) == 1

        assigned = service.assign_party(
            reception_guest.id,
            SeatAssignmentRequest(table_id=table_id),
            administrator_id=1,
        )

        table = assigned.seating.tables[0]
        assert table.assigned_seats == 3
        assert table.remaining_seats == 1
        assert table.assignments[0].companion_names == [
            "Companion 1 Guest",
            "Companion 2 Guest",
        ]
        assert assigned.seating.unassigned_parties == []


def test_seating_prevents_overcapacity_and_invalid_capacity_reduction() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        first = build_attending_guest("FIRST", companions=1)
        second = build_attending_guest("SECOND", companions=1)
        session.add_all([first, second])
        session.flush()
        service = AdminSeatingService(session)
        table_id = service.create_table(
            SeatingTableCreateRequest(name="Family Table", capacity=3)
        ).seating.tables[0].id
        service.assign_party(first.id, SeatAssignmentRequest(table_id=table_id), 1)

        with pytest.raises(ConflictError, match="1 seats remaining"):
            service.assign_party(second.id, SeatAssignmentRequest(table_id=table_id), 1)

        with pytest.raises(ConflictError, match="2 assigned seats"):
            service.update_table(
                table_id, SeatingTableUpdateRequest(capacity=1)
            )


def test_seating_can_move_and_unassign_a_party() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        guest = build_attending_guest("MOVE")
        session.add(guest)
        session.flush()
        service = AdminSeatingService(session)
        first_id = service.create_table(
            SeatingTableCreateRequest(name="Table A", capacity=4)
        ).seating.tables[0].id
        second_id = service.create_table(
            SeatingTableCreateRequest(name="Table B", capacity=4)
        ).seating.tables[1].id

        service.assign_party(guest.id, SeatAssignmentRequest(table_id=first_id), 1)
        moved = service.assign_party(
            guest.id, SeatAssignmentRequest(table_id=second_id), 1
        )
        assert moved.seating.tables[0].assigned_seats == 0
        assert moved.seating.tables[1].assigned_seats == 1

        unassigned = service.unassign_party(guest.id)
        assert len(unassigned.seating.unassigned_parties) == 1
        assert unassigned.seating.assigned_seats == 0
