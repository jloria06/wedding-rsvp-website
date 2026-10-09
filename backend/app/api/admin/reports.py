from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.admin_reports import AdminReportSummaryResponse
from app.security import DashboardAdministrator
from app.services.admin_reports import AdminReportsService

router = APIRouter(prefix="/reports", tags=["Admin Reports"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=AdminReportSummaryResponse)
def get_reports(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> AdminReportSummaryResponse:
    return AdminReportsService(database_session).get_summary()


@router.get("/export.csv")
def export_reports(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
) -> Response:
    content = AdminReportsService(database_session).export_csv()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="wedding-management-report.csv"'
        },
    )
