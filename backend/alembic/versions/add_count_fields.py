"""Add count fields to ResourceAnalysis model

Revision ID: add_count_fields
Revises: remove_workspace_analysis_tables
Create Date: 2025-04-27 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_count_fields'
down_revision = 'remove_workspace_analysis_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Add the count fields to the ResourceAnalysis table
    op.add_column('resourceanalysis', sa.Column('message_count', sa.Integer(), nullable=True))
    op.add_column('resourceanalysis', sa.Column('participant_count', sa.Integer(), nullable=True))
    op.add_column('resourceanalysis', sa.Column('thread_count', sa.Integer(), nullable=True))
    op.add_column('resourceanalysis', sa.Column('reaction_count', sa.Integer(), nullable=True))


def downgrade():
    # Remove the count fields from the ResourceAnalysis table
    op.drop_column('resourceanalysis', 'message_count')
    op.drop_column('resourceanalysis', 'participant_count')
    op.drop_column('resourceanalysis', 'thread_count')
    op.drop_column('resourceanalysis', 'reaction_count')