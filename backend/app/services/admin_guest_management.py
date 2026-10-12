import csv
import io
import re
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError
from app.models import Guest, GuestStatus, RSVPStatus
from app.repositories import GuestRepository
from app.schemas import (
    AdminGuestCreateRequest,
    AdminGuestCreateResponse,
    AdminGuestDeleteResponse,
    AdminGuestImportResponse,
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
            age_group=request.age_group,
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

        if request.age_group is not None:
            guest.age_group = request.age_group

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

    def mark_invitation_sent(
        self,
        guest_id: int,
    ) -> AdminGuestUpdateResponse:
        guest = self.guest_repository.get_by_id(guest_id)

        if guest is None:
            raise AuthorizationError(
                "Guest not found.",
            )

        guest.invitation_sent_at = datetime.now(UTC)
        self.database_session.flush()

        return AdminGuestUpdateResponse(
            message="Invitation marked as sent.",
            guest=self._build_guest_item(guest),
        )

    def mark_rsvp_reminder_sent(
        self,
        guest_id: int,
    ) -> AdminGuestUpdateResponse:
        guest = self.guest_repository.get_by_id(guest_id)

        if guest is None:
            raise AuthorizationError(
                "Guest not found.",
            )

        if guest.rsvp is not None and guest.rsvp.status != RSVPStatus.PENDING:
            raise AuthorizationError(
                "This guest has already responded to the RSVP.",
            )

        guest.last_rsvp_reminder_sent_at = datetime.now(UTC)
        guest.rsvp_reminder_count += 1
        self.database_session.flush()

        return AdminGuestUpdateResponse(
            message="RSVP reminder marked as sent.",
            guest=self._build_guest_item(guest),
        )

    def check_in_guest(self, guest_id: int, companion_count: int = 0) -> AdminGuestUpdateResponse:
        guest = self.guest_repository.get_by_id(guest_id)
        if guest is None:
            raise AuthorizationError("Guest not found.")
        if guest.rsvp is None or guest.rsvp.status != RSVPStatus.ATTENDING:
            raise AuthorizationError("Only attending guests can be checked in.")
        if companion_count > guest.rsvp.companion_count:
            raise AuthorizationError("Companion arrivals cannot exceed the RSVP companion count.")
        if guest.checked_in_at is None:
            guest.checked_in_at = datetime.now(UTC)
        guest.checked_in_companion_count = companion_count
        self.database_session.flush()
        return AdminGuestUpdateResponse(
            message="Guest checked in successfully.",
            guest=self._build_guest_item(guest),
        )

    def check_out_guest(self, guest_id: int) -> AdminGuestUpdateResponse:
        guest = self.guest_repository.get_by_id(guest_id)
        if guest is None:
            raise AuthorizationError("Guest not found.")
        guest.checked_in_at = None
        guest.checked_in_companion_count = 0
        self.database_session.flush()
        return AdminGuestUpdateResponse(
            message="Guest check-in removed.",
            guest=self._build_guest_item(guest),
        )

    def import_csv(self, content: str) -> AdminGuestImportResponse:
        reader = csv.DictReader(io.StringIO(content))

        if reader.fieldnames is None:
            raise ValueError("The CSV file must include a header row.")

        imported_count = 0
        errors: list[str] = []

        for row_number, source_row in enumerate(reader, start=2):
            row = {
                self._normalize_header(key): (value or "").strip()
                for key, value in source_row.items()
                if key is not None
            }

            if not any(row.values()):
                continue

            try:
                first_name = row.get("first_name", "")
                last_name = row.get("last_name", "")
                invitation_code = row.get("invitation_code", "") or self._new_code(
                    first_name,
                    last_name,
                )
                request = AdminGuestCreateRequest(
                    invitation_code=invitation_code,
                    first_name=first_name,
                    middle_name=row.get("middle_name") or None,
                    last_name=last_name,
                    email=row.get("email") or None,
                    phone_number=row.get("phone_number") or None,
                    household_name=row.get("guest_group") or row.get("household_name") or None,
                    maximum_companions=int(row.get("maximum_companions") or 0),
                    age_group=row.get("age_group") or "adult",
                    is_primary_guest=self._parse_boolean(
                        row.get("is_primary_guest", "true")
                    ),
                )
                self.create_guest(request)
                imported_count += 1
            except (AuthorizationError, ValueError) as error:
                errors.append(f"Row {row_number}: {error}")

        return AdminGuestImportResponse(
            message=(
                f"Imported {imported_count} guest"
                f"{'s' if imported_count != 1 else ''}."
            ),
            imported_count=imported_count,
            skipped_count=len(errors),
            errors=errors,
        )

    def export_csv(self) -> str:
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(
            [
                "invitation_code",
                "first_name",
                "middle_name",
                "last_name",
                "email",
                "phone_number",
                "guest_group",
                "age_group",
                "is_primary_guest",
                "guest_status",
                "rsvp_status",
                "invitation_sent_at",
                "last_rsvp_reminder_sent_at",
                "rsvp_reminder_count",
            ]
        )

        for guest in self.guest_repository.list_all():
            writer.writerow(
                [
                    guest.invitation_code,
                    guest.first_name,
                    guest.middle_name or "",
                    guest.last_name,
                    guest.email or "",
                    guest.phone_number or "",
                    guest.household_name or "",
                    guest.age_group.value,
                    "true" if guest.is_primary_guest else "false",
                    guest.status.value,
                    guest.rsvp.status.value if guest.rsvp is not None else "pending",
                    (
                        guest.invitation_sent_at.isoformat()
                        if guest.invitation_sent_at
                        else ""
                    ),
                    (
                        guest.last_rsvp_reminder_sent_at.isoformat()
                        if guest.last_rsvp_reminder_sent_at
                        else ""
                    ),
                    guest.rsvp_reminder_count,
                ]
            )

        return output.getvalue()

    def export_check_in_csv(self) -> str:
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(
            [
                "invitation_code",
                "guest_name",
                "guest_group",
                "expected_party_size",
                "primary_guest_checked_in",
                "companions_checked_in",
                "total_people_arrived",
                "check_in_status",
                "checked_in_at",
            ]
        )

        for guest in self.guest_repository.list_all():
            if guest.rsvp is None or guest.rsvp.status != RSVPStatus.ATTENDING:
                continue
            is_checked_in = guest.checked_in_at is not None
            writer.writerow(
                [
                    guest.invitation_code,
                    guest.full_name,
                    guest.household_name or "",
                    1 + guest.rsvp.companion_count,
                    "yes" if is_checked_in else "no",
                    guest.checked_in_companion_count if is_checked_in else 0,
                    (1 + guest.checked_in_companion_count) if is_checked_in else 0,
                    "checked_in" if is_checked_in else "waiting",
                    guest.checked_in_at.isoformat() if guest.checked_in_at else "",
                ]
            )

        return output.getvalue()

    def _new_code(self, first_name: str, last_name: str) -> str:
        name = re.sub(
            r"[^A-Z0-9]+",
            "-",
            f"{first_name}-{last_name}".upper(),
        ).strip("-")
        prefix = name[:40] or "GUEST"

        while True:
            code = f"{prefix}-{uuid4().hex[:6].upper()}"
            if not self.guest_repository.invitation_code_exists(code):
                return code

    @staticmethod
    def _normalize_header(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")

    @staticmethod
    def _parse_boolean(value: str) -> bool:
        normalized = value.strip().lower()
        if normalized in {"", "true", "yes", "y", "1"}:
            return True
        if normalized in {"false", "no", "n", "0"}:
            return False
        raise ValueError(f"Invalid is_primary_guest value '{value}'.")

    @staticmethod
    def _build_guest_item(
        guest: Guest,
    ) -> AdminGuestListItem:
        return AdminGuestListItem(
            id=guest.id,
            invitation_code=guest.invitation_code,
            full_name=guest.full_name,
            first_name=guest.first_name,
            middle_name=guest.middle_name,
            last_name=guest.last_name,
            email=guest.email,
            phone_number=guest.phone_number,
            household_name=guest.household_name,
            maximum_companions=guest.maximum_companions,
            age_group=guest.age_group,
            is_primary_guest=guest.is_primary_guest,
            status=guest.status,
            rsvp_status=(guest.rsvp.status if guest.rsvp is not None else None),
            companion_count=(guest.rsvp.companion_count if guest.rsvp is not None else 0),
            invitation_sent_at=guest.invitation_sent_at,
            last_rsvp_reminder_sent_at=guest.last_rsvp_reminder_sent_at,
            rsvp_reminder_count=guest.rsvp_reminder_count,
            checked_in_at=guest.checked_in_at,
            checked_in_companion_count=guest.checked_in_companion_count,
            created_at=guest.created_at,
        )
