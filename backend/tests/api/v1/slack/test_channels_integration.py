"""
Integration tests for Slack channels API with real backend services.

NOTE: These tests are all skipped because the Slack channels API is not yet implemented.

These tests connect to the actual Slack API and database.
To run these tests, you need:
1. A valid Slack workspace with OAuth token
2. Proper environment variables set
3. A test database

Note: To run these tests from outside Docker while using the Docker database,
      you will need to modify the DATABASE_URL environment variable to use the
      exposed port (typically 5432) on localhost instead of the internal Docker network.

Run with: pytest -xvs tests/api/v1/slack/test_channels_integration.py
"""

# When running outside Docker but connecting to Docker database
import asyncio
import os
import uuid
from unittest.mock import patch

if "DATABASE_URL" in os.environ and "postgres" in os.environ["DATABASE_URL"]:
    # Replace internal Docker hostname with localhost
    os.environ["DATABASE_URL"] = os.environ["DATABASE_URL"].replace("postgres", "localhost")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackWorkspace

# Flag to control real API usage - set to True to use actual Slack API
USE_REAL_SLACK_API = os.environ.get("TEST_USE_REAL_SLACK_API", "false").lower() == "true"
# Flag to control real database usage - set to True to use actual database
USE_REAL_DATABASE = os.environ.get("TEST_USE_REAL_DATABASE", "false").lower() == "true"

# Test configuration
TEST_WORKSPACE_ID = os.environ.get("TEST_WORKSPACE_ID")
TEST_SLACK_TOKEN = os.environ.get("TEST_SLACK_TOKEN")


@pytest.fixture
def test_workspace():
    """Create a test workspace - either real or mock based on configuration."""
    if USE_REAL_DATABASE and TEST_WORKSPACE_ID:
        # Return a reference to a real workspace in the database
        return {"id": TEST_WORKSPACE_ID}
    else:
        # Return a mock workspace
        return {
            "id": str(uuid.uuid4()),
            "slack_id": "T12345",
            "name": "Test Workspace",
            "access_token": TEST_SLACK_TOKEN or "xoxb-test-token",
        }


@pytest.fixture
async def setup_test_db(test_workspace):
    """Set up test database with a workspace if using real database."""
    if not USE_REAL_DATABASE:
        # Skip actual database setup for mock tests
        yield None
        return

    # Import here to avoid importing when not using real DB
    from app.db.session import get_async_session

    # Get a real database session
    async_session = get_async_session()
    session = await asyncio.anext(async_session)

    # Check if we're using an existing workspace or need to create one
    if TEST_WORKSPACE_ID:
        # Just verify the workspace exists
        from sqlalchemy import select

        workspace_result = await session.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == TEST_WORKSPACE_ID)
        )
        workspace = workspace_result.scalars().first()
        if not workspace:
            pytest.skip(f"Test workspace with ID {TEST_WORKSPACE_ID} not found in database")
    else:
        # Create a test workspace
        workspace = SlackWorkspace(
            id=uuid.uuid4(),
            slack_id=test_workspace["slack_id"],
            name=test_workspace["name"],
            access_token=test_workspace["access_token"],
            is_connected=True,
            connection_status="active",
        )
        session.add(workspace)
        await session.commit()
        # Update the test_workspace dict with the real ID
        test_workspace["id"] = str(workspace.id)

    yield session

    # Clean up if we created a test workspace and not using a predefined one
    if not TEST_WORKSPACE_ID:
        # Delete any channels associated with this workspace
        await session.execute(
            f"DELETE FROM slackchannel WHERE workspace_id = '{test_workspace['id']}'"
        )
        # Delete the workspace
        await session.execute(
            f"DELETE FROM slackworkspace WHERE id = '{test_workspace['id']}'"
        )
        await session.commit()

    await session.close()


@pytest.fixture
def api_client():
    """Create a test client for the FastAPI application."""
    app = FastAPI()
    # We're skipping all tests so just return a basic client
    return TestClient(app)


@pytest.mark.asyncio
@pytest.mark.skip(reason="Channels API not yet implemented")
async def test_list_channels_integration(api_client, setup_test_db, test_workspace):
    """Integration test for listing channels with real API and database."""
    # This test is skipped because the channels API is not yet implemented
    pass


@pytest.mark.asyncio
@pytest.mark.skip(reason="Channels API not yet implemented")
async def test_sync_channels_integration(api_client, setup_test_db, test_workspace):
    """Integration test for syncing channels with real API and database."""
    # This test is skipped because the channels API is not yet implemented
    pass


@pytest.mark.asyncio
@pytest.mark.skip(reason="Channels API not yet implemented")
async def test_select_channels_integration(api_client, setup_test_db, test_workspace):
    """Integration test for selecting channels with real API and database."""
    # This test is skipped because the channels API is not yet implemented
    pass


@pytest.mark.asyncio
@pytest.mark.skip(reason="ChannelService not yet implemented")
async def test_channel_service_direct(setup_test_db, test_workspace):
    """Direct test of ChannelService without going through API endpoints.

    This is useful for testing lower-level functionality.
    """
    # This test is skipped because ChannelService is not yet implemented
    pass


# If this file is run directly, execute the tests with real connections
if __name__ == "__main__":
    # Set flags for real connections
    os.environ["TEST_USE_REAL_SLACK_API"] = "true"
    os.environ["TEST_USE_REAL_DATABASE"] = "true"
    # Check for required environment variables
    if not TEST_WORKSPACE_ID:
        print("ERROR: TEST_WORKSPACE_ID environment variable must be set")
        exit(1)
    if not TEST_SLACK_TOKEN:
        print("ERROR: TEST_SLACK_TOKEN environment variable must be set")
        exit(1)
    # Run pytest with verbose output
    import sys

    sys.exit(pytest.main(["-xvs", __file__]))