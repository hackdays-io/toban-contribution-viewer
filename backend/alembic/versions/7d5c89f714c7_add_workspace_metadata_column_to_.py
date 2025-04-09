"""Add workspace_metadata column to SlackWorkspace

Revision ID: 7d5c89f714c7
Revises: 001
Create Date: 2025-04-09 17:02:14.055875

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = '7d5c89f714c7'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workspace_metadata column to SlackWorkspace table
    op.add_column(
        'slackworkspace',
        sa.Column('workspace_metadata', sa.dialects.postgresql.JSONB(), nullable=True)
    )
    
    # Copy data from metadata column to workspace_metadata column
    op.execute(
        "UPDATE slackworkspace SET workspace_metadata = metadata"
    )


def downgrade() -> None:
    # Drop workspace_metadata column
    op.drop_column('slackworkspace', 'workspace_metadata')