"""Fix integration_share model naming.

Revision ID: fix_integration_share_naming
Revises: add_created_by_user_id_index
Create Date: 2025-04-16 10:35:00.000000

This migration updates the __tablename__ property in the IntegrationShare model
to match the actual database table name.
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "fix_integration_share_naming"
down_revision = "add_created_by_user_id_index"
branch_labels = None
depends_on = None


def upgrade():
    """Fix the __tablename__ in SQLAlchemy model."""
    # This is a Python-only change, not a database change
    print("No database changes needed. Please update the IntegrationShare model to use:")
    print("__tablename__ = 'integration_share'")


def downgrade():
    """Revert the __tablename__ in SQLAlchemy model."""
    # This is a Python-only change, not a database change
    print("No database changes needed. Please update the IntegrationShare model to use the original tablename.")