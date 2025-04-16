"""Fix created_by_user_id column type.

Revision ID: fix_created_by_user_id_type
Revises: add_missing_team_columns
Create Date: 2025-04-16 10:20:00.000000

This migration changes the created_by_user_id column type from UUID to VARCHAR
to match the SQLAlchemy model.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "fix_created_by_user_id_type"
down_revision = "add_missing_team_columns"
branch_labels = None
depends_on = None


def upgrade():
    """Change created_by_user_id column type from UUID to VARCHAR."""
    # First check the current type
    conn = op.get_bind()

    # Get column type
    column_type_query = """
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'team' AND column_name = 'created_by_user_id' AND table_schema = 'public'
    """
    result = conn.execute(sa.text(column_type_query))
    column_type = next(iter(result))[0] if result.rowcount > 0 else None

    if column_type == "uuid":
        print("Converting created_by_user_id from UUID to VARCHAR...")

        # Create a temporary column with the new type
        op.add_column(
            "team", sa.Column("created_by_user_id_new", sa.String(255), nullable=True)
        )

        # Copy data from old column to new column with type casting
        op.execute(
            sa.text("UPDATE team SET created_by_user_id_new = created_by_user_id::text")
        )

        # Drop the old column
        op.drop_column("team", "created_by_user_id")

        # Rename the new column to the original name
        op.alter_column(
            "team", "created_by_user_id_new", new_column_name="created_by_user_id"
        )

        # Make the column non-nullable
        op.alter_column("team", "created_by_user_id", nullable=False)

        print("Successfully converted created_by_user_id column type")
    else:
        print(
            f"Column created_by_user_id already has type {column_type}, no need to convert"
        )


def downgrade():
    """Change created_by_user_id column type back to UUID."""
    # First check the current type
    conn = op.get_bind()

    # Get column type
    column_type_query = """
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'team' AND column_name = 'created_by_user_id' AND table_schema = 'public'
    """
    result = conn.execute(sa.text(column_type_query))
    column_type = next(iter(result))[0] if result.rowcount > 0 else None

    if column_type != "uuid":
        print("Converting created_by_user_id from VARCHAR to UUID...")

        # Create a temporary column with the UUID type
        op.add_column(
            "team",
            sa.Column(
                "created_by_user_id_new", postgresql.UUID(as_uuid=True), nullable=True
            ),
        )

        # Copy data from old column to new column with type casting
        # This may fail if the string is not a valid UUID
        op.execute(
            sa.text("UPDATE team SET created_by_user_id_new = created_by_user_id::uuid")
        )

        # Drop the old column
        op.drop_column("team", "created_by_user_id")

        # Rename the new column to the original name
        op.alter_column(
            "team", "created_by_user_id_new", new_column_name="created_by_user_id"
        )

        # Make the column non-nullable
        op.alter_column("team", "created_by_user_id", nullable=False)

        print("Successfully converted created_by_user_id column type back to UUID")
    else:
        print("Column created_by_user_id already has type UUID, no need to convert")
