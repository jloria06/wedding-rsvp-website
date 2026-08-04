from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Guest


class GuestRepository:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_by_id(self, guest_id: int) -> Guest | None:
        statement = (
            select(Guest)
            .options(
                selectinload(Guest.rsvp),
            )
            .where(
                Guest.id == guest_id,
                Guest.deleted_at.is_(None),
            )
        )

        return self.database_session.scalar(statement)

    def get_by_invitation_code(
        self,
        invitation_code: str,
    ) -> Guest | None:
        normalized_code = invitation_code.strip().upper()

        statement = (
            select(Guest)
            .options(
                selectinload(Guest.rsvp),
            )
            .where(
                Guest.invitation_code == normalized_code,
                Guest.deleted_at.is_(None),
            )
        )

        return self.database_session.scalar(statement)

    def invitation_code_exists(
        self,
        invitation_code: str,
    ) -> bool:
        normalized_code = invitation_code.strip().upper()

        statement = select(Guest.id).where(
            Guest.invitation_code == normalized_code,
            Guest.deleted_at.is_(None),
        )

        return self.database_session.scalar(statement) is not None

    def add(self, guest: Guest) -> Guest:
        guest.invitation_code = guest.invitation_code.strip().upper()

        self.database_session.add(guest)
        self.database_session.flush()

        return guest

    def list_all(self) -> list[Guest]:
        statement = (
            select(Guest)
            .options(
                selectinload(Guest.rsvp),
            )
            .where(
                Guest.deleted_at.is_(None),
            )
            .order_by(
                Guest.last_name,
                Guest.first_name,
            )
        )

        return list(self.database_session.scalars(statement).all())
