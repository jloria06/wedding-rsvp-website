import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError, ConflictError
from app.database.base import Base
from app.models import Administrator, AdminRole, AdminStatus
from app.schemas.admin_administrator import (
    AdminAccountCreateRequest,
    AdminAccountPasswordResetRequest,
    AdminAccountUpdateRequest,
)
from app.security.admin_context import require_super_administrator
from app.services import admin_administrator as administrator_module
from app.services.admin_administrator import AdminAdministratorService


def build_administrator(
    *,
    username: str,
    role: AdminRole,
    status: AdminStatus = AdminStatus.ACTIVE,
) -> Administrator:
    return Administrator(
        username=username,
        email=f"{username}@example.com",
        password_hash="stored-hash",
        first_name=username.title(),
        last_name="Administrator",
        role=role,
        status=status,
        is_password_change_required=False,
        failed_login_attempts=0,
    )


def test_super_administrator_dependency_rejects_other_roles() -> None:
    administrator = build_administrator(username="manager", role=AdminRole.ADMIN)
    with pytest.raises(AuthorizationError):
        require_super_administrator(administrator)


def test_create_account_requires_password_change(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        administrator_module, "hash_password", lambda value: f"hashed:{value}"
    )
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        service = AdminAdministratorService(session)
        response = service.create_account(
            AdminAccountCreateRequest(
                username="New.Manager",
                email="manager@example.com",
                first_name="New",
                last_name="Manager",
                role=AdminRole.ADMIN,
                temporary_password="temporary-password",
            )
        )
        account = session.get(Administrator, response.administrator.id)
        assert account is not None
        assert account.username == "new.manager"
        assert account.password_hash == "hashed:temporary-password"
        assert account.is_password_change_required is True


def test_cannot_disable_or_demote_own_super_admin_account() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        actor = build_administrator(username="owner", role=AdminRole.SUPER_ADMIN)
        session.add(actor)
        session.flush()
        service = AdminAdministratorService(session)
        with pytest.raises(ConflictError):
            service.update_account(
                actor.id,
                AdminAccountUpdateRequest(status=AdminStatus.DISABLED),
                actor,
            )
        with pytest.raises(ConflictError):
            service.update_account(
                actor.id,
                AdminAccountUpdateRequest(role=AdminRole.ADMIN),
                actor,
            )


def test_last_active_super_admin_is_protected() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        actor = build_administrator(username="owner", role=AdminRole.SUPER_ADMIN)
        target = build_administrator(username="second", role=AdminRole.SUPER_ADMIN)
        session.add_all([actor, target])
        session.flush()
        actor.status = AdminStatus.DISABLED
        session.flush()
        with pytest.raises(ConflictError):
            AdminAdministratorService(session).update_account(
                target.id,
                AdminAccountUpdateRequest(role=AdminRole.VIEWER),
                actor,
            )


def test_password_reset_invalidates_sessions_and_requires_change(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        administrator_module, "hash_password", lambda value: f"hashed:{value}"
    )
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        actor = build_administrator(username="owner", role=AdminRole.SUPER_ADMIN)
        target = build_administrator(username="manager", role=AdminRole.ADMIN)
        target.failed_login_attempts = 4
        session.add_all([actor, target])
        session.flush()
        response = AdminAdministratorService(session).reset_password(
            target.id,
            AdminAccountPasswordResetRequest(
                temporary_password="replacement-password"
            ),
            actor,
        )
        assert target.password_hash == "hashed:replacement-password"
        assert target.is_password_change_required is True
        assert target.password_changed_at is not None
        assert target.failed_login_attempts == 0
        assert response.administrator.id == target.id
