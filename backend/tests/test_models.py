from sqlalchemy import func, select
from sqlalchemy.orm import Session, configure_mappers

from app.database.session import SessionLocal
from app.models import (
    RSVP,
    Administrator,
    AdminRole,
    AdminStatus,
    AttendanceType,
    Companion,
    Guest,
    GuestStatus,
    MealPreference,
    RSVPStatus,
)


def test_sqlalchemy_mappers_configure_successfully() -> None:
    configure_mappers()

    assert Guest.rsvp.property.mapper.class_ is RSVP
    assert RSVP.guest.property.mapper.class_ is Guest
    assert RSVP.companions.property.mapper.class_ is Companion
    assert Companion.rsvp.property.mapper.class_ is RSVP


def test_guest_full_name_omits_missing_middle_name() -> None:
    guest = Guest(
        invitation_code="UNIT-TEST-GUEST",
        first_name="John",
        middle_name=None,
        last_name="Doe",
        maximum_companions=0,
        is_primary_guest=True,
        status=GuestStatus.INVITED,
    )

    assert guest.full_name == "John Doe"


def test_companion_full_name_includes_middle_name() -> None:
    companion = Companion(
        first_name="Jane",
        middle_name="Marie",
        last_name="Doe",
    )

    assert companion.full_name == "Jane Marie Doe"


def test_administrator_properties() -> None:
    administrator = Administrator(
        username="phase5-admin",
        email="phase5-admin@example.local",
        password_hash="not-a-real-password-hash",
        first_name="Phase",
        last_name="Administrator",
        role=AdminRole.ADMIN,
        status=AdminStatus.ACTIVE,
        is_password_change_required=True,
        failed_login_attempts=0,
    )

    assert administrator.full_name == "Phase Administrator"
    assert administrator.is_active is True

    administrator.status = AdminStatus.DISABLED

    assert administrator.is_active is False


def test_guest_rsvp_companion_relationships_are_persisted() -> None:
    session: Session = SessionLocal()

    invitation_code = "PHASE5-PYTEST-RELATIONSHIP"

    try:
        guest = Guest(
            invitation_code=invitation_code,
            first_name="Phase",
            middle_name=None,
            last_name="Tester",
            email="phase5-pytest@example.local",
            maximum_companions=1,
            is_primary_guest=True,
            status=GuestStatus.VERIFIED,
        )

        guest.rsvp = RSVP(
            status=RSVPStatus.ATTENDING,
            attendance_type=AttendanceType.CEREMONY_AND_RECEPTION,
            companion_count=1,
            meal_preference=MealPreference.STANDARD,
            guest_message="Phase 5 automated relationship validation",
        )

        guest.rsvp.companions.append(
            Companion(
                first_name="Sample",
                middle_name=None,
                last_name="Companion",
                meal_preference=MealPreference.VEGETARIAN,
            )
        )

        session.add(guest)
        session.flush()

        loaded_guest = session.scalar(
            select(Guest).where(Guest.invitation_code == invitation_code)
        )

        assert loaded_guest is not None
        assert loaded_guest.rsvp is not None
        assert loaded_guest.rsvp.status == RSVPStatus.ATTENDING
        assert len(loaded_guest.rsvp.companions) == 1
        assert loaded_guest.rsvp.companions[0].full_name == "Sample Companion"

    finally:
        session.rollback()
        session.close()


def test_relationship_test_data_is_not_committed() -> None:
    session: Session = SessionLocal()

    try:
        matching_records = session.scalar(
            select(func.count())
            .select_from(Guest)
            .where(Guest.invitation_code == "PHASE5-PYTEST-RELATIONSHIP")
        )

        assert matching_records == 0

    finally:
        session.close()
