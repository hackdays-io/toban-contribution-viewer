# Slack Channel Integration Testing Guide

This guide explains how to run the integration tests for Slack channel functionality in the Toban Contribution Viewer.

## Overview

The Slack channel integration tests verify that the application can:

1. List channels from a connected Slack workspace
2. Sync channels from the Slack API
3. Select channels for analysis

These tests can run against mock data (the default) or against real Slack data and a real database.

## Prerequisites

To run the tests with real data, you need:

1. A Slack workspace with a connected app
2. A valid OAuth token with appropriate scopes
3. Access to the application database

## Finding Your Workspace ID

Before running the integration tests with real data, you'll need to get the workspace ID:

### Option 1: Check the Database

```sql
SELECT id, name, slack_id FROM slackworkspace;
```

The `id` column contains the UUID you need (e.g., `a0821bb4-4757-4b3c-a857-220104cd834b`).

### Option 2: From the API

1. Connect a Slack workspace to the application
2. Use the workspaces list endpoint to find the ID:
   ```
   GET /api/v1/slack/workspaces
   ```

### Option 3: From the Docker Database

```bash
docker compose exec postgres psql -U toban_admin -d tobancv -c "SELECT id, name FROM slackworkspace;"
```

## Running the Tests

### Method 1: Using the Helper Script

We provide a script to simplify running the integration tests:

```bash
cd backend
./scripts/run_channel_integration_tests.sh YOUR_WORKSPACE_ID
```

Make sure your `.env` file contains a valid Slack token (SLACK_CLIENT_TOKEN).

### Method 2: Manual Setup

1. Set the required environment variables:

```bash
export TEST_USE_REAL_SLACK_API="true"
export TEST_USE_REAL_DATABASE="true"
export TEST_WORKSPACE_ID="your-workspace-uuid"
export TEST_SLACK_TOKEN="xoxb-your-bot-token"
```

2. Run the tests:

```bash
pytest -xvs tests/api/v1/slack/test_channels_integration.py
```

### Running Outside Docker

If running tests from outside Docker but connecting to the Docker database:

```bash
# Override the DATABASE_URL to connect to localhost
export DATABASE_URL="postgresql://toban_admin:postgres@localhost:5432/tobancv"
```

The test will automatically handle converting the URL if needed.

## Understanding Test Results

The test output includes:

- Channel counts and names
- Sync operation statistics
- Selected channel details

A successful test means that:
- The API can authenticate with Slack
- Channel data can be retrieved and processed
- The functionality is working as expected

## Troubleshooting

### Common Issues

1. **Connection errors**: 
   - If running outside Docker, make sure to use `localhost` instead of `postgres` in the DATABASE_URL

2. **Authentication errors**:
   - Verify that your token has the required scopes:
     - `channels:read`
     - `groups:read`
     - `im:read`
     - `mpim:read`

3. **Missing workspace**:
   - Ensure you've connected a Slack workspace to the application first

4. **Parameter validation errors**:
   - Check that the test parameters match what the API expects
   - The `limit` parameter must be ≥ 100 for channel sync

### Logs

For more detailed debugging, check the logs when running the backend service:

```bash
docker compose logs -f backend
```