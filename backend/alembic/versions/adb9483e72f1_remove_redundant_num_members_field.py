"""remove_redundant_num_members_field

Revision ID: adb9483e72f1
Revises: f9556482b18e
Create Date: 2025-04-21 12:30:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "adb9483e72f1"
down_revision = "c58a0d02ffa0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Remove the redundant 'num_members' field from the slackchannel table.
    The 'member_count' field is already being used as the source of truth.

    This migration is a no-op because the field was already removed or never existed.
    We're keeping this migration for documentation purposes and compatibility with
    other environments where the column might exist.
    """
    # No action needed - column doesn't exist in the database
    pass


def downgrade() -> None:
    """
    Restore the redundant 'num_members' field in case of rollback.
    This will be NULL for all records after restoration.

    Since the field doesn't exist in the current database, this is a no-op.
    """
    # No action needed for downgrade
    pass
