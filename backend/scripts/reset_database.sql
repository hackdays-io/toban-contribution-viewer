-- Reset database script
-- This script will clear all data from the Slack-related tables
-- while preserving the database structure
BEGIN;

-- Disable FK constraints temporarily
SET CONSTRAINTS ALL DEFERRED;

-- Truncate tables (delete all data while keeping structure)
TRUNCATE TABLE analysis_channels CASCADE;
TRUNCATE TABLE slackanalysis CASCADE;
TRUNCATE TABLE slackchannel CASCADE;
TRUNCATE TABLE slackcontribution CASCADE;
TRUNCATE TABLE slackmessage CASCADE;
TRUNCATE TABLE slackreaction CASCADE;
TRUNCATE TABLE slackuser CASCADE;
TRUNCATE TABLE slackworkspace CASCADE;

-- Re-enable FK constraints
SET CONSTRAINTS ALL IMMEDIATE;

-- Reset sequences
ALTER SEQUENCE IF EXISTS slackanalysis_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS slackchannel_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS slackcontribution_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS slackmessage_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS slackreaction_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS slackuser_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS slackworkspace_id_seq RESTART WITH 1;

COMMIT;