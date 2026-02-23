"""block_notes_and_tagged_tasks

Revision ID: b4c5d6e7f8g9
Revises: a3b4c5d6e7f8
Create Date: 2026-02-23 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8g9'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Block notes table
    op.create_table(
        'block_notes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('block_id', sa.String(36), sa.ForeignKey('calendar_blocks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('source', sa.String(50), nullable=False, server_default='user'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Block tagged tasks junction table
    op.create_table(
        'block_tagged_tasks',
        sa.Column('block_id', sa.String(36), sa.ForeignKey('calendar_blocks.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table('block_tagged_tasks')
    op.drop_table('block_notes')
