"""add companion check-in count

Revision ID: f5a7b9c1d326
Revises: e4f6a8b0c214
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "f5a7b9c1d326"
down_revision: str | Sequence[str] | None = "e4f6a8b0c214"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guests",
        sa.Column("checked_in_companion_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("guests", "checked_in_companion_count")
