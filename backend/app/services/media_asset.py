from sqlalchemy.orm import Session

from app.core.exceptions import ApplicationError, ResourceNotFoundError
from app.models import MediaAsset
from app.schemas.media_asset import MediaUploadResponse

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class MediaAssetService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def create_image(
        self,
        *,
        filename: str,
        content_type: str,
        data: bytes,
        administrator_id: int,
    ) -> MediaUploadResponse:
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise ApplicationError(
                "Upload a JPEG, PNG, or WebP image.",
                status_code=415,
                error_code="UNSUPPORTED_IMAGE_TYPE",
            )
        if not data:
            raise ApplicationError("The uploaded image is empty.")
        if len(data) > MAX_IMAGE_BYTES:
            raise ApplicationError(
                "The image must be 5 MB or smaller.",
                status_code=413,
                error_code="IMAGE_TOO_LARGE",
            )

        safe_filename = (filename or "image").strip()[:255] or "image"
        asset = MediaAsset(
            original_filename=safe_filename,
            content_type=content_type,
            size_bytes=len(data),
            data=data,
            uploaded_by_id=administrator_id,
        )
        self.database_session.add(asset)
        self.database_session.flush()
        return MediaUploadResponse(
            id=asset.id,
            url=f"/api/wedding-content/media/{asset.id}",
            filename=asset.original_filename,
            content_type=asset.content_type,
            size_bytes=asset.size_bytes,
        )

    def get(self, asset_id: int) -> MediaAsset:
        asset = self.database_session.get(MediaAsset, asset_id)
        if asset is None:
            raise ResourceNotFoundError("The requested image was not found.")
        return asset
