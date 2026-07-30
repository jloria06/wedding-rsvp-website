from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import MealPreference
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.rsvp import RSVP


class Companion(Base, TimestampMixin):
    __tablename__ = "companions"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    rsvp_id: Mapped[int] = mapped_column(
        ForeignKey(
            "rsvps.id",
            ondelete="CASCADE",
        ),
        nullable=False,
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

    meal_preference: Mapped[MealPreference | None] = mapped_column(
        Enum(
            MealPreference,
            name="companion_meal_preference",
            native_enum=False,
            length=32,
        ),
        nullable=True,
    )

    dietary_restrictions: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    rsvp: Mapped[RSVP] = relationship(
        back_populates="companions",
    )

    @property
    def full_name(self) -> str:
        name_parts = [
            self.first_name,
            self.middle_name,
            self.last_name,
        ]

        return " ".join(part.strip() for part in name_parts if part and part.strip())
