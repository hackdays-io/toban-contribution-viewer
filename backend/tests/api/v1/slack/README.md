# Slack API Tests

This directory contains tests for the Slack API integration in the Toban Contribution Viewer.

## Test Files

- `test_oauth.py`: Tests for Slack OAuth authentication
- `test_channels.py`: Unit tests for the channel endpoints
- `test_channels_integration.py`: Integration tests for channel endpoints with real Slack API

## Running Tests

### Unit Tests

Run unit tests with pytest:

```bash
pytest tests/api/v1/slack/test_oauth.py tests/api/v1/slack/test_channels.py
```

These tests use mocks and don't require real Slack credentials.

### Integration Tests

Integration tests require additional setup to run with real Slack data.

See the detailed documentation at:
- `/docs/testing/slack-channel-testing.md`

Quick start:
```bash
# Set up environment
export TEST_USE_REAL_SLACK_API="true"
export TEST_USE_REAL_DATABASE="true"
export TEST_WORKSPACE_ID="your-workspace-uuid"
export TEST_SLACK_TOKEN="xoxb-your-bot-token"

# Run tests
pytest tests/api/v1/slack/test_channels_integration.py
```

Or use the helper script:
```bash
./scripts/run_channel_integration_tests.sh YOUR_WORKSPACE_ID
```