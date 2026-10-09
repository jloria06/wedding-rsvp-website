from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import (
    AgeGroup,
    AttendanceType,
    Companion,
    Guest,
    GuestStatus,
    MealPreference,
    RSVP,
    RSVPStatus,
    SeatAssignment,
    SeatingTable,
)
from app.services.admin_reports import AdminReportsService


def test_reports_summarize_people_meals_and_seating() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        attending = Guest(
            invitation_code="REPORT-ATTENDING",
            first_name="Attending",
            last_name="Guest",
            age_group=AgeGroup.ADULT,
            status=GuestStatus.VERIFIED,
        )
        attending.rsvp = RSVP(
            status=RSVPStatus.ATTENDING,
            attendance_type=AttendanceType.CEREMONY_AND_RECEPTION,
            companion_count=1,
            meal_preference=MealPreference.STANDARD,
            dietary_restrictions="No shellfish",
            companions=[
                Companion(
                    first_name="Plus",
                    last_name="One",
                    meal_preference=MealPreference.VEGETARIAN,
                )
            ],
        )
        declined = Guest(
            invitation_code="REPORT-DECLINED",
            first_name="Declined",
            last_name="Guest",
            age_group=AgeGroup.CHILD,
            status=GuestStatus.VERIFIED,
            rsvp=RSVP(status=RSVPStatus.NOT_ATTENDING),
        )
        pending = Guest(
            invitation_code="REPORT-PENDING",
            first_name="Pending",
            last_name="Guest",
            age_group=AgeGroup.ADULT,
            status=GuestStatus.INVITED,
        )
        table = SeatingTable(name="Report Table", capacity=8)
        session.add_all([attending, declined, pending, table])
        session.flush()
        attending.seat_assignment = SeatAssignment(table_id=table.id)
        session.flush()

        report = AdminReportsService(session).get_summary()

        assert report.total_invitations == 3
        assert report.responded_invitations == 2
        assert report.pending_invitations == 1
        assert report.attending_people == 2
        assert report.companions_attending == 1
        assert report.ceremony_people == 2
        assert report.reception_people == 2
        assert report.assigned_reception_people == 2
        assert report.unassigned_reception_people == 0
        assert report.response_rate == 66.7
        assert report.seating_completion_rate == 100.0
        assert report.dietary_requests == 1
        assert {(item.label, item.value) for item in report.meal_breakdown} == {
            ("standard", 1),
            ("vegetarian", 1),
        }


def test_report_csv_contains_invitation_and_table_details() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        guest = Guest(
            invitation_code="REPORT-CSV",
            first_name="CSV",
            last_name="Guest",
            status=GuestStatus.VERIFIED,
            rsvp=RSVP(
                status=RSVPStatus.ATTENDING,
                attendance_type=AttendanceType.RECEPTION_ONLY,
                companion_count=0,
            ),
        )
        table = SeatingTable(name="Table CSV", capacity=4)
        session.add_all([guest, table])
        session.flush()
        guest.seat_assignment = SeatAssignment(table_id=table.id)
        session.flush()

        content = AdminReportsService(session).export_csv()

        assert "Invitation Code,Guest,Household" in content
        assert "REPORT-CSV,CSV Guest,,verified,attending,reception_only,1" in content
        assert "Table CSV" in content
