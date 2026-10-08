from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import (
    AttendanceType,
    Guest,
    GuestStatus,
    MealPreference,
    RSVPStatus,
    SeatAssignment,
    SeatingTable,
)
from app.schemas import CompanionInput
from app.schemas.admin_rsvp import AdminRSVPUpsertRequest
from app.services.admin_rsvp_management import AdminRSVPManagementService


def build_guest(code: str = "ADMIN-RSVP-TEST") -> Guest:
    return Guest(
        invitation_code=code,
        first_name="Test",
        last_name="Guest",
        household_name="Test Household",
        maximum_companions=2,
        status=GuestStatus.INVITED,
    )


def test_admin_can_create_and_update_rsvp_with_companions() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        guest = build_guest()
        session.add(guest)
        session.flush()
        service = AdminRSVPManagementService(session)

        pending = service.list_rsvps()
        assert pending.total == 1
        assert pending.rsvps[0].status == RSVPStatus.PENDING
        assert pending.rsvps[0].rsvp_id is None

        created = service.upsert_rsvp(
            guest.id,
            AdminRSVPUpsertRequest(
                status=RSVPStatus.ATTENDING,
                attendance_type=AttendanceType.CEREMONY_AND_RECEPTION,
                meal_preference=MealPreference.STANDARD,
                companions=[
                    CompanionInput(
                        first_name="Plus",
                        last_name="One",
                        meal_preference=MealPreference.VEGETARIAN,
                    )
                ],
            ),
        )

        assert created.rsvp.rsvp_id is not None
        assert created.rsvp.status == RSVPStatus.ATTENDING
        assert created.rsvp.companion_count == 1
        assert created.rsvp.companions[0].full_name == "Plus One"
        assert guest.status == GuestStatus.VERIFIED

        table = SeatingTable(name="Test Table", capacity=8)
        session.add(table)
        session.flush()
        guest.seat_assignment = SeatAssignment(table_id=table.id)
        session.flush()

        updated = service.upsert_rsvp(
            guest.id,
            AdminRSVPUpsertRequest(status=RSVPStatus.NOT_ATTENDING),
        )

        assert updated.rsvp.status == RSVPStatus.NOT_ATTENDING
        assert updated.rsvp.companion_count == 0
        assert updated.rsvp.companions == []
        assert updated.rsvp.attendance_type is None
        assert session.scalar(
            select(SeatAssignment).where(SeatAssignment.guest_id == guest.id)
        ) is None


def test_admin_rsvp_export_includes_pending_and_completed_guests() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        guest = build_guest("CSV-TEST")
        session.add(guest)
        session.flush()
        service = AdminRSVPManagementService(session)
        content = service.export_csv()

        assert "Invitation Code,Guest" in content
        assert "CSV-TEST,Test Guest,Test Household,pending" in content
