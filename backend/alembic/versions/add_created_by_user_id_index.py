"""Add index to team.created_by_user_id.

Revision ID: add_created_by_user_id_index
Revises: fix_created_by_user_id_type
Create Date: 2025-04-16 10:25:00.000000

This migration adds an index to the created_by_user_id column in the team table
to improve performance when querying for teams by user.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_created_by_user_id_index"
down_revision = "fix_created_by_user_id_type"
branch_labels = None
depends_on = None


def upgrade():
    """Add index to created_by_user_id column."""
    # Check if index already exists
    conn = op.get_bind()

    # Check for existing index
    index_exists_query = """
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'team' AND indexname = 'ix_team_created_by_user_id'
    """
    result = conn.execute(sa.text(index_exists_query))
    index_exists = result.scalar() is not None

    if not index_exists:
        # Create index on created_by_user_id for faster lookups
        op.create_index("ix_team_created_by_user_id", "team", ["created_by_user_id"])
        print("Created index on team.created_by_user_id")
    else:
        print("Index on team.created_by_user_id already exists")


def downgrade():
    """Remove index from created_by_user_id column."""
    # Check if index exists before dropping
    conn = op.get_bind()

    # Check for existing index
    index_exists_query = """
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'team' AND indexname = 'ix_team_created_by_user_id'
    """
    result = conn.execute(sa.text(index_exists_query))
    index_exists = result.scalar() is not None

    if index_exists:
        op.drop_index("ix_team_created_by_user_id", table_name="team")
        print("Dropped index from team.created_by_user_id")
    else:
        print("Index on team.created_by_user_id does not exist")
