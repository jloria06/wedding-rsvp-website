import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.exceptions import ApplicationError, ResourceNotFoundError
from app.database.base import Base
from app.services.media_asset import MAX_IMAGE_BYTES, MediaAssetService


def test_media_asset_persists_and_returns_public_url() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = MediaAssetService(session)
        response = service.create_image(
            filename="story.webp",
            content_type="image/webp",
            data=b"wedding-image",
            administrator_id=1,
        )
        session.commit()

        asset = service.get(response.id)
        assert response.url == f"/api/wedding-content/media/{response.id}"
        assert asset.data == b"wedding-image"
        assert asset.content_type == "image/webp"


@pytest.mark.parametrize(
    ("content_type", "data", "status_code"),
    [
        ("image/gif", b"image", 415),
        ("image/jpeg", b"", 400),
        ("image/png", b"x" * (MAX_IMAGE_BYTES + 1), 413),
    ],
    ids=["unsupported-type", "empty-image", "oversized-image"],
)
def test_media_asset_rejects_invalid_uploads(
    content_type: str, data: bytes, status_code: int
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session, pytest.raises(ApplicationError) as error:
        MediaAssetService(session).create_image(
            filename="upload",
            content_type=content_type,
            data=data,
            administrator_id=1,
        )
    assert error.value.status_code == status_code


def test_media_asset_get_rejects_unknown_id() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, pytest.raises(ResourceNotFoundError):
        MediaAssetService(session).get(999)
