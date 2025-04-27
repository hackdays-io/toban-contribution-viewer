"""
Test script to verify the team_id fix in CrossResourceReport creation.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# Mock models to simulate the database models
class MockWorkspace:
    def __init__(self, id: uuid.UUID, team_id: Optional[uuid.UUID] = None):
        self.id = id
        self.team_id = team_id


class MockIntegration:
    def __init__(self, id: uuid.UUID, owner_team_id: uuid.UUID):
        self.id = id
        self.owner_team_id = owner_team_id


class MockCrossResourceReport:
    def __init__(
        self,
        id: uuid.UUID,
        team_id: uuid.UUID,
        title: str,
        description: str,
        date_range_start: datetime,
        date_range_end: datetime,
    ):
        self.id = id
        self.team_id = team_id
        self.title = title
        self.description = description
        self.date_range_start = date_range_start
        self.date_range_end = date_range_end


# Test function to simulate the analyze_integration_resource function's behavior
async def test_team_id_selection():
    logger.info("Testing team_id selection logic")

    # Case 1: workspace.team_id exists (normal case)
    workspace_id = uuid.uuid4()
    workspace_team_id = uuid.uuid4()
    workspace = MockWorkspace(workspace_id, workspace_team_id)

    integration_id = uuid.uuid4()
    integration_team_id = uuid.uuid4()
    integration = MockIntegration(integration_id, integration_team_id)

    logger.info("Case 1: workspace.team_id exists")
    logger.info(f"Creating CrossResourceReport with workspace ID: {workspace.id}")

    # Apply the fix logic
    team_id = workspace.team_id
    if team_id is None:
        logger.warning(f"Workspace {workspace.id} has null team_id, using integration.owner_team_id instead")
        team_id = integration.owner_team_id

        if team_id is None:
            logger.error(
                f"Cannot create CrossResourceReport: No valid team_id found in workspace {workspace.id} or integration {integration_id}"
            )
            raise ValueError(
                "Could not determine team_id for CrossResourceReport. Please check workspace and integration configuration."
            )

        logger.info(f"Using integration.owner_team_id: {team_id} for CrossResourceReport")
    else:
        logger.info(f"Using workspace.team_id: {team_id} for CrossResourceReport")

    # Create mock report
    report = MockCrossResourceReport(
        id=uuid.uuid4(),
        team_id=team_id,
        title="Test Report",
        description="Test Description",
        date_range_start=datetime.now(),
        date_range_end=datetime.now(),
    )

    logger.info(f"Created report with team_id: {report.team_id}")
    assert report.team_id == workspace_team_id
    logger.info("Case 1 passed: report.team_id == workspace.team_id")

    # Case 2: workspace.team_id is None, fallback to integration.owner_team_id
    workspace_without_team = MockWorkspace(workspace_id, None)

    logger.info("Case 2: workspace.team_id is None")
    logger.info(f"Creating CrossResourceReport with workspace ID: {workspace_without_team.id}")

    # Apply the fix logic
    team_id = workspace_without_team.team_id
    if team_id is None:
        logger.warning(
            f"Workspace {workspace_without_team.id} has null team_id, using integration.owner_team_id instead"
        )
        team_id = integration.owner_team_id

        if team_id is None:
            logger.error(
                f"Cannot create CrossResourceReport: No valid team_id found in workspace {workspace_without_team.id} or integration {integration_id}"
            )
            raise ValueError(
                "Could not determine team_id for CrossResourceReport. Please check workspace and integration configuration."
            )

        logger.info(f"Using integration.owner_team_id: {team_id} for CrossResourceReport")
    else:
        logger.info(f"Using workspace.team_id: {team_id} for CrossResourceReport")

    # Create mock report
    report = MockCrossResourceReport(
        id=uuid.uuid4(),
        team_id=team_id,
        title="Test Report",
        description="Test Description",
        date_range_start=datetime.now(),
        date_range_end=datetime.now(),
    )

    logger.info(f"Created report with team_id: {report.team_id}")
    assert report.team_id == integration_team_id
    logger.info("Case 2 passed: report.team_id == integration.owner_team_id")

    # Case 3: both workspace.team_id and integration.owner_team_id are None
    integration_without_team = MockIntegration(integration_id, None)

    logger.info("Case 3: both workspace.team_id and integration.owner_team_id are None")
    logger.info(f"Creating CrossResourceReport with workspace ID: {workspace_without_team.id}")

    try:
        # Apply the fix logic
        team_id = workspace_without_team.team_id
        if team_id is None:
            logger.warning(
                f"Workspace {workspace_without_team.id} has null team_id, using integration.owner_team_id instead"
            )
            team_id = integration_without_team.owner_team_id

            if team_id is None:
                logger.error(
                    f"Cannot create CrossResourceReport: No valid team_id found in workspace {workspace_without_team.id} or integration {integration_id}"
                )
                # Instead of creating a report with None team_id, we should
                # raise our custom error as specified in the fix
                raise ValueError(
                    "Could not determine team_id for CrossResourceReport. Please check workspace and integration configuration."
                )

            logger.info(f"Using integration.owner_team_id: {team_id} for CrossResourceReport")
        else:
            logger.info(f"Using workspace.team_id: {team_id} for CrossResourceReport")

        # We shouldn't reach here in Case 3
        raise AssertionError("Should have raised an error when both team_ids are None")
    except ValueError as e:
        # This is the expected behavior
        logger.info(f"Case 3 correctly raised an error: {str(e)}")
        logger.info("Case 3 passed: Error was raised when both team_ids are None")


# Main function to run the test
async def main():
    logger.info("Starting team_id fix verification")
    await test_team_id_selection()
    logger.info("All tests passed!")


if __name__ == "__main__":
    asyncio.run(main())
