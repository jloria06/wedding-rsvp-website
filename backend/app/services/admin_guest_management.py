from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError
from app.models import Guest, GuestStatus
from app.repositories import GuestRepository
from app.schemas import (
    AdminGuestCreateRequest,
    AdminGuestCreateResponse,
    AdminGuestDeleteResponse,
    AdminGuestListItem,
    AdminGuestListResponse,
    AdminGuestUpdateRequest,
    AdminGuestUpdateResponse,
)


class AdminGuestManagementService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session
        self.guest_repository = GuestRepository(database_session)

    def list_guests(self) -> AdminGuestListResponse:
        guests = self.guest_repository.list_all()

        items = [self._build_guest_item(guest) for guest in guests]

        return AdminGuestListResponse(
            guests=items,
            total=len(items),
        )

    def create_guest(
        self,
        request: AdminGuestCreateRequest,
    ) -> AdminGuestCreateResponse:
        invitation_code = request.invitation_code.strip().upper()

        if self.guest_repository.invitation_code_exists(invitation_code):
            raise AuthorizationError(
                "The invitation code already exists.",
            )

        guest = Guest(
            invitation_code=invitation_code,
            first_name=request.first_name.strip(),
            middle_name=(request.middle_name.strip() if request.middle_name else None),
            last_name=request.last_name.strip(),
            email=(str(request.email).lower() if request.email else None),
            phone_number=(
                request.phone_number.strip() if request.phone_number else None
            ),
            household_name=(
                request.household_name.strip() if request.household_name else None
            ),
            maximum_companions=request.maximum_companions,
            is_primary_guest=request.is_primary_guest,
            status=GuestStatus.INVITED,
        )

        self.guest_repository.add(guest)

        return AdminGuestCreateResponse(
            message="Guest created successfully.",
            guest=self._build_guest_item(guest),
        )

    def update_guest(
        self,
        guest_id: int,
        request: AdminGuestUpdateRequest,
    ) -> AdminGuestUpdateResponse:
        guest = self.guest_repository.get_by_id(guest_id)

        if guest is None:
            raise AuthorizationError(
                "Guest not found.",
            )

        if request.first_name is not None:
            guest.first_name = request.first_name.strip()

        if request.middle_name is not None:
            guest.middle_name = (
                request.middle_name.strip() if request.middle_name.strip() else None
            )

        if request.last_name is not None:
            guest.last_name = request.last_name.strip()

        if request.email is not None:
            guest.email = str(request.email).lower()

        if request.phone_number is not None:
            guest.phone_number = (
                request.phone_number.strip() if request.phone_number.strip() else None
            )

        if request.household_name is not None:
            guest.household_name = (
                request.household_name.strip()
                if request.household_name.strip()
                else None
            )

        if request.maximum_companions is not None:
            guest.maximum_companions = request.maximum_companions

        if request.is_primary_guest is not None:
            guest.is_primary_guest = request.is_primary_guest

        if request.status is not None:
            guest.status = request.status

        self.database_session.flush()

        return AdminGuestUpdateResponse(
            message="Guest updated successfully.",
            guest=self._build_guest_item(guest),
        )

    def soft_delete_guest(
        self,
        guest_id: int,
    ) -> AdminGuestDeleteResponse:
        guest = self.guest_repository.get_by_id(guest_id)

        if guest is None:
            raise AuthorizationError(
                "Guest not found.",
            )

        guest.deleted_at = datetime.now(UTC)

        self.database_session.flush()

        return AdminGuestDeleteResponse(
            message="Guest deleted successfully.",
            guest_id=guest.id,
        )

    @staticmethod
    def _build_guest_item(
        guest: Guest,
    ) -> AdminGuestListItem:
        return AdminGuestListItem(
            id=guest.id,
            invitation_code=guest.invitation_code,
            full_name=guest.full_name,
            email=guest.email,
            household_name=guest.household_name,
            maximum_companions=guest.maximum_companions,
            status=guest.status,
            rsvp_status=(guest.rsvp.status if guest.rsvp is not None else None),
            created_at=guest.created_at,
        )
