from sqlalchemy.orm import Session

from app.core.exceptions import (
    AuthorizationError,
    ResourceNotFoundError,
)
from app.models import Guest, GuestStatus
from app.repositories import GuestRepository
from app.schemas import GuestVerificationResponse


class GuestVerificationService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session
        self.guest_repository = GuestRepository(database_session)

    def verify_invitation_code(
        self,
        invitation_code: str,
    ) -> GuestVerificationResponse:
        guest = self.guest_repository.get_by_invitation_code(invitation_code)

        if guest is None:
            raise ResourceNotFoundError(
                "The invitation code was not found.",
            )

        self._ensure_guest_can_access_rsvp(guest)

        if guest.status == GuestStatus.INVITED:
            guest.status = GuestStatus.VERIFIED
            self.database_session.flush()

        return GuestVerificationResponse(
            guest=guest,
            has_existing_rsvp=guest.rsvp is not None,
        )

    @staticmethod
    def _ensure_guest_can_access_rsvp(guest: Guest) -> None:
        if guest.status == GuestStatus.BLOCKED:
            raise AuthorizationError(
                "This invitation is not permitted to submit an RSVP.",
            )
