"""add invitation delivery tracking

Revision ID: b7c9d1e3f502
Revises: a6d4e8f9b201
Create Date: 2026-10-09 16:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b7c9d1e3f502"
down_revision: str | Sequence[str] | None = "a6d4e8f9b201"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guests",
        sa.Column("invitation_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_guests_invitation_sent_at",
        "guests",
        ["invitation_sent_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_guests_invitation_sent_at", table_name="guests")
    op.drop_column("guests", "invitation_sent_at")
