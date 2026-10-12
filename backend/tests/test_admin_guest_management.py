from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
import pytest

from app.core.exceptions import AuthorizationError
from app.models import AgeGroup, GuestStatus, RSVP, RSVPStatus
from app.schemas import AdminGuestCreateRequest, AdminGuestUpdateRequest
from app.services.admin_guest_management import AdminGuestManagementService


def test_guest_management_preserves_age_group_and_editable_details() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = AdminGuestManagementService(session)
        created = service.create_guest(
            AdminGuestCreateRequest(
                invitation_code="child-guest",
                first_name="Sample",
                last_name="Child",
                email="child@example.com",
                phone_number="09170000000",
                household_name="Sample Household",
                maximum_companions=1,
                age_group=AgeGroup.CHILD,
            )
        )

        assert created.guest.invitation_code == "CHILD-GUEST"
        assert created.guest.age_group == AgeGroup.CHILD
        assert created.guest.phone_number == "09170000000"
        assert created.guest.is_primary_guest is True

        updated = service.update_guest(
            created.guest.id,
            AdminGuestUpdateRequest(
                age_group=AgeGroup.ADULT,
                status=GuestStatus.BLOCKED,
            ),
        )

        assert updated.guest.age_group == AgeGroup.ADULT
        assert updated.guest.status == GuestStatus.BLOCKED

        sent = service.mark_invitation_sent(created.guest.id)
        assert sent.guest.invitation_sent_at is not None

        reminded = service.mark_rsvp_reminder_sent(created.guest.id)
        assert reminded.guest.last_rsvp_reminder_sent_at is not None
        assert reminded.guest.rsvp_reminder_count == 1

        reminded_again = service.mark_rsvp_reminder_sent(created.guest.id)
        assert reminded_again.guest.rsvp_reminder_count == 2

        guest = service.guest_repository.get_by_id(created.guest.id)
        assert guest is not None
        guest.rsvp = RSVP(status=RSVPStatus.ATTENDING)
        session.flush()

        checked_in = service.check_in_guest(created.guest.id)
        assert checked_in.guest.checked_in_at is not None

        checked_out = service.check_out_guest(created.guest.id)
        assert checked_out.guest.checked_in_at is None

        with pytest.raises(AuthorizationError):
            service.mark_rsvp_reminder_sent(created.guest.id)
        assert service.list_guests().total == 1


def test_check_in_rejects_guest_without_attending_rsvp() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = AdminGuestManagementService(session)
        created = service.create_guest(
            AdminGuestCreateRequest(
                invitation_code="PENDING-GUEST",
                first_name="Pending",
                last_name="Guest",
            )
        )

        with pytest.raises(AuthorizationError, match="attending"):
            service.check_in_guest(created.guest.id)


def test_guest_csv_import_and_export_reports_invalid_rows() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = AdminGuestManagementService(session)
        service.create_guest(
            AdminGuestCreateRequest(
                invitation_code="EXISTING-CODE",
                first_name="Existing",
                last_name="Guest",
            )
        )

        result = service.import_csv(
            "invitation_code,first_name,last_name,email,age_group\n"
            ",Bulk,Guest,bulk@example.com,adult\n"
            "EXISTING-CODE,Duplicate,Guest,duplicate@example.com,adult\n"
            "BAD-EMAIL,Invalid,Email,not-an-email,adult\n"
        )

        assert result.imported_count == 1
        assert result.skipped_count == 2
        assert len(result.errors) == 2
        assert service.list_guests().total == 2

        exported = service.export_csv()
        assert "invitation_code,first_name" in exported
        assert "bulk@example.com" in exported
        assert "last_rsvp_reminder_sent_at" in exported
