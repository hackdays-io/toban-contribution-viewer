# Database Migrations

This directory contains database migration scripts for the Toban Contribution Viewer application.

## Migration History

### 001_create_slack_models.py
Initial database schema creation for Slack integration:
- SlackWorkspace
- SlackChannel
- SlackUser
- SlackMessage
- SlackReaction
- SlackAnalysis (for contribution analysis)
- SlackContribution

### 7d5c89f714c7_add_workspace_metadata_column_to_.py
Added workspace_metadata column to SlackWorkspace model for storing additional workspace information.

### 9b8d4568d5be_add_channel_analysis_model.py
Added SlackChannelAnalysis model for storing LLM analysis results:
- Created a new SlackChannelAnalysis table to store detailed LLM analyses of Slack channels
- Enhanced the SlackAnalysis model with scheduling capabilities and LLM-specific fields
- Added relationships between SlackAnalysis and SlackChannelAnalysis

## Running Migrations

To apply migrations:

```bash
# Make sure your virtual environment is activated
cd backend
source venv/bin/activate

# Apply all migrations up to the latest version
alembic upgrade head

# Apply migrations to a specific version
alembic upgrade <revision_id>
```

To create a new migration:

```bash
# Create a new migration script
alembic revision -m "description_of_changes"

# Edit the generated script in alembic/versions/
# Then apply the migration
alembic upgrade head
```

## Database Access

To connect to the PostgreSQL database with Docker Compose:

```bash
docker compose exec postgres psql -U toban_admin -d tobancv
```

To run SQL commands directly:

```bash
docker compose exec postgres psql -U toban_admin -d tobancv -c "SELECT * FROM slackchannelanalysis LIMIT 5;"
```

Outside of Docker, use:
```
postgresql://toban_admin:postgres@localhost:5432/tobancv
```

## Migration Best Practices

1. Always test migrations on a copy of the production database before applying to production
2. Include both `upgrade()` and `downgrade()` functionality in each migration
3. For large tables, consider batching operations to reduce impact
4. Document each migration in this README.md file
