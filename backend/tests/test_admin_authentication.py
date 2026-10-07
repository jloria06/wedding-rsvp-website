from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import pytest

from app.core import get_settings
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.models import Administrator, AdminRole, AdminStatus
from app.schemas import (
    AdministratorLoginRequest,
    AdministratorPasswordChangeRequest,
)
from app.security.admin_context import (
    require_dashboard_administrator,
    require_guest_manager,
)
from app.services import administrator_authentication as authentication_module
from app.services.administrator_authentication import (
    AdministratorAuthenticationService,
)


def build_administrator(
    *,
    role: AdminRole = AdminRole.ADMIN,
    password_change_required: bool = False,
) -> Administrator:
    return Administrator(
        id=1,
        username="admin",
        email="admin@example.com",
        password_hash="stored-password-hash",
        first_name="Wedding",
        last_name="Admin",
        role=role,
        status=AdminStatus.ACTIVE,
        is_password_change_required=password_change_required,
        failed_login_attempts=0,
        locked_until=None,
        last_login_at=None,
        password_changed_at=None,
        deleted_at=None,
    )


def build_service(administrator: Administrator) -> tuple[
    AdministratorAuthenticationService,
    Mock,
]:
    session = Mock()
    service = AdministratorAuthenticationService(session)
    service.administrator_repository.get_by_login = Mock(
        return_value=administrator,
    )
    return service, session


def test_failed_login_sets_temporary_lockout(monkeypatch: pytest.MonkeyPatch) -> None:
    administrator = build_administrator()
    administrator.failed_login_attempts = (
        get_settings().admin_max_failed_login_attempts - 1
    )
    service, session = build_service(administrator)
    monkeypatch.setattr(authentication_module, "verify_password", lambda *_: False)

    with pytest.raises(AuthenticationError):
        service.authenticate(
            AdministratorLoginRequest(username="admin", password="incorrect"),
        )

    assert administrator.failed_login_attempts == (
        get_settings().admin_max_failed_login_attempts
    )
    assert administrator.locked_until is not None
    assert administrator.locked_until > datetime.now(UTC)
    session.flush.assert_called_once()


def test_successful_login_clears_expired_lock_and_records_login(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    administrator = build_administrator()
    administrator.failed_login_attempts = 4
    administrator.locked_until = datetime.now(UTC) - timedelta(minutes=1)
    service, _ = build_service(administrator)
    monkeypatch.setattr(authentication_module, "verify_password", lambda *_: True)
    monkeypatch.setattr(
        authentication_module,
        "create_access_token",
        lambda *_: "signed-token",
    )

    response = service.authenticate(
        AdministratorLoginRequest(username="admin", password="correct-password"),
    )

    assert response.access_token == "signed-token"
    assert administrator.failed_login_attempts == 0
    assert administrator.locked_until is None
    assert administrator.last_login_at is not None


def test_required_password_change_blocks_dashboard_access() -> None:
    administrator = build_administrator(password_change_required=True)

    with pytest.raises(AuthorizationError):
        require_dashboard_administrator(administrator)


def test_viewer_cannot_modify_guests() -> None:
    administrator = build_administrator(role=AdminRole.VIEWER)

    with pytest.raises(AuthorizationError):
        require_guest_manager(administrator)


def test_password_change_updates_security_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    administrator = build_administrator(password_change_required=True)
    service, session = build_service(administrator)
    monkeypatch.setattr(
        authentication_module,
        "verify_password",
        lambda candidate, _stored: candidate == "current-password",
    )
    monkeypatch.setattr(
        authentication_module,
        "hash_password",
        lambda password: f"hashed:{password}",
    )

    service.change_password(
        administrator,
        AdministratorPasswordChangeRequest(
            current_password="current-password",
            new_password="new-secure-password",
        ),
    )

    assert administrator.password_hash == "hashed:new-secure-password"
    assert administrator.is_password_change_required is False
    assert administrator.password_changed_at is not None
    session.flush.assert_called_once()
