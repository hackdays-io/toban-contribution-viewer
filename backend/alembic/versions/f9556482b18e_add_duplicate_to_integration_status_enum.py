"""add_duplicate_to_integration_status_enum

Revision ID: f9556482b18e
Revises: c58a0d02ffa0
Create Date: 2025-04-18 14:56:27.237634

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "f9556482b18e"
down_revision = "92a14bdd5511"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # We decided not to add the 'duplicate' value to the enum since we're deleting duplicates instead
    pass


def downgrade() -> None:
    pass
