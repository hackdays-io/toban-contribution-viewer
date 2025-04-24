-- Reset database script
-- This script will completely drop and recreate the database
BEGIN;

-- Drop all tables (this will cascade to all dependent objects)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore default privileges
GRANT ALL ON SCHEMA public TO toban_admin;
GRANT ALL ON SCHEMA public TO public;

COMMIT;