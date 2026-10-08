"""add seating management

Revision ID: f3a8c2e5b711
Revises: e2f7c9d4a310
Create Date: 2026-10-08 20:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f3a8c2e5b711"
down_revision: str | Sequence[str] | None = "e2f7c9d4a310"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "seating_tables",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("capacity > 0", name="ck_seating_tables_capacity_positive"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "seat_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("guest_id", sa.Integer(), nullable=False),
        sa.Column("assigned_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["administrators.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["guest_id"], ["guests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["table_id"], ["seating_tables.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guest_id"),
    )
    op.create_index("ix_seat_assignments_guest_id", "seat_assignments", ["guest_id"])
    op.create_index("ix_seat_assignments_table_id", "seat_assignments", ["table_id"])


def downgrade() -> None:
    op.drop_index("ix_seat_assignments_table_id", table_name="seat_assignments")
    op.drop_index("ix_seat_assignments_guest_id", table_name="seat_assignments")
    op.drop_table("seat_assignments")
    op.drop_table("seating_tables")
