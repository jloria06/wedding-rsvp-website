from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas import (
    GuestVerificationRequest,
    GuestVerificationResponse,
)
from app.services import GuestVerificationService

router = APIRouter(
    prefix="/guests",
    tags=["Guests"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]


@router.post(
    "/verify",
    response_model=GuestVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify a guest invitation code",
)
def verify_guest_invitation(
    request: GuestVerificationRequest,
    database_session: DatabaseSession,
) -> GuestVerificationResponse:
    service = GuestVerificationService(database_session)

    response = service.verify_invitation_code(request.invitation_code)

    database_session.commit()

    return response
