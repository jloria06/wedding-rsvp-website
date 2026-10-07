from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core import get_settings
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.models import Administrator, AdminStatus
from app.repositories import AdministratorRepository
from app.schemas import (
    AdministratorLoginRequest,
    AdministratorLoginResponse,
    AdministratorPasswordChangeRequest,
    AdministratorPasswordChangeResponse,
)
from app.security import hash_password, verify_password
from app.security.tokens import create_access_token

settings = get_settings()


class AdministratorAuthenticationService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session
        self.administrator_repository = AdministratorRepository(database_session)

    def authenticate(
        self,
        request: AdministratorLoginRequest,
    ) -> AdministratorLoginResponse:
        administrator = self.administrator_repository.get_by_login(request.username)

        if administrator is None:
            raise AuthenticationError(
                "Invalid administrator credentials.",
            )

        if not administrator.is_active:
            raise AuthorizationError(
                "This administrator account is disabled.",
            )

        now = datetime.now(UTC)

        if administrator.locked_until is not None:
            locked_until = administrator.locked_until

            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=UTC)

            if locked_until > now:
                raise AuthorizationError(
                    "This administrator account is temporarily locked. "
                    "Try again later.",
                )

            administrator.locked_until = None
            administrator.failed_login_attempts = 0

        if not verify_password(
            request.password,
            administrator.password_hash,
        ):
            administrator.failed_login_attempts += 1

            if (
                administrator.failed_login_attempts
                >= settings.admin_max_failed_login_attempts
            ):
                administrator.locked_until = now + timedelta(
                    minutes=settings.admin_lockout_minutes,
                )

            self.database_session.flush()

            raise AuthenticationError(
                "Invalid administrator credentials.",
            )

        administrator.failed_login_attempts = 0
        administrator.locked_until = None
        administrator.last_login_at = now
        self.database_session.flush()

        access_token = create_access_token(
            administrator.id,
            administrator.username,
            administrator.role.value,
            administrator.password_changed_at,
        )

        return AdministratorLoginResponse(
            message="Administrator authentication successful.",
            administrator_id=administrator.id,
            username=administrator.username,
            role=administrator.role.value,
            is_password_change_required=(administrator.is_password_change_required),
            access_token=access_token,
        )

    def change_password(
        self,
        administrator: Administrator,
        request: AdministratorPasswordChangeRequest,
    ) -> AdministratorPasswordChangeResponse:
        if administrator.status != AdminStatus.ACTIVE:
            raise AuthorizationError(
                "This administrator account is disabled.",
            )

        if not verify_password(
            request.current_password,
            administrator.password_hash,
        ):
            raise AuthorizationError(
                "Current password is incorrect.",
            )

        if verify_password(
            request.new_password,
            administrator.password_hash,
        ):
            raise AuthorizationError(
                "New password must be different from the current password.",
            )

        administrator.password_hash = hash_password(request.new_password)
        administrator.is_password_change_required = False
        administrator.failed_login_attempts = 0
        administrator.locked_until = None
        administrator.password_changed_at = datetime.now(UTC)

        self.database_session.flush()

        return AdministratorPasswordChangeResponse(
            message="Administrator password changed successfully.",
        )
