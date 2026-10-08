from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.admin_dashboard import AdminDashboardStatisticsResponse
from app.security import DashboardAdministrator
from app.services.admin_dashboard import AdminDashboardService

router = APIRouter(
    prefix="/dashboard",
    tags=["Admin Dashboard"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]


@router.get(
    "/statistics",
    response_model=AdminDashboardStatisticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get wedding RSVP dashboard statistics",
)
def get_dashboard_statistics(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> AdminDashboardStatisticsResponse:
    service = AdminDashboardService(database_session)

    return service.get_statistics()
