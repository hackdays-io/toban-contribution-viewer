"""migrate_slack_ids_to_workspace_id

Revision ID: c58a0d02ffa0
Revises: 92a14bdd5511
Create Date: 2025-04-18 14:53:48.369293

This migration adds the 'duplicate' value to the IntegrationStatus enum
and migrates the slack_id values from metadata to the workspace_id column.
"""

import json
import uuid
from typing import Dict, List, Set, Tuple

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import column, table

from alembic import op

# revision identifiers, used by Alembic.
revision = "c58a0d02ffa0"
down_revision = "f9556482b18e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Define a minimal model of the Integration table for use in our migration
    integration_table = table(
        "integration",
        column("id", UUID),
        column("owner_team_id", UUID),
        column("workspace_id", sa.String),
        column("service_type", sa.String),
        column("integration_metadata", JSONB),
        column("created_at", sa.DateTime),
        column("status", sa.String),
    )

    # First update one integration with workspace_id to establish ownership
    op.execute(
        """
    WITH first_per_workspace AS (
        SELECT 
            id,
            owner_team_id,
            integration_metadata->>'slack_id' as slack_id,
            ROW_NUMBER() OVER (
                PARTITION BY owner_team_id, integration_metadata->>'slack_id'
                ORDER BY created_at DESC
            ) as rn
        FROM integration
        WHERE service_type = 'SLACK' 
          AND workspace_id IS NULL 
          AND integration_metadata->>'slack_id' IS NOT NULL
    )
    UPDATE integration
    SET workspace_id = first_per_workspace.slack_id
    FROM first_per_workspace
    WHERE integration.id = first_per_workspace.id 
      AND first_per_workspace.rn = 1;
    """
    )

    # Identify and delete duplicate integrations (secondary copies)
    op.execute(
        """
    DELETE FROM integration
    WHERE id IN (
        SELECT i.id
        FROM integration i
        JOIN integration primary_i ON
            i.owner_team_id = primary_i.owner_team_id AND
            i.integration_metadata->>'slack_id' = primary_i.workspace_id AND
            i.service_type = primary_i.service_type AND
            i.id != primary_i.id
        WHERE 
            i.service_type = 'SLACK' AND
            i.workspace_id IS NULL AND
            i.integration_metadata->>'slack_id' IS NOT NULL
    );
    """
    )

    # Finally update any remaining integrations with workspace_id
    op.execute(
        """
    UPDATE integration
    SET workspace_id = integration_metadata->>'slack_id'
    WHERE service_type = 'SLACK' 
      AND workspace_id IS NULL 
      AND integration_metadata->>'slack_id' IS NOT NULL;
    """
    )


def downgrade() -> None:
    # Note: We don't restore duplicates or remove workspace_id values in downgrade
    # as that would be destructive and potentially create data conflicts
    pass
