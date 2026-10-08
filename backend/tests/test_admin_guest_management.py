from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import AgeGroup, GuestStatus
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
        assert service.list_guests().total == 1
