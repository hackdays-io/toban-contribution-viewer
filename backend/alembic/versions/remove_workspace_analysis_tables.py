"""remove_workspace_analysis_tables

Revision ID: remove_workspace_analysis
Revises: ea5ebf7c670a
Create Date: 2025-04-24 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "remove_workspace_analysis"
down_revision = "ea5ebf7c670a"  # Make sure this matches your latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This is a no-op migration now that we've removed these tables from the initial migration
    # The tables are already removed from the create_all_tables.py migration

    # Leaving this migration in place for version tracking purposes
    pass


def downgrade() -> None:
    # This is a one-way migration; we're not supporting downgrade.
    # If needed, the downgrade function would need to recreate all tables.
    # To do that, you'd have to copy the table definitions from the create_all_tables migration.
    pass
