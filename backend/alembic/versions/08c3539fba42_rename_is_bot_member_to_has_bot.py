"""rename_is_bot_member_to_has_bot

Revision ID: 08c3539fba42
Revises: adb9483e72f1
Create Date: 2025-04-21 23:37:43.499045

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '08c3539fba42'
down_revision = 'adb9483e72f1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Rename is_bot_member column to has_bot for clarity and consistency with frontend naming
    """
    op.alter_column('slackchannel', 'is_bot_member', new_column_name='has_bot')


def downgrade() -> None:
    """
    Rename has_bot column back to is_bot_member for rollback
    """
    op.alter_column('slackchannel', 'has_bot', new_column_name='is_bot_member')
