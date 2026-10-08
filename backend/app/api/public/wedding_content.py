from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.wedding_content import WeddingContentResponse
from app.services.wedding_content import WeddingContentService

router = APIRouter(prefix="/wedding-content", tags=["Wedding Content"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=WeddingContentResponse)
def get_wedding_content(database_session: DatabaseSession) -> WeddingContentResponse:
    return WeddingContentService(database_session).get_content()
