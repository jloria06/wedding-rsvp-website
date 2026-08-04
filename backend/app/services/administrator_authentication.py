from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError
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
            raise AuthorizationError(
                "Invalid administrator credentials.",
            )

        if administrator.status != AdminStatus.ACTIVE:
            raise AuthorizationError(
                "This administrator account is disabled.",
            )

        if not verify_password(
            request.password,
            administrator.password_hash,
        ):
            administrator.failed_login_attempts += 1
            self.database_session.flush()

            raise AuthorizationError(
                "Invalid administrator credentials.",
            )

        administrator.failed_login_attempts = 0
        self.database_session.flush()

        access_token = create_access_token(
            administrator.id,
            administrator.username,
            administrator.role.value,
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

        self.database_session.flush()

        return AdministratorPasswordChangeResponse(
            message="Administrator password changed successfully.",
        )
