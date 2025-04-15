import os
import sys
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID

# Check for environment
is_production = os.environ.get("ENVIRONMENT") == "production"
if is_production:
    print("WARNING: This script should NOT be run in production!")
    response = input("Are you sure you want to continue? This will DESTROY ALL DATA! (yes/no): ")
    if response.lower() != "yes":
        print("Operation cancelled.")
        sys.exit(1)
    print("CAUTION: Proceeding with database reset in PRODUCTION environment!")

# Get database URL
database_url = os.environ.get(
    "DATABASE_URL", "postgresql://toban_admin:postgres@postgres/tobancv"
)

# Create engine and metadata
engine = create_engine(database_url)
metadata = MetaData()

# Drop existing enum types
drop_enums_sql = """
-- Drop schema and recreate it
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO toban_admin;
GRANT ALL ON SCHEMA public TO public;

-- Drop enum types if they exist
DROP TYPE IF EXISTS integrationtype CASCADE;
DROP TYPE IF EXISTS integrationstatus CASCADE;
DROP TYPE IF EXISTS sharelevel CASCADE;
DROP TYPE IF EXISTS accesslevel CASCADE;
"""

# Execute drop schema and enum types SQL
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
    "read", "write", "admin", name="accesslevel", create_type=True, metadata=metadata
)

# Team table
team_table = Table(
    "team",
    metadata,
    Column("id", UUID, primary_key=True),
    Column("name", String(255), nullable=False),
    Column("slug", String(255), nullable=False, unique=True),
    Column("description", String(1000)),
    Column("created_by_user_id", UUID, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("is_active", Boolean, nullable=False, server_default="true"),
)

# Integration table
integration_table = Table(
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
        "owner_team_id", UUID, ForeignKey("team.id", ondelete="CASCADE"), nullable=False
    ),
    Column("created_by_user_id", UUID, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("is_active", Boolean, nullable=False, server_default="true"),
)

# Integration Credential table
credential_table = Table(
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
share_table = Table(
    "integration_share",
    metadata,
    Column("id", UUID, primary_key=True),
    Column(
        "integration_id",
        UUID,
        ForeignKey("integration.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("team_id", UUID, ForeignKey("team.id", ondelete="CASCADE"), nullable=False),
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
resource_table = Table(
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
access_table = Table(
    "resource_access",
    metadata,
    Column("id", UUID, primary_key=True),
    Column(
        "resource_id",
        UUID,
        ForeignKey("service_resource.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("team_id", UUID, ForeignKey("team.id", ondelete="CASCADE"), nullable=False),
    Column("access_level", access_level, nullable=False),
    Column("granted_by_user_id", UUID, nullable=False),
    Column("revoked_by_user_id", UUID),
    Column("revoked_at", DateTime),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("is_active", Boolean, nullable=False, server_default="true"),
)

# Create all tables
print("Creating database tables...")
metadata.create_all(engine)
print("Database tables created successfully!")

# Insert test data
test_team_id = "2eef945e-9596-4f8c-8cd0-761698121912"
test_user_id = "98765432-1234-5678-9012-345678901234"
now = datetime.utcnow()

with engine.connect() as conn:
    # Insert test team
    conn.execute(
        team_table.insert().values(
            id=test_team_id,
            name="Test Team",
            slug="test-team",
            description="A test team for development",
            created_by_user_id=test_user_id,
            created_at=now,
            updated_at=now,
            is_active=True,
        )
    )
    conn.commit()

print(f"Test team created with ID: {test_team_id}")
