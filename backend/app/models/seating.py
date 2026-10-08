from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.guest import Guest


class SeatingTable(Base, TimestampMixin):
    __tablename__ = "seating_tables"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="ck_seating_tables_capacity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    capacity: Mapped[int] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    assignments: Mapped[list[SeatAssignment]] = relationship(
        back_populates="table",
        cascade="all, delete-orphan",
        order_by="SeatAssignment.id",
    )


class SeatAssignment(Base, TimestampMixin):
    __tablename__ = "seat_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    table_id: Mapped[int] = mapped_column(
        ForeignKey("seating_tables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    guest_id: Mapped[int] = mapped_column(
        ForeignKey("guests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    assigned_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"),
        nullable=True,
    )

    table: Mapped[SeatingTable] = relationship(back_populates="assignments")
    guest: Mapped[Guest] = relationship(back_populates="seat_assignment")
