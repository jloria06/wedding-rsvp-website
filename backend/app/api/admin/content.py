from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.wedding_content import WeddingContentPayload, WeddingContentResponse
from app.security import DashboardAdministrator, GuestManager
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
