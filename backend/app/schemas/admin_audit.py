from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AdminAuditLogItem(BaseModel):
    id: int
    administrator_id: int | None
    administrator_name: str
    administrator_username: str
    administrator_role: str
    action: str
    resource_type: str
    resource_id: str | None
    summary: str
    details: dict[str, Any] | None
    created_at: datetime


class AdminAuditLogListResponse(BaseModel):
    success: bool = True
    logs: list[AdminAuditLogItem]
    total: int
