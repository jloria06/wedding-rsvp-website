from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import RSVP


class RSVPRepository:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_by_guest_id(self, guest_id: int) -> RSVP | None:
        statement = (
            select(RSVP)
            .options(
                selectinload(RSVP.companions),
            )
            .where(RSVP.guest_id == guest_id)
        )

        return self.database_session.scalar(statement)

    def add(self, rsvp: RSVP) -> RSVP:
        self.database_session.add(rsvp)
        self.database_session.flush()

        return rsvp

    def list_all(self) -> list[RSVP]:
        statement = (
            select(RSVP)
            .options(joinedload(RSVP.guest), selectinload(RSVP.companions))
            .join(RSVP.guest)
            .where(RSVP.guest.has(deleted_at=None))
            .order_by(RSVP.responded_at.desc(), RSVP.id.desc())
        )
        return list(self.database_session.scalars(statement).unique().all())

    def delete_companions(self, rsvp: RSVP) -> None:
        rsvp.companions.clear()
        self.database_session.flush()
