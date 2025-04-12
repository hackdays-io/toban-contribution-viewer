#!/bin/bash
# Script to reset thread data in the database

echo "Resetting thread data..."
cd $(dirname "$0")/../..

# Run the SQL script to reset thread data
docker compose exec -T postgres psql -U toban_admin -d tobancv -f /scripts/reset_thread_data.sql

echo "Thread data reset complete."
echo ""
echo "Now use the 'Sync Threads' button in the UI for each channel to fetch thread replies from Slack API."
echo "This will populate the thread replies based on the corrected thread parent flags."