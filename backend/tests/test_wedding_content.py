from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.schemas.wedding_content import DEFAULT_WEDDING_CONTENT
from app.services.wedding_content import WeddingContentService


def test_wedding_content_uses_defaults_and_persists_updates() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = WeddingContentService(session)
        initial = service.get_content()
        assert initial.content.ceremony.name.startswith("Diocesan Shrine")
        assert initial.content.features.rsvp is True

        updated_content = DEFAULT_WEDDING_CONTENT.model_copy(deep=True)
        updated_content.rsvp_deadline = "2027-02-20"
        updated_content.rsvp_deadline_display = "February 20, 2027"
        updated_content.features.gift = False

        service.update_content(updated_content, administrator_id=1)
        persisted = service.get_content()

        assert persisted.content.rsvp_deadline == "2027-02-20"
        assert persisted.content.rsvp_deadline_display == "February 20, 2027"
        assert persisted.content.features.gift is False
