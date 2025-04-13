-- Script to reset thread data
-- Run this with: docker compose exec postgres psql -U toban_admin -d tobancv -f /scripts/reset_thread_data.sql

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
