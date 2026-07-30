from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

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

    def delete_companions(self, rsvp: RSVP) -> None:
        rsvp.companions.clear()
        self.database_session.flush()
