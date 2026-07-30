from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import (
    AttendanceType,
    MealPreference,
    RSVPStatus,
)
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.companion import Companion
    from app.models.guest import Guest


class RSVP(Base, TimestampMixin):
    __tablename__ = "rsvps"
    __table_args__ = (
        CheckConstraint(
            "companion_count >= 0",
            name="ck_rsvps_companion_count_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    guest_id: Mapped[int] = mapped_column(
        ForeignKey(
            "guests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    status: Mapped[RSVPStatus] = mapped_column(
        Enum(
            RSVPStatus,
            name="rsvp_status",
            native_enum=False,
            length=32,
        ),
        default=RSVPStatus.PENDING,
        nullable=False,
        index=True,
    )

    attendance_type: Mapped[AttendanceType | None] = mapped_column(
        Enum(
            AttendanceType,
            name="attendance_type",
            native_enum=False,
            length=40,
        ),
        nullable=True,
    )

    companion_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    meal_preference: Mapped[MealPreference | None] = mapped_column(
        Enum(
            MealPreference,
            name="meal_preference",
            native_enum=False,
            length=32,
        ),
        nullable=True,
    )

    dietary_restrictions: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    guest_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    guest: Mapped[Guest] = relationship(
        back_populates="rsvp",
    )

    companions: Mapped[list[Companion]] = relationship(
        back_populates="rsvp",
        cascade="all, delete-orphan",
        order_by="Companion.id",
    )
