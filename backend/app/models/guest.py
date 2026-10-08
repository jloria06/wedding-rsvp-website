from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import AgeGroup, GuestStatus
from app.models.mixins import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.rsvp import RSVP


class Guest(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "guests"
    __table_args__ = (Index("ix_guests_full_name", "last_name", "first_name"),)

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    invitation_code: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    middle_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )

    household_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        index=True,
    )

    maximum_companions: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    age_group: Mapped[AgeGroup] = mapped_column(
        Enum(
            AgeGroup,
            name="age_group",
            native_enum=False,
            length=16,
        ),
        default=AgeGroup.ADULT,
        nullable=False,
        index=True,
    )

    is_primary_guest: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    status: Mapped[GuestStatus] = mapped_column(
        Enum(
            GuestStatus,
            name="guest_status",
            native_enum=False,
            length=32,
        ),
        default=GuestStatus.INVITED,
        nullable=False,
        index=True,
    )

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    rsvp: Mapped[RSVP | None] = relationship(
        back_populates="guest",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def full_name(self) -> str:
        name_parts = [
            self.first_name,
            self.middle_name,
            self.last_name,
        ]

        return " ".join(part.strip() for part in name_parts if part and part.strip())
