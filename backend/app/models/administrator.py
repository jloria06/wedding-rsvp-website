from datetime import datetime

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.enums import AdminRole, AdminStatus
from app.models.mixins import SoftDeleteMixin, TimestampMixin


class Administrator(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "administrators"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    username: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    role: Mapped[AdminRole] = mapped_column(
        Enum(
            AdminRole,
            name="admin_role",
            native_enum=False,
            length=32,
        ),
        default=AdminRole.ADMIN,
        nullable=False,
        index=True,
    )

    status: Mapped[AdminStatus] = mapped_column(
        Enum(
            AdminStatus,
            name="admin_status",
            native_enum=False,
            length=32,
        ),
        default=AdminStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    is_password_change_required: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    failed_login_attempts: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    locked_until: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    password_changed_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name.strip()} {self.last_name.strip()}"

    @property
    def is_active(self) -> bool:
        return self.status == AdminStatus.ACTIVE and not self.is_deleted
