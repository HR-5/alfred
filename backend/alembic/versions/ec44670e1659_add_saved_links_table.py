"""add saved_links table

Revision ID: ec44670e1659
Revises: e2fe7ac4dc8b
Create Date: 2026-03-01 23:03:23.249161

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec44670e1659'
down_revision: Union[str, None] = 'e2fe7ac4dc8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('saved_links',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('url', sa.String(length=2000), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('link_type', sa.Enum('ARTICLE', 'VIDEO', 'BOOK', 'PODCAST', 'OTHER', name='linktype'), nullable=False),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('saved_links')
