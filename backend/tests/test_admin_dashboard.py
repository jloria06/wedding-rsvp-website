from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import RSVP, Guest, GuestStatus, RSVPStatus
from app.services.admin_dashboard import AdminDashboardService


def build_guest(
    invitation_code: str,
    maximum_companions: int,
    rsvp_status: RSVPStatus | None = None,
    *,
    deleted: bool = False,
) -> Guest:
    guest = Guest(
        invitation_code=invitation_code,
        first_name="Dashboard",
        last_name="Guest",
        maximum_companions=maximum_companions,
        is_primary_guest=True,
        status=GuestStatus.INVITED,
        deleted_at=datetime.now(UTC) if deleted else None,
    )

    if rsvp_status is not None:
        guest.rsvp = RSVP(
            status=rsvp_status,
            companion_count=0,
        )

    return guest


def test_dashboard_statistics_count_active_guests_and_rsvp_statuses() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        session.add_all(
            [
                build_guest("ATTENDING", 2, RSVPStatus.ATTENDING),
                build_guest("DECLINED", 1, RSVPStatus.NOT_ATTENDING),
                build_guest("PENDING-RSVP", 0, RSVPStatus.PENDING),
                build_guest("NO-RSVP", 3),
                build_guest("DELETED", 8, RSVPStatus.ATTENDING, deleted=True),
            ]
        )
        session.commit()

        statistics = AdminDashboardService(session).get_statistics()

    assert statistics.total_guests == 4
    assert statistics.allocated_seats == 10
    assert statistics.rsvp_responses == 2
    assert statistics.attending == 1
    assert statistics.declined == 1
    assert statistics.pending == 2
    assert statistics.adults is None
    assert statistics.children is None
