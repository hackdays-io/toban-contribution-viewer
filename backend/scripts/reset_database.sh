#!/bin/bash
# Reset database by clearing all Slack-related tables

echo "Resetting database..."
docker exec -i tobancv-postgres psql -U toban_admin -d tobancv < "$(dirname "$0")/reset_database.sql"
echo "Database reset complete!"