from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_database_session

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)

settings = get_settings()

DatabaseSession = Annotated[
    Session,
    Depends(get_database_session),
]


@router.get(
    "",
    summary="Check API and database health",
)
def check_health(
    database_session: DatabaseSession,
) -> dict[str, Any]:
    database_result = (
        database_session.execute(
            text("""
            SELECT
                DATABASE() AS active_database,
                CURRENT_USER() AS authenticated_account,
                VERSION() AS mysql_version
            """)
        )
        .mappings()
        .one()
    )

    return {
        "success": True,
        "status": "healthy",
        "service": settings.app_name,
        "environment": settings.app_env,
        "timestamp": datetime.now(UTC).isoformat(),
        "database": {
            "status": "connected",
            "name": database_result["active_database"],
            "account": database_result["authenticated_account"],
            "version": database_result["mysql_version"],
        },
    }
