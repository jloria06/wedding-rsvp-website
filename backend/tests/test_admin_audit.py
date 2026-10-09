from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import Administrator, AdminRole, AdminStatus
from app.services.admin_audit import AdminAuditService


def build_administrator() -> Administrator:
    return Administrator(
        username="audit-admin",
        email="audit@example.com",
        password_hash="not-used-in-this-test",
        first_name="Audit",
        last_name="Administrator",
        role=AdminRole.SUPER_ADMIN,
        status=AdminStatus.ACTIVE,
        is_password_change_required=False,
    )


def test_audit_service_records_actor_resource_and_details() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        administrator = build_administrator()
        session.add(administrator)
        session.flush()
        service = AdminAuditService(session)

        entry = service.record(
            administrator,
            action="guest.updated",
            resource_type="guest",
            resource_id=42,
            summary="Updated guest Sample Person.",
            details={"changed_fields": ["email", "phone_number"]},
        )

        assert entry.administrator_id == administrator.id
        assert entry.administrator_name == "Audit Administrator"
        assert entry.resource_id == "42"

        result = service.list_logs()
        assert result.total == 1
        assert result.logs[0].action == "guest.updated"
        assert result.logs[0].details == {
            "changed_fields": ["email", "phone_number"]
        }


def test_audit_service_filters_by_search_action_and_resource() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        administrator = build_administrator()
        session.add(administrator)
        session.flush()
        service = AdminAuditService(session)
        service.record(
            administrator,
            action="guest.created",
            resource_type="guest",
            resource_id=1,
            summary="Created guest Joyce Sample.",
        )
        service.record(
            administrator,
            action="content.updated",
            resource_type="wedding_content",
            resource_id=1,
            summary="Updated the public wedding website content.",
        )

        by_search = service.list_logs(search="joyce")
        by_action = service.list_logs(action="content.updated")
        by_resource = service.list_logs(resource_type="guest")

        assert [item.action for item in by_search.logs] == ["guest.created"]
        assert [item.resource_type for item in by_action.logs] == [
            "wedding_content"
        ]
        assert [item.action for item in by_resource.logs] == ["guest.created"]
