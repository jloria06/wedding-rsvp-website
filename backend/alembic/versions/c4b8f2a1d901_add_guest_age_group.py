"""add guest age group

Revision ID: c4b8f2a1d901
Revises: 7d55500d4ed8
Create Date: 2026-10-08 11:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4b8f2a1d901"
down_revision: str | Sequence[str] | None = "7d55500d4ed8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "guests",
        sa.Column(
            "age_group",
            sa.Enum(
                "ADULT",
                "CHILD",
                name="age_group",
                native_enum=False,
                length=16,
            ),
            server_default="ADULT",
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_guests_age_group"),
        "guests",
        ["age_group"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_guests_age_group"), table_name="guests")
    op.drop_column("guests", "age_group")
