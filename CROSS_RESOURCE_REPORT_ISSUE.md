# Cross-Resource Report Database Migration Issue

## Problem Description

When attempting to use the multi-channel analysis feature, the application encounters a database error because the cross-resource report tables do not exist in the database. The error occurs despite having appropriate alembic migrations defined.

Specific error encountered:
```
asyncpg.exceptions.UndefinedTableError: relation "crossresourcereport" does not exist
```

## Investigation Findings

1. There are two relevant migration files:
   - `69208caae8cb_add_cross_resource_report_tables.py` - Initial migration that tries to create the tables
   - `8620cd569a90_fix_resource_type_enum_conflict.py` - Fix for the enum conflict

2. The first migration is skipped (has a `return` statement at the beginning) and comments indicate it should be replaced by the second migration.

3. The second migration attempts to create the tables with a different enum name (`analysisresourcetype` instead of `resourcetype`) to avoid conflicts with existing types.

4. When running the migrations, the following error occurs:
   ```
   psycopg2.errors.DuplicateObject: type "resourcetype" already exists
   ```

5. The `setup_database.py` script has some handling for duplicate object errors, but it still fails to properly create the tables in both existing and new environments.

6. There is no consolidated schema migration available, which complicates the setup process.

## Required Fixes

### 1. Fix the Migration Path

- Create a new migration that properly handles the enum type conflict
- This should either:
  - Use the existing enum type if compatible
  - Create new enum types with different names for all required enums
  - Drop and recreate enums in a transactional manner if needed

### 2. Create Consolidated Schema Migration

- Create a consolidated schema migration file that:
  - Contains all table and index definitions
  - Uses consistent enum names
  - Properly handles existing database objects
  - Can be run on a fresh database

### 3. Test Database Setup Process

- Verify that `setup_database.py` works correctly with the new migrations
- Ensure the script properly handles both:
  - Fresh database setup
  - Updates to existing databases

### 4. Update Cross-Resource Report Functionality

- Once the database schema is fixed, update/enable the cross-resource report functionality in:
  - `CreateAnalysisPage.tsx` (currently disabled with a conditional `false && selectedChannels.length > 1`)
  - Any other affected components

## Technical Details

### Enum Conflict Issue

The specific conflict is with the `resourcetype` enum, which is already defined in the database but the migration tries to create it again. 

Current enum in database:
```sql
CREATE TYPE resourcetype AS ENUM (...existing values...);
```

Migration trying to create:
```sql
CREATE TYPE resourcetype AS ENUM ('SLACK_CHANNEL', 'GITHUB_REPO', 'NOTION_PAGE');
```

### Database Tables Needed

Two main tables need to be created:

1. `crossresourcereport` - Stores the overall report information
2. `resourceanalysis` - Stores individual resource analyses within a report

### Migration Sequence

Current sequence:
```
08c3539fba42_rename_is_bot_member_to_has_bot.py
↓
69208caae8cb_add_cross_resource_report_tables.py (skipped in code)
↓
8620cd569a90_fix_resource_type_enum_conflict.py
```

## Priority

This issue blocks the multi-channel analysis feature, which is a core part of the cross-resource functionality. Until fixed, users can only analyze one channel at a time, even when they select multiple channels.

## Temporary Workaround

The current workaround is to only use the first selected channel for analysis, ignoring any additional selected channels. This provides a degraded user experience but allows the application to function without errors.