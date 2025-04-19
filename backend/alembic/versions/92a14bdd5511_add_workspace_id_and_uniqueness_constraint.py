"""add_workspace_id_and_uniqueness_constraint

Revision ID: 92a14bdd5511
Revises: 23372f1dd158
Create Date: 2025-04-18 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "92a14bdd5511"
down_revision = "23372f1dd158"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workspace_id column to integration table
    op.add_column(
        "integration", sa.Column("workspace_id", sa.String(length=255), nullable=True)
    )

    # Drop any existing integrations to ensure clean state (as we don't need to migrate data)
    op.execute("DELETE FROM integration")

    # Update the workspace_id column based on metadata for any remaining records
    # Note: We need to use the exact enum value as stored in the database
    # Since the integration table is empty, this is not actually needed
    # but we'll keep it as a comment for reference
    """
    UPDATE integration 
    SET workspace_id = integration_metadata->>'slack_id'
    WHERE service_type::text = 'slack' AND integration_metadata->>'slack_id' IS NOT NULL
    """

    # Create a unique index for (owner_team_id, workspace_id, service_type)
    # We include service_type to allow different service types to have the same workspace_id
    op.create_index(
        "ix_integration_owner_team_id_workspace_id_service_type",
        "integration",
        ["owner_team_id", "workspace_id", "service_type"],
        unique=True,
        postgresql_where=sa.text(
            "workspace_id IS NOT NULL"
        ),  # Only enforce uniqueness when workspace_id is not null
    )


def downgrade() -> None:
    # Drop the unique index first
    op.drop_index(
        "ix_integration_owner_team_id_workspace_id_service_type",
        table_name="integration",
    )

    # Then drop the workspace_id column
    op.drop_column("integration", "workspace_id")
