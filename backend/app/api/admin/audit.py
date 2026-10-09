from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_database_session
from app.schemas.admin_audit import AdminAuditLogListResponse
from app.security import DashboardAdministrator
from app.services.admin_audit import AdminAuditService

router = APIRouter(prefix="/audit-logs", tags=["Admin Audit Logs"])
DatabaseSession = Annotated[Session, Depends(get_database_session)]


@router.get("", response_model=AdminAuditLogListResponse)
def list_audit_logs(
    current_administrator: DashboardAdministrator,
    database_session: DatabaseSession,
    search: Annotated[str | None, Query(max_length=200)] = None,
    action: Annotated[str | None, Query(max_length=64)] = None,
    resource_type: Annotated[str | None, Query(max_length=64)] = None,
    administrator_id: Annotated[int | None, Query(gt=0)] = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 250,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminAuditLogListResponse:
    return AdminAuditService(database_session).list_logs(
        search=search,
        action=action,
        resource_type=resource_type,
        administrator_id=administrator_id,
        created_from=created_from,
        created_to=created_to,
        limit=limit,
        offset=offset,
    )
