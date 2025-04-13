#!/bin/bash
# Script to reset thread data in the database

echo "Resetting thread data..."
cd $(dirname "$0")/../..

# Execute SQL commands directly
docker compose exec -T postgres psql -U toban_admin -d tobancv << EOF
-- Step 1: Delete all thread replies
DELETE FROM slackmessage
WHERE is_thread_reply = TRUE;

-- Step 2: Reset all thread parent flags
UPDATE slackmessage
SET is_thread_parent = FALSE
WHERE is_thread_parent = TRUE;

-- Step 3: Update thread parent flags with correct logic
UPDATE slackmessage
SET is_thread_parent = TRUE
WHERE reply_count > 0 
  AND (thread_ts = slack_ts OR thread_ts IS NULL);

-- Show stats after reset
SELECT 'Thread parent messages:' as info, COUNT(*) FROM slackmessage WHERE is_thread_parent = TRUE;
SELECT 'Thread replies:' as info, COUNT(*) FROM slackmessage WHERE is_thread_reply = TRUE;
EOF

echo "Thread data reset complete."
echo ""
echo "Now use the 'Sync Threads' button in the UI for each channel to fetch thread replies from Slack API."
echo "This will populate the thread replies based on the corrected thread parent flags."
