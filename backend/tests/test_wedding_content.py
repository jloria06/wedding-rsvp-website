from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
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
        assert initial.content.rsvp_mode == "automatic"
        assert initial.rsvp_open is True
        assert initial.content.cover_image == "/images/cover.jpg"
        assert initial.content.moments_video_url.endswith("fu9yk7gCTbc")
        assert len(initial.content.hero_images) == 5
        assert len(initial.content.divider_images) == 5
        assert initial.content.divider_images[3:] == ["", ""]
        assert len(initial.content.gallery_items) == 5
        assert initial.content.gallery_items[0].visible is True
        assert initial.content.story_items[0].image == "/images/story-1.jpg"
        assert initial.content.story_items[0].images == ["/images/story-1.jpg"]

        updated_content = DEFAULT_WEDDING_CONTENT.model_copy(deep=True)
        updated_content.rsvp_deadline = "2027-02-20"
        updated_content.moments_video_url = "https://youtu.be/abcdefghijk"
        updated_content.rsvp_deadline_display = "February 20, 2027"
        updated_content.features.gift = False
        updated_content.story_items[0].images = [
            "/api/wedding-content/media/1",
            "/api/wedding-content/media/2",
        ]
        updated_content.hero_images = [
            f"/api/wedding-content/media/{index}" for index in range(1, 26)
        ]
        updated_content.gallery_items[0].caption = "Our favorite memory"
        updated_content.gallery_items[1].visible = False

        service.update_content(updated_content, administrator_id=1)
        persisted = service.get_content()

        assert persisted.content.rsvp_deadline == "2027-02-20"
        assert persisted.content.moments_video_url == "https://youtu.be/abcdefghijk"
        assert persisted.content.rsvp_deadline_display == "February 20, 2027"
        assert persisted.content.features.gift is False
        assert len(persisted.content.story_items[0].images) == 2
        assert len(persisted.content.hero_images) == 25
        assert persisted.content.gallery_items[0].caption == "Our favorite memory"
        assert persisted.content.gallery_items[1].visible is False


def test_rsvp_deadline_uses_manila_date_and_supports_overrides() -> None:
    content = DEFAULT_WEDDING_CONTENT.model_copy(deep=True)
    content.rsvp_deadline = "2027-02-20"

    assert WeddingContentService.is_rsvp_open(
        content,
        now=datetime(2027, 2, 20, 15, 59, tzinfo=UTC),
    ) is True
    assert WeddingContentService.is_rsvp_open(
        content,
        now=datetime(2027, 2, 20, 16, 0, tzinfo=UTC),
    ) is False

    content.rsvp_mode = "open"
    assert WeddingContentService.is_rsvp_open(
        content,
        now=datetime(2027, 2, 21, tzinfo=UTC),
    ) is True

    content.rsvp_mode = "closed"
    assert WeddingContentService.is_rsvp_open(
        content,
        now=datetime(2027, 2, 19, tzinfo=UTC),
    ) is False


def test_rsvp_deadline_rejects_invalid_dates() -> None:
    content = DEFAULT_WEDDING_CONTENT.model_dump(mode="json", by_alias=True)
    content["rsvpDeadline"] = "February 20"

    with pytest.raises(ValidationError, match="YYYY-MM-DD"):
        DEFAULT_WEDDING_CONTENT.__class__.model_validate(content)
