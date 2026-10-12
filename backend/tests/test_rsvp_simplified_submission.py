import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.core.exceptions import AuthorizationError
from app.models import Guest, GuestStatus
from app.schemas import RSVPSubmissionRequest
from app.services.rsvp_submission import RSVPSubmissionService
from app.services.wedding_content import WeddingContentService
from app.schemas.wedding_content import DEFAULT_WEDDING_CONTENT


def test_simplified_update_preserves_existing_meal_and_companions() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        guest = Guest(
            invitation_code="SIMPLIFIED-RSVP",
            first_name="Test",
            last_name="Guest",
            maximum_companions=1,
            status=GuestStatus.INVITED,
        )
        session.add(guest)
        session.flush()

        service = RSVPSubmissionService(session)
        service.submit_rsvp(
            RSVPSubmissionRequest(
                invitation_code=guest.invitation_code,
                status="attending",
                attendance_type="ceremony_and_reception",
                meal_preference="standard",
                dietary_restrictions="Existing allergy",
                companions=[
                    {
                        "first_name": "Existing",
                        "last_name": "Companion",
                        "meal_preference": "vegetarian",
                    }
                ],
            )
        )

        updated = service.submit_rsvp(
            RSVPSubmissionRequest(
                invitation_code=guest.invitation_code,
                status="attending",
                attendance_type="ceremony_only",
                guest_message="Updated without meal, dietary, or plus-one fields.",
            )
        )

        assert updated.rsvp.meal_preference.value == "standard"
        assert updated.rsvp.dietary_restrictions == "Existing allergy"
        assert updated.rsvp.companion_count == 1
        assert len(updated.rsvp.companions) == 1
        assert updated.rsvp.companions[0].first_name == "Existing"


def test_public_rsvp_submission_respects_manual_closure() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        guest = Guest(
            invitation_code="CLOSED-RSVP",
            first_name="Closed",
            last_name="Guest",
            status=GuestStatus.INVITED,
        )
        session.add(guest)
        content = DEFAULT_WEDDING_CONTENT.model_copy(deep=True)
        content.rsvp_mode = "closed"
        content.rsvp_closed_message = "Please contact us directly."
        WeddingContentService(session).update_content(content, administrator_id=1)
        session.flush()

        with pytest.raises(AuthorizationError, match="contact us directly"):
            RSVPSubmissionService(session).submit_rsvp(
                RSVPSubmissionRequest(
                    invitation_code=guest.invitation_code,
                    status="not_attending",
                )
            )
