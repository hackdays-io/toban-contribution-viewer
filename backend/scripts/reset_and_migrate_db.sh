#!/bin/bash
# Script to reset the database and run migrations

echo "Step 1: Dropping all database tables..."
docker exec -i tobancv-postgres psql -U toban_admin -d tobancv < "$(dirname "$0")/reset_database.sql"
if [ $? -eq 0 ]; then
  echo "✅ Database tables dropped successfully"
else
  echo "❌ Failed to drop database tables"
  exit 1
fi

echo "Step 2: Running Alembic migrations to create tables..."
docker exec tobancv-backend alembic upgrade head
if [ $? -eq 0 ]; then
  echo "✅ Database migrations completed successfully"
else
  echo "❌ Database migrations failed"
  exit 1
fi

echo "Step 3: Database reset and migration complete!"
echo "The database has been reset with the new schema without legacy workspace-specific analysis tables."