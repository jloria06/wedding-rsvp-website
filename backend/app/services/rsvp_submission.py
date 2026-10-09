from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import (
    AuthorizationError,
    ResourceNotFoundError,
)
from app.models import (
    RSVP,
    AttendanceType,
    Companion,
    GuestStatus,
    RSVPStatus,
)
from app.repositories import GuestRepository, RSVPRepository
from app.schemas import (
    RSVPSubmissionRequest,
    RSVPSubmissionResponse,
)


class RSVPSubmissionService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session
        self.guest_repository = GuestRepository(database_session)
        self.rsvp_repository = RSVPRepository(database_session)

    def submit_rsvp(
        self,
        request: RSVPSubmissionRequest,
    ) -> RSVPSubmissionResponse:
        guest = self.guest_repository.get_by_invitation_code(request.invitation_code)

        if guest is None:
            raise ResourceNotFoundError(
                "The invitation code was not found.",
            )

        if guest.status == GuestStatus.BLOCKED:
            raise AuthorizationError(
                "This invitation is not permitted to submit an RSVP.",
            )

        companions_were_supplied = request.companions is not None
        companion_inputs = request.companions or []
        companion_count = len(companion_inputs)

        if companion_count > guest.maximum_companions:
            raise AuthorizationError(
                "The number of companions exceeds the invitation limit.",
            )

        existing_rsvp = self.rsvp_repository.get_by_guest_id(guest.id)

        if existing_rsvp is None:
            rsvp = RSVP(
                guest_id=guest.id,
                status=request.status,
                attendance_type=request.attendance_type,
                companion_count=companion_count,
                meal_preference=request.meal_preference,
                dietary_restrictions=request.dietary_restrictions,
                guest_message=request.guest_message,
                responded_at=datetime.now(UTC),
            )

            self.rsvp_repository.add(rsvp)
            message = "RSVP submitted successfully."

        else:
            rsvp = existing_rsvp

            if companions_were_supplied:
                self.rsvp_repository.delete_companions(rsvp)
                rsvp.companion_count = companion_count

            rsvp.status = request.status
            rsvp.attendance_type = request.attendance_type
            if "meal_preference" in request.model_fields_set:
                rsvp.meal_preference = request.meal_preference
            rsvp.dietary_restrictions = request.dietary_restrictions
            rsvp.guest_message = request.guest_message
            rsvp.responded_at = datetime.now(UTC)

            message = "RSVP updated successfully."

        if request.status == RSVPStatus.ATTENDING:
            if existing_rsvp is None or companions_were_supplied:
                for companion_input in companion_inputs:
                    rsvp.companions.append(
                        Companion(
                            first_name=companion_input.first_name.strip(),
                            middle_name=(
                                companion_input.middle_name.strip()
                                if companion_input.middle_name
                                else None
                            ),
                            last_name=companion_input.last_name.strip(),
                            meal_preference=(companion_input.meal_preference),
                            dietary_restrictions=(
                                companion_input.dietary_restrictions
                            ),
                        )
                    )

        else:
            rsvp.attendance_type = None
            rsvp.companion_count = 0
            rsvp.meal_preference = None
            rsvp.dietary_restrictions = None

        if (
            request.status != RSVPStatus.ATTENDING
            or request.attendance_type == AttendanceType.CEREMONY_ONLY
        ) and guest.seat_assignment is not None:
            self.database_session.delete(guest.seat_assignment)

        if guest.status == GuestStatus.INVITED:
            guest.status = GuestStatus.VERIFIED

        self.database_session.flush()
        self.database_session.refresh(rsvp)

        return RSVPSubmissionResponse(
            message=message,
            rsvp=rsvp,
        )
