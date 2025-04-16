# Database Schema Management

This document describes the database schema management approach for the Toban Contribution Viewer application.

## Overview

The application uses PostgreSQL for its database with SQLAlchemy as the ORM (Object-Relational Mapper) and Alembic for migrations. All schema changes should be managed through Alembic migrations to maintain consistency across environments.

## Database Structure

The database schema consists of the following main components:

### Team and User Management

- **Team**: Organizational unit that groups related integrations
- **TeamMember**: Represents users' membership within teams with specific roles

### Integration Framework

- **Integration**: Core entity for external service connections (Slack, GitHub, etc.)
- **IntegrationCredential**: Secure storage for authentication tokens and API keys
- **IntegrationShare**: Cross-team sharing permissions for integrations
- **ServiceResource**: Resources from integrated services (channels, repositories, etc.)
- **ResourceAccess**: Fine-grained access control for specific resources
- **IntegrationEvent**: Audit log for integration-related actions

### Slack-Specific Components

- **SlackWorkspace**: Connected Slack workspaces
- **SlackChannel**: Channels within Slack workspaces
- **SlackUser**: Users within Slack workspaces
- **SlackMessage**: Messages captured from Slack channels
- **SlackReaction**: Emoji reactions to messages
- **SlackAnalysis**: Analysis configurations and results
- **SlackContribution**: User contribution metrics

## Database Management

### Recommended Approach

Always use **Alembic migrations** for schema changes. This is the only supported method for ensuring schema consistency across all environments.

### Setting Up a New Database

The recommended way to set up a new database is by using the `setup_database.py` script:

```bash
# Inside Docker container
python scripts/setup_database.py

# From host machine
docker exec tobancv-backend python scripts/setup_database.py
```

For a complete reset (WARNING: destroys all data):

```bash
python scripts/setup_database.py --reset
```

### Managing Migrations

#### Viewing Migration Status

```bash
# Check current migration
alembic current

# View migration history
alembic history
```

#### Creating a New Migration

When making schema changes:

```bash
# Create a new migration
alembic revision --autogenerate -m "description_of_changes"
```

Edit the generated file in `alembic/versions/` if needed to ensure it correctly represents your schema changes.

#### Applying Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Apply to a specific version
alembic upgrade <revision_id>
```

#### Reverting Migrations

```bash
# Revert to previous version
alembic downgrade -1

# Revert to specific version
alembic downgrade <revision_id>
```

## Consolidated Migration

To improve idempotency and ensure consistent schema across environments, a consolidated migration (`consolidated_schema.py`) has been created which:

1. Contains the entire database schema in one file
2. Uses idempotency checks to safely run on existing databases
3. Properly handles dependencies between tables
4. Creates all required enums and constraints

When setting up a new environment, this migration can be run with:

```bash
alembic upgrade consolidated_schema
```

## Special Purpose Scripts

The repository includes a few scripts with specific data migration purposes:

- `create_default_teams.py` - Creates default teams for existing Slack workspaces

Note that the direct table creation scripts have been removed in favor of Alembic migrations:
- `create_all_tables.py` (removed)
- `create_integration_tables.py` (removed)
- `create_team_table.py` (removed)
- `create_teammember_table.py` (removed)

## Best Practices

1. **Always use migrations** for schema changes
2. **Test migrations** before applying to production
3. **Back up your database** before applying migrations in production
4. **Review migration files** carefully to avoid unexpected changes
5. **Use meaningful commit messages** when adding migrations
6. **Document schema changes** in code comments and PR descriptions
