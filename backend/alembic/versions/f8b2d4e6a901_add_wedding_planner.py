"""Add private, versioned wedding planner storage.

Revision ID: f8b2d4e6a901
Revises: f5a7b9c1d326
"""

import sqlalchemy as sa
from alembic import op

revision = "f8b2d4e6a901"
down_revision = "f5a7b9c1d326"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wedding_planner",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"], ["administrators.id"], ondelete="SET NULL"
        ),
    )


def downgrade() -> None:
    op.drop_table("wedding_planner")
