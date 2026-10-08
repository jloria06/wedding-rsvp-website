from sqlalchemy import ForeignKey, LargeBinary, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.mixins import TimestampMixin


class MediaAsset(Base, TimestampMixin):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    data: Mapped[bytes] = mapped_column(
        LargeBinary().with_variant(mysql.LONGBLOB, "mysql"), nullable=False
    )
    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True
    )
