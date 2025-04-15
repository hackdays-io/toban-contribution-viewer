import os

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    MetaData,
    String,
    Table,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID

# Get database URL
database_url = os.environ.get(
    "DATABASE_URL", "postgresql://toban_admin:postgres@postgres/tobancv"
)

# Create engine and metadata
engine = create_engine(database_url)
metadata = MetaData()

# Drop existing enum types
drop_enums_sql = """
-- Drop enum types if they exist
DROP TYPE IF EXISTS integrationtype CASCADE;
DROP TYPE IF EXISTS integrationstatus CASCADE;
DROP TYPE IF EXISTS sharelevel CASCADE;
DROP TYPE IF EXISTS accesslevel CASCADE;
"""


# Create tables
def create_tables():
    print("Creating integration tables...")

    # Execute drop enum types SQL
    with engine.connect() as conn:
        conn.execute(text(drop_enums_sql))
        conn.commit()

    # Create enum types
    integration_type = ENUM(
        "slack",
        "github",
        "notion",
        "discord",
        name="integrationtype",
        create_type=True,
        metadata=metadata,
    )

    integration_status = ENUM(
        "active",
        "disconnected",
        "expired",
        "revoked",
        "error",
        name="integrationstatus",
        create_type=True,
        metadata=metadata,
    )

    share_level = ENUM(
        "full_access",
        "limited_access",
        "read_only",
        name="sharelevel",
        create_type=True,
        metadata=metadata,
    )

    access_level = ENUM(
        "read",
        "write",
        "admin",
        name="accesslevel",
        create_type=True,
        metadata=metadata,
    )

    # Integration table
    Table(
        "integration",
        metadata,
        Column("id", UUID, primary_key=True),
        Column("name", String(255), nullable=False),
        Column("description", String(1000)),
        Column("service_type", integration_type, nullable=False),
        Column("status", integration_status, nullable=False, server_default="active"),
        Column("integration_metadata", JSON),
        Column("last_used_at", DateTime),
        Column(
            "owner_team_id",
            UUID,
            ForeignKey("team.id", ondelete="CASCADE"),
            nullable=False,
        ),
        Column("created_by_user_id", UUID, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("is_active", Boolean, nullable=False, server_default="true"),
    )

    # Integration Credential table
    Table(
        "integration_credential",
        metadata,
        Column("id", UUID, primary_key=True),
        Column(
            "integration_id",
            UUID,
            ForeignKey("integration.id", ondelete="CASCADE"),
            nullable=False,
        ),
        Column("credential_type", String(50), nullable=False),
        Column("credential_data", JSON, nullable=False),
        Column("expires_at", DateTime),
        Column("scopes", JSON),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("is_active", Boolean, nullable=False, server_default="true"),
    )

    # Integration Share table
    Table(
        "integration_share",
        metadata,
        Column("id", UUID, primary_key=True),
        Column(
            "integration_id",
            UUID,
            ForeignKey("integration.id", ondelete="CASCADE"),
            nullable=False,
        ),
        Column(
            "team_id", UUID, ForeignKey("team.id", ondelete="CASCADE"), nullable=False
        ),
        Column("share_level", share_level, nullable=False),
        Column("status", String(50), nullable=False, server_default="active"),
        Column("shared_by_user_id", UUID, nullable=False),
        Column("revoked_by_user_id", UUID),
        Column("revoked_at", DateTime),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("is_active", Boolean, nullable=False, server_default="true"),
    )

    # Service Resource table
    Table(
        "service_resource",
        metadata,
        Column("id", UUID, primary_key=True),
        Column(
            "integration_id",
            UUID,
            ForeignKey("integration.id", ondelete="CASCADE"),
            nullable=False,
        ),
        Column("resource_type", String(50), nullable=False),
        Column("external_id", String(255), nullable=False),
        Column("name", String(255), nullable=False),
        Column("metadata", JSON),
        Column("last_synced_at", DateTime),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("is_active", Boolean, nullable=False, server_default="true"),
    )

    # Resource Access table
    Table(
        "resource_access",
        metadata,
        Column("id", UUID, primary_key=True),
        Column(
            "resource_id",
            UUID,
            ForeignKey("service_resource.id", ondelete="CASCADE"),
            nullable=False,
        ),
        Column(
            "team_id", UUID, ForeignKey("team.id", ondelete="CASCADE"), nullable=False
        ),
        Column("access_level", access_level, nullable=False),
        Column("granted_by_user_id", UUID, nullable=False),
        Column("revoked_by_user_id", UUID),
        Column("revoked_at", DateTime),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("is_active", Boolean, nullable=False, server_default="true"),
    )

    # Create all tables
    metadata.create_all(engine)
    print("Integration tables created successfully!")


if __name__ == "__main__":
    create_tables()
