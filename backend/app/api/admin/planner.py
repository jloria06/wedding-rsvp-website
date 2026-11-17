from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError
from app.database.session import get_database_session
from app.models import AdminRole
from app.schemas.wedding_planner import PlannerSaveRequest
from app.security import DashboardAdministrator
from app.services.admin_audit import AdminAuditService
from app.services.wedding_planner import WeddingPlannerService

router = APIRouter(prefix="/planner", tags=["Admin Wedding Planner"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("")
def read_planner(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
    response: Response,
) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return WeddingPlannerService(database_session).read()


@router.put("")
def save_planner(
    request: PlannerSaveRequest,
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
    response: Response,
) -> dict:
    if current_administrator.role == AdminRole.VIEWER:
        raise AuthorizationError("Viewer accounts cannot modify the wedding planner.")
    result = WeddingPlannerService(database_session).save(
        request, current_administrator.id
    )
    AdminAuditService(database_session).record(
        current_administrator,
        action="planner.updated",
        resource_type="wedding_planner",
        resource_id=1,
        summary="Updated the private wedding planner.",
        details={"revision": result["revision"]},
    )
    database_session.commit()
    response.headers["Cache-Control"] = "no-store"
    return result
