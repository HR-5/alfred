"""add_projects

Revision ID: e7f8g9h0i1j2
Revises: d6e7f8g9h0i1
Create Date: 2026-03-01 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8g9h0i1j2"
down_revision: Union[str, None] = "d6e7f8g9h0i1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from alembic import op as _op
    from sqlalchemy import inspect as _inspect
    from alembic.migration import MigrationContext  # noqa

    bind = op.get_bind()

    # Create projects table if it doesn't already exist
    inspector = _inspect(bind)
    if "projects" not in inspector.get_table_names():
        op.create_table(
            "projects",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("color", sa.String(20), nullable=False, server_default="#6366f1"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    # Add project_id column to tasks if missing
    task_cols = [c["name"] for c in inspector.get_columns("tasks")]
    if "project_id" not in task_cols:
        with op.batch_alter_table("tasks") as batch_op:
            batch_op.add_column(
                sa.Column("project_id", sa.String(36), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("project_id")
    op.drop_table("projects")
