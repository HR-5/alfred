"""add_integrations

Revision ID: a3b4c5d6e7f8
Revises: 017890fc5a03
Create Date: 2026-02-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = '017890fc5a03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Google Calendar auth table
    op.create_table(
        'google_calendar_auth',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=False),
        sa.Column('token_expiry', sa.DateTime(), nullable=True),
        sa.Column('calendar_id', sa.String(255), nullable=False, server_default='primary'),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Add new columns to calendar_blocks
    with op.batch_alter_table('calendar_blocks') as batch_op:
        batch_op.add_column(sa.Column('source', sa.String(50), nullable=False, server_default='alfred'))
        batch_op.add_column(sa.Column('external_id', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('title', sa.String(500), nullable=True))
        # Make task_id nullable (Google events may not have a task)
        batch_op.alter_column('task_id', existing_type=sa.String(36), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('calendar_blocks') as batch_op:
        batch_op.alter_column('task_id', existing_type=sa.String(36), nullable=False)
        batch_op.drop_column('title')
        batch_op.drop_column('external_id')
        batch_op.drop_column('source')

    op.drop_table('google_calendar_auth')
