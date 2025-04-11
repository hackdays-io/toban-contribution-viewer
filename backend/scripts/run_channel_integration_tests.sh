#!/bin/bash
# Script to run Slack channel integration tests with real API and database

# Usage: ./run_channel_integration_tests.sh [workspace_id]
# If workspace_id is not provided, it will use the TEST_WORKSPACE_ID environment variable

# Make the script exit on error
set -e

# Set up environment variables
export TEST_USE_REAL_SLACK_API="true"
export TEST_USE_REAL_DATABASE="true"

# Get the workspace ID from command line or environment variable
if [ -n "$1" ]; then
  export TEST_WORKSPACE_ID="$1"
elif [ -z "$TEST_WORKSPACE_ID" ]; then
  echo "ERROR: Please provide a workspace ID as an argument or set TEST_WORKSPACE_ID environment variable"
  exit 1
fi

# Verify TEST_SLACK_TOKEN is set
if [ -z "$TEST_SLACK_TOKEN" ]; then
  # Try to get it from the environment file
  if [ -f ".env" ]; then
    source .env
    export TEST_SLACK_TOKEN="$SLACK_CLIENT_TOKEN"
  else
    echo "ERROR: TEST_SLACK_TOKEN environment variable must be set"
    echo "Please set it manually or ensure it's defined in your .env file"
    exit 1
  fi
fi

echo "Running integration tests with:"
echo "  Workspace ID: $TEST_WORKSPACE_ID"
echo "  Using real Slack API: $TEST_USE_REAL_SLACK_API"
echo "  Using real database: $TEST_USE_REAL_DATABASE"
echo ""

# Run the tests
pytest -xvs tests/api/v1/slack/test_channels_integration.py