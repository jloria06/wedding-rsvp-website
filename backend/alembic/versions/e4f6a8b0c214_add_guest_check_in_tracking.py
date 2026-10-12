"""add guest check-in tracking

Revision ID: e4f6a8b0c214
Revises: c8d2e4f6a713
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "e4f6a8b0c214"
down_revision: str | Sequence[str] | None = "c8d2e4f6a713"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("guests", sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_guests_checked_in_at", "guests", ["checked_in_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_guests_checked_in_at", table_name="guests")
    op.drop_column("guests", "checked_in_at")
