"""Add missing columns to team table.

Revision ID: add_missing_team_columns
Revises: consolidated_schema
Create Date: 2025-04-16 10:15:00.000000

This migration adds missing columns to the team table to match
the SQLAlchemy model and fix errors with avatar_url field.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_missing_team_columns"
down_revision = "consolidated_schema"
branch_labels = None
depends_on = None


def upgrade():
    """Add missing columns to team table."""
    # Check if columns already exist to prevent errors
    conn = op.get_bind()

    # Get existing columns
    columns_query = """
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'team' AND table_schema = 'public'
    """
    result = conn.execute(sa.text(columns_query))
    existing_columns = {row[0] for row in result}

    # Add avatar_url column if it doesn't exist
    if "avatar_url" not in existing_columns:
        op.add_column("team", sa.Column("avatar_url", sa.String(1024), nullable=True))
        print("Added avatar_url column to team table")

    # Add team_size column if it doesn't exist
    if "team_size" not in existing_columns:
        op.add_column("team", sa.Column("team_size", sa.Integer(), nullable=True))
        # Update existing rows to have a default value of 0
        op.execute(sa.text("UPDATE team SET team_size = 0 WHERE team_size IS NULL"))
        # Make the column non-nullable after setting default values
        op.alter_column("team", "team_size", nullable=False, server_default="0")
        print("Added team_size column to team table")

    # Add is_personal column if it doesn't exist
    if "is_personal" not in existing_columns:
        op.add_column("team", sa.Column("is_personal", sa.Boolean(), nullable=True))
        # Update existing rows to have a default value of False
        op.execute(
            sa.text("UPDATE team SET is_personal = false WHERE is_personal IS NULL")
        )
        # Make the column non-nullable after setting default values
        op.alter_column("team", "is_personal", nullable=False, server_default="false")
        print("Added is_personal column to team table")

    # Add team_metadata column if it doesn't exist
    if "team_metadata" not in existing_columns:
        op.add_column(
            "team",
            sa.Column(
                "team_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True
            ),
        )
        print("Added team_metadata column to team table")

    # Add created_by_email column if it doesn't exist
    if "created_by_email" not in existing_columns:
        op.add_column(
            "team", sa.Column("created_by_email", sa.String(255), nullable=True)
        )
        print("Added created_by_email column to team table")

    # Fix data type of description column if needed
    description_type_query = """
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'team' AND column_name = 'description' AND table_schema = 'public'
    """
    result = conn.execute(sa.text(description_type_query))
    description_type = next(iter(result))[0] if result.rowcount > 0 else None

    if description_type == "character varying":
        # Create a temporary column with the new type
        op.add_column("team", sa.Column("description_new", sa.Text(), nullable=True))
        # Copy data from old column to new column
        op.execute(sa.text("UPDATE team SET description_new = description"))
        # Drop the old column
        op.drop_column("team", "description")
        # Rename the new column to the original name
        op.alter_column("team", "description_new", new_column_name="description")
        print("Changed description column from varchar to text")


def downgrade():
    """Remove added columns from team table."""
    # Check if columns exist before dropping
    conn = op.get_bind()

    # Get existing columns
    columns_query = """
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'team' AND table_schema = 'public'
    """
    result = conn.execute(sa.text(columns_query))
    existing_columns = {row[0] for row in result}

    # Drop columns if they exist
    if "avatar_url" in existing_columns:
        op.drop_column("team", "avatar_url")

    if "team_size" in existing_columns:
        op.drop_column("team", "team_size")

    if "is_personal" in existing_columns:
        op.drop_column("team", "is_personal")

    if "team_metadata" in existing_columns:
        op.drop_column("team", "team_metadata")

    if "created_by_email" in existing_columns:
        op.drop_column("team", "created_by_email")
