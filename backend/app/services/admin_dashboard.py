from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import RSVP, AgeGroup, Guest, RSVPStatus
from app.schemas.admin_dashboard import AdminDashboardStatisticsResponse


class AdminDashboardService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_statistics(self) -> AdminDashboardStatisticsResponse:
        completed_statuses = (
            RSVPStatus.ATTENDING,
            RSVPStatus.NOT_ATTENDING,
        )

        statement = (
            select(
                func.count(Guest.id),
                func.coalesce(func.sum(Guest.maximum_companions + 1), 0),
                func.coalesce(
                    func.sum(case((RSVP.status.in_(completed_statuses), 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((RSVP.status == RSVPStatus.ATTENDING, 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(
                        case(
                            (RSVP.status == RSVPStatus.NOT_ATTENDING, 1),
                            else_=0,
                        )
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Guest.age_group == AgeGroup.ADULT, 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Guest.age_group == AgeGroup.CHILD, 1), else_=0)),
                    0,
                ),
            )
            .select_from(Guest)
            .outerjoin(RSVP, RSVP.guest_id == Guest.id)
            .where(Guest.deleted_at.is_(None))
        )

        row = self.database_session.execute(statement).one()
        total_guests = int(row[0])
        rsvp_responses = int(row[2])

        return AdminDashboardStatisticsResponse(
            total_guests=total_guests,
            allocated_seats=int(row[1]),
            rsvp_responses=rsvp_responses,
            attending=int(row[3]),
            declined=int(row[4]),
            pending=total_guests - rsvp_responses,
            adults=int(row[5]),
            children=int(row[6]),
        )
