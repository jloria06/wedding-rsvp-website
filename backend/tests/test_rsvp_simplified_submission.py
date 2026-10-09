from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import Guest, GuestStatus
from app.schemas import RSVPSubmissionRequest
from app.services.rsvp_submission import RSVPSubmissionService


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
