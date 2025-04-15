import os

from sqlalchemy import create_engine, text

# Get database URL from environment, or use a default for development
database_url = os.environ.get(
    "DATABASE_URL", "postgresql://toban_admin:postgres@postgres/tobancv"
)

# Create engine
engine = create_engine(database_url)

# SQL commands to reset the database
reset_sql = """
-- Drop the schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO toban_admin;
GRANT ALL ON SCHEMA public TO public;

-- Explicitly drop any enum types that might exist
DROP TYPE IF EXISTS integrationtype;
DROP TYPE IF EXISTS integrationstatus;
DROP TYPE IF EXISTS sharelevel;
DROP TYPE IF EXISTS accesslevel;
"""

# Execute the SQL
with engine.connect() as conn:
    conn.execute(text(reset_sql))
    conn.commit()

print("Database schema and enum types have been reset.")
