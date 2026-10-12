from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ConflictError
from app.models import Guest, RSVP, RSVPStatus


class RSVPCapacityService:
    def __init__(
        self,
        database_session: Session,
        venue_capacity: int | None = None,
    ) -> None:
        self.database_session = database_session
        self.venue_capacity = venue_capacity or get_settings().venue_capacity

    def ensure_available(
        self,
        *,
        guest_id: int,
        status: RSVPStatus,
        companion_count: int,
    ) -> None:
        # Lock every active guest in a consistent order so concurrent RSVP
        # transactions calculate capacity one at a time.
        lock_statement = (
            select(Guest.id)
            .where(Guest.deleted_at.is_(None))
            .order_by(Guest.id)
            .with_for_update()
        )
        self.database_session.scalars(lock_statement).all()

        if status != RSVPStatus.ATTENDING:
            return

        confirmed_people = self.database_session.scalar(
            select(func.coalesce(func.sum(RSVP.companion_count + 1), 0))
            .join(Guest, Guest.id == RSVP.guest_id)
            .where(
                RSVP.status == RSVPStatus.ATTENDING,
                RSVP.guest_id != guest_id,
                Guest.deleted_at.is_(None),
            )
        )
        requested_party_size = 1 + companion_count
        resulting_total = int(confirmed_people or 0) + requested_party_size

        if resulting_total > self.venue_capacity:
            remaining = max(0, self.venue_capacity - int(confirmed_people or 0))
            raise ConflictError(
                "The wedding has reached its attendance capacity. "
                "Please contact the wedding organizers.",
                details={
                    "venue_capacity": self.venue_capacity,
                    "confirmed_people": int(confirmed_people or 0),
                    "requested_party_size": requested_party_size,
                    "remaining_capacity": remaining,
                },
            )
