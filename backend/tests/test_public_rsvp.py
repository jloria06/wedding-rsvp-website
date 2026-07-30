from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.main import app
from app.models import RSVP, Guest, GuestStatus

client = TestClient(app)

TEST_CODES = [
    "PYTEST-GUEST-VERIFY",
    "PYTEST-RSVP-SUBMIT",
    "PYTEST-RSVP-UPDATE",
    "PYTEST-RSVP-LIMIT",
]


def remove_test_guest(
    database_session: Session,
    invitation_code: str,
) -> None:
    guest = database_session.scalar(
        select(Guest).where(Guest.invitation_code == invitation_code)
    )

    if guest is not None:
        database_session.delete(guest)
        database_session.flush()


@pytest.fixture(autouse=True)
def clean_test_records() -> Generator[None]:
    database_session = SessionLocal()

    try:
        database_session.execute(
            delete(Guest).where(Guest.invitation_code.in_(TEST_CODES))
        )
        database_session.commit()

    finally:
        database_session.close()

    yield

    database_session = SessionLocal()

    try:
        database_session.execute(
            delete(Guest).where(Guest.invitation_code.in_(TEST_CODES))
        )
        database_session.commit()

    finally:
        database_session.close()


def create_guest(
    invitation_code: str,
    *,
    maximum_companions: int = 1,
    status: GuestStatus = GuestStatus.INVITED,
) -> None:
    database_session = SessionLocal()

    try:
        database_session.add(
            Guest(
                invitation_code=invitation_code,
                first_name="Automated",
                middle_name=None,
                last_name="Tester",
                email=f"{invitation_code.lower()}@example.com",
                maximum_companions=maximum_companions,
                is_primary_guest=True,
                status=status,
            )
        )
        database_session.commit()

    finally:
        database_session.close()


def test_guest_verification_endpoint() -> None:
    invitation_code = "PYTEST-GUEST-VERIFY"
    create_guest(invitation_code)

    response = client.post(
        "/api/guests/verify",
        json={
            "invitation_code": " pytest-guest-verify ",
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["success"] is True
    assert payload["guest"]["invitation_code"] == invitation_code
    assert payload["guest"]["status"] == "verified"
    assert payload["has_existing_rsvp"] is False


def test_unknown_guest_verification_is_rejected() -> None:
    response = client.post(
        "/api/guests/verify",
        json={
            "invitation_code": "UNKNOWN-PYTEST-CODE",
        },
    )

    assert response.status_code == 404


def test_attending_rsvp_submission() -> None:
    invitation_code = "PYTEST-RSVP-SUBMIT"
    create_guest(invitation_code)

    response = client.post(
        "/api/rsvps",
        json={
            "invitation_code": invitation_code,
            "status": "attending",
            "attendance_type": "ceremony_and_reception",
            "meal_preference": "standard",
            "guest_message": "Automated RSVP test.",
            "companions": [
                {
                    "first_name": "Sample",
                    "middle_name": None,
                    "last_name": "Companion",
                    "meal_preference": "vegetarian",
                    "dietary_restrictions": None,
                }
            ],
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["success"] is True
    assert payload["message"] == "RSVP submitted successfully."
    assert payload["rsvp"]["status"] == "attending"
    assert payload["rsvp"]["companion_count"] == 1
    assert len(payload["rsvp"]["companions"]) == 1


def test_existing_rsvp_can_be_updated_to_not_attending() -> None:
    invitation_code = "PYTEST-RSVP-UPDATE"
    create_guest(invitation_code)

    first_response = client.post(
        "/api/rsvps",
        json={
            "invitation_code": invitation_code,
            "status": "attending",
            "attendance_type": "ceremony_only",
            "meal_preference": "standard",
            "companions": [
                {
                    "first_name": "Temporary",
                    "middle_name": None,
                    "last_name": "Companion",
                    "meal_preference": "standard",
                    "dietary_restrictions": None,
                }
            ],
        },
    )

    assert first_response.status_code == 200

    update_response = client.post(
        "/api/rsvps",
        json={
            "invitation_code": invitation_code,
            "status": "not_attending",
            "attendance_type": None,
            "meal_preference": None,
            "dietary_restrictions": None,
            "guest_message": "Unable to attend.",
            "companions": [],
        },
    )

    assert update_response.status_code == 200

    payload = update_response.json()

    assert payload["message"] == "RSVP updated successfully."
    assert payload["rsvp"]["status"] == "not_attending"
    assert payload["rsvp"]["attendance_type"] is None
    assert payload["rsvp"]["companion_count"] == 0
    assert payload["rsvp"]["companions"] == []

    database_session = SessionLocal()

    try:
        guest = database_session.scalar(
            select(Guest).where(Guest.invitation_code == invitation_code)
        )

        assert guest is not None

        rsvp = database_session.scalar(select(RSVP).where(RSVP.guest_id == guest.id))

        assert rsvp is not None
        assert rsvp.companion_count == 0
        assert rsvp.attendance_type is None

    finally:
        database_session.close()


def test_companion_limit_is_enforced() -> None:
    invitation_code = "PYTEST-RSVP-LIMIT"

    create_guest(
        invitation_code,
        maximum_companions=0,
    )

    response = client.post(
        "/api/rsvps",
        json={
            "invitation_code": invitation_code,
            "status": "attending",
            "attendance_type": "ceremony_and_reception",
            "companions": [
                {
                    "first_name": "Extra",
                    "middle_name": None,
                    "last_name": "Guest",
                    "meal_preference": "standard",
                    "dietary_restrictions": None,
                }
            ],
        },
    )

    assert response.status_code == 403
