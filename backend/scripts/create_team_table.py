import os
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine
from sqlalchemy.dialects.postgresql import UUID

# Get database URL
database_url = os.environ.get(
    "DATABASE_URL", "postgresql://toban_admin:postgres@postgres/tobancv"
)

# Create engine and metadata
engine = create_engine(database_url)
metadata = MetaData()

# Team table
team = Table(
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

# Create team table
metadata.create_all(engine)
print("Team table created successfully!")

# Insert a test team record
test_team_id = "2eef945e-9596-4f8c-8cd0-761698121912"
test_user_id = "98765432-1234-5678-9012-345678901234"
now = datetime.utcnow()

with engine.connect() as conn:
    # Insert test team
    conn.execute(
        team.insert().values(
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
