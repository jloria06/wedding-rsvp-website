from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas import (
    RSVPSubmissionRequest,
    RSVPSubmissionResponse,
)
from app.services import RSVPSubmissionService

router = APIRouter(
    prefix="/rsvps",
    tags=["RSVPs"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]


@router.post(
    "",
    response_model=RSVPSubmissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit or update a guest RSVP",
)
def submit_guest_rsvp(
    request: RSVPSubmissionRequest,
    database_session: DatabaseSession,
) -> RSVPSubmissionResponse:
    service = RSVPSubmissionService(database_session)

    response = service.submit_rsvp(request)

    database_session.commit()

    return response
