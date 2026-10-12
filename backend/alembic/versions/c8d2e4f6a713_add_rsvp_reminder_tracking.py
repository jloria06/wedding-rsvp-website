"""add rsvp reminder tracking

Revision ID: c8d2e4f6a713
Revises: b7c9d1e3f502
Create Date: 2026-10-12 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c8d2e4f6a713"
down_revision: str | Sequence[str] | None = "b7c9d1e3f502"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guests",
        sa.Column(
            "last_rsvp_reminder_sent_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "guests",
        sa.Column(
            "rsvp_reminder_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_index(
        "ix_guests_last_rsvp_reminder_sent_at",
        "guests",
        ["last_rsvp_reminder_sent_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_guests_last_rsvp_reminder_sent_at",
        table_name="guests",
    )
    op.drop_column("guests", "rsvp_reminder_count")
    op.drop_column("guests", "last_rsvp_reminder_sent_at")
