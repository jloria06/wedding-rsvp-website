from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ResourceNotFoundError
from app.models import Administrator, AdminRole, AdminStatus
from app.schemas.admin_administrator import (
    AdminAccountCreateRequest,
    AdminAccountItem,
    AdminAccountListResponse,
    AdminAccountMutationResponse,
    AdminAccountPasswordResetRequest,
    AdminAccountUpdateRequest,
)
from app.security.passwords import hash_password


class AdminAdministratorService:
    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def list_accounts(self) -> AdminAccountListResponse:
        records = self.database_session.scalars(
            select(Administrator)
            .where(Administrator.deleted_at.is_(None))
            .order_by(Administrator.first_name, Administrator.last_name)
        ).all()
        return AdminAccountListResponse(
            administrators=[self._build_item(record) for record in records],
            total=len(records),
        )

    def create_account(
        self, request: AdminAccountCreateRequest
    ) -> AdminAccountMutationResponse:
        username = request.username.strip().lower()
        email = str(request.email).strip().lower()
        self._ensure_identity_available(username=username, email=email)
        administrator = Administrator(
            username=username,
            email=email,
            password_hash=hash_password(request.temporary_password),
            first_name=request.first_name.strip(),
            last_name=request.last_name.strip(),
            role=request.role,
            status=AdminStatus.ACTIVE,
            is_password_change_required=True,
            failed_login_attempts=0,
        )
        self.database_session.add(administrator)
        self.database_session.flush()
        return AdminAccountMutationResponse(
            message="Administrator account created successfully.",
            administrator=self._build_item(administrator),
        )

    def update_account(
        self,
        administrator_id: int,
        request: AdminAccountUpdateRequest,
        actor: Administrator,
    ) -> AdminAccountMutationResponse:
        administrator = self._get_account(administrator_id)
        next_role = request.role or administrator.role
        next_status = request.status or administrator.status
        if administrator.id == actor.id and (
            next_role != AdminRole.SUPER_ADMIN or next_status != AdminStatus.ACTIVE
        ):
            raise ConflictError(
                "You cannot remove your own Super Admin access or disable your account."
            )
        if (
            administrator.role == AdminRole.SUPER_ADMIN
            and administrator.status == AdminStatus.ACTIVE
            and (
                next_role != AdminRole.SUPER_ADMIN
                or next_status != AdminStatus.ACTIVE
            )
            and self._active_super_administrator_count() <= 1
        ):
            raise ConflictError("At least one active Super Admin account is required.")
        if request.email is not None:
            email = str(request.email).strip().lower()
            self._ensure_identity_available(
                username=administrator.username,
                email=email,
                exclude_id=administrator.id,
            )
            administrator.email = email
        if request.first_name is not None:
            administrator.first_name = request.first_name.strip()
        if request.last_name is not None:
            administrator.last_name = request.last_name.strip()
        if request.role is not None:
            administrator.role = request.role
        if request.status is not None:
            administrator.status = request.status
            if request.status == AdminStatus.ACTIVE:
                administrator.failed_login_attempts = 0
                administrator.locked_until = None
        self.database_session.flush()
        return AdminAccountMutationResponse(
            message="Administrator account updated successfully.",
            administrator=self._build_item(administrator),
        )

    def reset_password(
        self,
        administrator_id: int,
        request: AdminAccountPasswordResetRequest,
        actor: Administrator,
    ) -> AdminAccountMutationResponse:
        administrator = self._get_account(administrator_id)
        if administrator.id == actor.id:
            raise ConflictError(
                "Use Change Password to update your own administrator password."
            )
        administrator.password_hash = hash_password(request.temporary_password)
        administrator.is_password_change_required = True
        administrator.password_changed_at = datetime.now(UTC)
        administrator.failed_login_attempts = 0
        administrator.locked_until = None
        self.database_session.flush()
        return AdminAccountMutationResponse(
            message=(
                "Temporary password saved. "
                "The administrator must change it at login."
            ),
            administrator=self._build_item(administrator),
        )

    def _get_account(self, administrator_id: int) -> Administrator:
        administrator = self.database_session.scalar(
            select(Administrator).where(
                Administrator.id == administrator_id,
                Administrator.deleted_at.is_(None),
            )
        )
        if administrator is None:
            raise ResourceNotFoundError("Administrator account was not found.")
        return administrator

    def _ensure_identity_available(
        self, *, username: str, email: str, exclude_id: int | None = None
    ) -> None:
        statement = select(Administrator.id).where(
            or_(Administrator.username == username, Administrator.email == email)
        )
        if exclude_id is not None:
            statement = statement.where(Administrator.id != exclude_id)
        if self.database_session.scalar(statement) is not None:
            raise ConflictError("That username or email address is already in use.")

    def _active_super_administrator_count(self) -> int:
        return self.database_session.scalar(
            select(func.count(Administrator.id)).where(
                Administrator.role == AdminRole.SUPER_ADMIN,
                Administrator.status == AdminStatus.ACTIVE,
                Administrator.deleted_at.is_(None),
            )
        ) or 0

    @staticmethod
    def _build_item(administrator: Administrator) -> AdminAccountItem:
        return AdminAccountItem(
            id=administrator.id,
            username=administrator.username,
            email=administrator.email,
            first_name=administrator.first_name,
            last_name=administrator.last_name,
            full_name=administrator.full_name,
            role=administrator.role,
            status=administrator.status,
            is_password_change_required=administrator.is_password_change_required,
            failed_login_attempts=administrator.failed_login_attempts,
            locked_until=administrator.locked_until,
            last_login_at=administrator.last_login_at,
            created_at=administrator.created_at,
        )
