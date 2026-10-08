from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin


class WeddingContent(Base, TimestampMixin):
    __tablename__ = "wedding_content"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    content: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"),
        nullable=True,
    )
