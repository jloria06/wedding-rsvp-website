import csv
import io
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError, ResourceNotFoundError
from app.models import (
    RSVP,
    AttendanceType,
    Companion,
    Guest,
    GuestStatus,
    RSVPStatus,
)
from app.repositories import GuestRepository, RSVPRepository
from app.schemas.admin_rsvp import (
    AdminRSVPListItem,
    AdminRSVPListResponse,
    AdminRSVPMutationResponse,
    AdminRSVPUpsertRequest,
)


class AdminRSVPManagementService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session
        self.guest_repository = GuestRepository(database_session)
        self.rsvp_repository = RSVPRepository(database_session)

    def list_rsvps(self) -> AdminRSVPListResponse:
        guests = self.guest_repository.list_all()
        items = [self._build_item(guest) for guest in guests]
        items.sort(
            key=lambda item: (item.responded_at is None, item.guest_name.lower())
        )
        return AdminRSVPListResponse(rsvps=items, total=len(items))

    def upsert_rsvp(
        self, guest_id: int, request: AdminRSVPUpsertRequest
    ) -> AdminRSVPMutationResponse:
        guest = self.guest_repository.get_by_id(guest_id)
        if guest is None:
            raise ResourceNotFoundError("Guest not found.")
        if len(request.companions) > guest.maximum_companions:
            raise AuthorizationError(
                "The number of companions exceeds the invitation limit."
            )

        rsvp = self.rsvp_repository.get_by_guest_id(guest_id)
        created = rsvp is None
        if rsvp is None:
            rsvp = RSVP(guest=guest)
            self.rsvp_repository.add(rsvp)
        else:
            self.rsvp_repository.delete_companions(rsvp)

        rsvp.status = request.status
        rsvp.attendance_type = request.attendance_type
        rsvp.meal_preference = request.meal_preference
        rsvp.dietary_restrictions = self._clean(request.dietary_restrictions)
        rsvp.guest_message = self._clean(request.guest_message)
        rsvp.responded_at = datetime.now(UTC)

        if request.status == RSVPStatus.ATTENDING:
            rsvp.companions = [
                Companion(
                    first_name=companion.first_name.strip(),
                    middle_name=self._clean(companion.middle_name),
                    last_name=companion.last_name.strip(),
                    meal_preference=companion.meal_preference,
                    dietary_restrictions=self._clean(companion.dietary_restrictions),
                )
                for companion in request.companions
            ]
            rsvp.companion_count = len(rsvp.companions)
        else:
            rsvp.attendance_type = None
            rsvp.meal_preference = None
            rsvp.dietary_restrictions = None
            rsvp.companion_count = 0

        if (
            request.status != RSVPStatus.ATTENDING
            or request.attendance_type == AttendanceType.CEREMONY_ONLY
        ) and guest.seat_assignment is not None:
            self.database_session.delete(guest.seat_assignment)

        if guest.status == GuestStatus.INVITED:
            guest.status = GuestStatus.VERIFIED

        self.database_session.flush()
        self.database_session.refresh(rsvp)
        return AdminRSVPMutationResponse(
            message=(
                "RSVP created successfully."
                if created
                else "RSVP updated successfully."
            ),
            rsvp=self._build_item(guest),
        )

    def export_csv(self) -> str:
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(
            [
                "Invitation Code",
                "Guest",
                "Household",
                "RSVP Status",
                "Attendance",
                "Guest Meal",
                "Companions",
                "Companion Names",
                "Dietary Restrictions",
                "Guest Message",
                "Responded At",
            ]
        )
        for item in self.list_rsvps().rsvps:
            writer.writerow(
                [
                    item.invitation_code,
                    item.guest_name,
                    item.household_name or "",
                    item.status.value,
                    item.attendance_type.value if item.attendance_type else "",
                    item.meal_preference.value if item.meal_preference else "",
                    item.companion_count,
                    "; ".join(companion.full_name for companion in item.companions),
                    item.dietary_restrictions or "",
                    item.guest_message or "",
                    item.responded_at.isoformat() if item.responded_at else "",
                ]
            )
        return output.getvalue()

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @staticmethod
    def _build_item(guest: Guest) -> AdminRSVPListItem:
        rsvp = guest.rsvp
        return AdminRSVPListItem(
            guest_id=guest.id,
            invitation_code=guest.invitation_code,
            guest_name=guest.full_name,
            household_name=guest.household_name,
            maximum_companions=guest.maximum_companions,
            rsvp_id=rsvp.id if rsvp else None,
            status=rsvp.status if rsvp else RSVPStatus.PENDING,
            attendance_type=rsvp.attendance_type if rsvp else None,
            companion_count=rsvp.companion_count if rsvp else 0,
            meal_preference=rsvp.meal_preference if rsvp else None,
            dietary_restrictions=rsvp.dietary_restrictions if rsvp else None,
            guest_message=rsvp.guest_message if rsvp else None,
            responded_at=rsvp.responded_at if rsvp else None,
            companions=list(rsvp.companions) if rsvp else [],
        )
