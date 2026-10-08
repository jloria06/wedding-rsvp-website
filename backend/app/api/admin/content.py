from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.media_asset import MediaUploadResponse
from app.schemas.wedding_content import WeddingContentPayload, WeddingContentResponse
from app.security import DashboardAdministrator, GuestManager
from app.services.media_asset import MAX_IMAGE_BYTES, MediaAssetService
from app.services.wedding_content import WeddingContentService

router = APIRouter(prefix="/content", tags=["Admin Content"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=WeddingContentResponse)
def get_content(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> WeddingContentResponse:
    return WeddingContentService(database_session).get_content()


@router.put("", response_model=WeddingContentResponse)
def update_content(
    content: WeddingContentPayload,
    current_administrator: GuestManager,
    database_session: DatabaseSession,
) -> WeddingContentResponse:
    response = WeddingContentService(database_session).update_content(
        content, current_administrator.id
    )
    database_session.commit()
    return response


@router.post("/media", response_model=MediaUploadResponse, status_code=201)
async def upload_content_image(
    current_administrator: GuestManager,
    database_session: DatabaseSession,
    image: Annotated[UploadFile, File()],
) -> MediaUploadResponse:
    data = await image.read(MAX_IMAGE_BYTES + 1)
    response = MediaAssetService(database_session).create_image(
        filename=image.filename or "image",
        content_type=image.content_type or "application/octet-stream",
        data=data,
        administrator_id=current_administrator.id,
    )
    database_session.commit()
    return response
