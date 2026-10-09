from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Administrator, AuditLog
from app.schemas.admin_audit import AdminAuditLogItem, AdminAuditLogListResponse


class AdminAuditService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def record(
        self,
        administrator: Administrator,
        *,
        action: str,
        resource_type: str,
        summary: str,
        resource_id: int | str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            administrator_id=administrator.id,
            administrator_name=administrator.full_name,
            administrator_username=administrator.username,
            administrator_role=administrator.role.value,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            summary=summary,
            details=details or None,
        )
        self.database_session.add(entry)
        self.database_session.flush()
        return entry

    def list_logs(
        self,
        *,
        search: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        administrator_id: int | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        limit: int = 250,
        offset: int = 0,
    ) -> AdminAuditLogListResponse:
        conditions = []
        if search and search.strip():
            pattern = f"%{search.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(AuditLog.summary).like(pattern),
                    func.lower(AuditLog.administrator_name).like(pattern),
                    func.lower(AuditLog.administrator_username).like(pattern),
                    func.lower(AuditLog.resource_id).like(pattern),
                )
            )
        if action:
            conditions.append(AuditLog.action == action)
        if resource_type:
            conditions.append(AuditLog.resource_type == resource_type)
        if administrator_id is not None:
            conditions.append(AuditLog.administrator_id == administrator_id)
        if created_from is not None:
            conditions.append(AuditLog.created_at >= created_from)
        if created_to is not None:
            conditions.append(AuditLog.created_at <= created_to)

        statement = select(AuditLog)
        count_statement = select(func.count(AuditLog.id))
        if conditions:
            statement = statement.where(*conditions)
            count_statement = count_statement.where(*conditions)

        records = self.database_session.scalars(
            statement.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        total = self.database_session.scalar(count_statement) or 0
        return AdminAuditLogListResponse(
            logs=[self._build_item(record) for record in records],
            total=total,
        )

    @staticmethod
    def _build_item(record: AuditLog) -> AdminAuditLogItem:
        return AdminAuditLogItem(
            id=record.id,
            administrator_id=record.administrator_id,
            administrator_name=record.administrator_name,
            administrator_username=record.administrator_username,
            administrator_role=record.administrator_role,
            action=record.action,
            resource_type=record.resource_type,
            resource_id=record.resource_id,
            summary=record.summary,
            details=record.details,
            created_at=record.created_at,
        )
