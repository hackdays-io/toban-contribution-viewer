"""remove_workspace_analysis_tables

Revision ID: remove_workspace_analysis
Revises: ea5ebf7c670a
Create Date: 2025-04-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'remove_workspace_analysis'
down_revision = 'ea5ebf7c670a'  # Make sure this matches your latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop tables in the correct order (respecting foreign key constraints)
    
    # First drop the many-to-many join table
    op.drop_table('analysis_channels')
    
    # Then drop dependent tables
    op.drop_table('slackcontribution')
    op.drop_table('slackchannelanalysis')
    
    # Finally drop the parent table
    op.drop_table('slackanalysis')


def downgrade() -> None:
    # This is a one-way migration; we're not supporting downgrade.
    # If needed, the downgrade function would need to recreate all tables.
    # To do that, you'd have to copy the table definitions from the create_all_tables migration.
    pass