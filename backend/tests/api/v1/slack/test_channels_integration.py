"""
Integration tests for Slack channels API with real backend services.

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
import os
if "DATABASE_URL" in os.environ and "postgres" in os.environ["DATABASE_URL"]:
    # Replace internal Docker hostname with localhost
    os.environ["DATABASE_URL"] = os.environ["DATABASE_URL"].replace("postgres", "localhost")

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.slack.channels import router as channels_router
from app.db.session import get_async_db
from app.models.slack import SlackChannel, SlackWorkspace
from app.services.slack.api import SlackApiClient
from app.services.slack.channels import ChannelService

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
    session = await anext(async_session)

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
    app.include_router(channels_router, prefix="")

    if USE_REAL_DATABASE:
        # If using a real database, we'll use the actual dependency
        return TestClient(app)
    else:
        # If using mocks, we'll patch the database dependency
        with patch("app.api.v1.slack.channels.get_async_db") as mock_get_db:
            # Create a mock session
            mock_session = AsyncSession()

            # Configure mock_get_db to be an async generator
            async def mock_get_db_impl():
                yield mock_session

            mock_get_db.return_value = mock_get_db_impl()

            # Return the test client with patched dependencies
            return TestClient(app)


@pytest.mark.asyncio
@pytest.mark.skipif(
    not (USE_REAL_SLACK_API and USE_REAL_DATABASE and TEST_WORKSPACE_ID and TEST_SLACK_TOKEN),
    reason="Skipping real API test. Set env vars to run.",
)
async def test_list_channels_integration(api_client, setup_test_db, test_workspace):
    """Integration test for listing channels with real API and database."""
    # Make the request to list channels
    response = api_client.get(
        f"/workspaces/{test_workspace['id']}/channels",
        params={"types": ["public", "private"], "page": "1", "page_size": "10"},
    )

    # Verify the response
    assert response.status_code == 200
    data = response.json()
    assert "channels" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["page_size"] == 10

    # Print some helpful info about the test results
    print(f"Found {len(data['channels'])} channels in workspace")
    if data["channels"]:
        print(f"First channel: {data['channels'][0]['name']}")


@pytest.mark.asyncio
@pytest.mark.skipif(
    not (USE_REAL_SLACK_API and USE_REAL_DATABASE and TEST_WORKSPACE_ID and TEST_SLACK_TOKEN),
    reason="Skipping real API test. Set env vars to run.",
)
async def test_sync_channels_integration(api_client, setup_test_db, test_workspace):
    """Integration test for syncing channels with real API and database."""
    # Make the request to sync channels - use valid parameters
    response = api_client.post(
        f"/workspaces/{test_workspace['id']}/channels/sync",
        params={"limit": 100, "sync_all_pages": 1},  # limit must be >= 100
    )

    # Verify the response
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "created_count" in data
    assert "updated_count" in data
    assert "total_count" in data

    # Print some helpful info about the test results
    print(f"Synced {data['total_count']} channels from Slack")
    print(f"Created: {data['created_count']}, Updated: {data['updated_count']}")


@pytest.mark.asyncio
@pytest.mark.skipif(
    not (USE_REAL_SLACK_API and USE_REAL_DATABASE and TEST_WORKSPACE_ID and TEST_SLACK_TOKEN),
    reason="Skipping real API test. Set env vars to run.",
)
async def test_select_channels_integration(api_client, setup_test_db, test_workspace):
    """Integration test for selecting channels with real API and database."""
    # First, get some channel IDs from the list endpoint
    list_response = api_client.get(
        f"/workspaces/{test_workspace['id']}/channels", params={"page_size": 5}
    )
    assert list_response.status_code == 200
    
    channels = list_response.json()["channels"]
    if not channels:
        pytest.skip("No channels found to select")
    
    # Get IDs of channels to select (up to 3)
    channel_ids = [channel["id"] for channel in channels[:min(3, len(channels))]]
    
    # Make the request to select channels
    response = api_client.post(
        f"/workspaces/{test_workspace['id']}/channels/select",
        json={"channel_ids": channel_ids},
    )
    
    # Verify the response
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["selected_count"] == len(channel_ids)
    
    # Print some helpful info about the test results
    print(f"Selected {data['selected_count']} channels for analysis")
    for channel in data["selected_channels"]:
        print(f"Selected channel: {channel['name']} ({channel['id']})")


@pytest.mark.asyncio
async def test_channel_service_direct(setup_test_db, test_workspace):
    """
    Direct test of ChannelService without going through API endpoints.
    This is useful for testing lower-level functionality.
    """
    if not (USE_REAL_SLACK_API and USE_REAL_DATABASE and TEST_SLACK_TOKEN):
        pytest.skip("Skipping real service test. Set env vars to run.")
    
    from app.db.session import get_async_session
    
    # Get a database session
    session = await anext(get_async_session())
    
    try:
        # First sync the channels to ensure we have data
        created, updated, total = await ChannelService.sync_channels_from_slack(
            db=session,
            workspace_id=test_workspace["id"],
            limit=10,
            sync_all_pages=False  # Just sync first page for speed
        )
        
        print(f"Service test - Synced channels: {total} total, {created} created, {updated} updated")
        
        # Now get the list of channels
        result = await ChannelService.get_channels_for_workspace(
            db=session,
            workspace_id=test_workspace["id"],
            page=1,
            page_size=5
        )
        
        channels = result["channels"]
        print(f"Service test - Retrieved {len(channels)} channels")
        
        if channels:
            # Select the first channel for analysis
            channel_ids = [channels[0]["id"]]
            select_result = await ChannelService.select_channels_for_analysis(
                db=session,
                workspace_id=test_workspace["id"],
                channel_ids=channel_ids
            )
            
            print(f"Service test - Selected {select_result['selected_count']} channels")
            assert select_result["selected_count"] == 1
            assert select_result["selected_channels"][0]["id"] == channel_ids[0]
    
    finally:
        await session.close()


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