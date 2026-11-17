from typing import Any

from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin


class WeddingPlanner(Base, TimestampMixin):
    __tablename__ = "wedding_planner"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    revision: Mapped[int] = mapped_column(nullable=False)
    document: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True
    )
