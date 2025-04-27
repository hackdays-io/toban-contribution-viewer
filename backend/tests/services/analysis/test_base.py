"""Tests for base ResourceAnalysisService."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import ReportStatus, ResourceAnalysis
from app.services.analysis.base import ResourceAnalysisService


class MockResourceAnalysisService(ResourceAnalysisService):
    """Mock implementation of ResourceAnalysisService for testing."""

    async def fetch_data(self, resource_id, start_date, end_date, **kwargs):
        """Mock implementation that returns test data."""
        return {"test": "data"}

    async def analyze_data(self, data, analysis_type, **kwargs):
        """Mock implementation that returns test results."""
        return {
            "contributor_insights": "Test insights",
            "topic_analysis": "Test topics",
            "resource_summary": "Test summary",
            "key_highlights": "Test highlights",
            "model_used": "test-model",
        }

    async def prepare_data_for_analysis(self, data, analysis_type):
        """Mock implementation that returns processed test data."""
        return {"processed": "data"}


@pytest.mark.asyncio
async def test_update_analysis_status():
    """Test updating analysis status."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Mock the execute and scalar_one_or_none methods
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ResourceAnalysis(id=uuid.uuid4(), status=ReportStatus.IN_PROGRESS)
    db.execute.return_value = mock_result

    # Create service instance
    service = MockResourceAnalysisService(db)

    # Call the method
    analysis_id = uuid.uuid4()
    result = await service.update_analysis_status(
        analysis_id=analysis_id,
        status=ReportStatus.IN_PROGRESS,
        progress=50.0,
        message="In progress",
    )

    # Check that execute was called
    db.execute.assert_called()

    # Check that the returned analysis has the correct status
    assert result.status == ReportStatus.IN_PROGRESS


@pytest.mark.asyncio
async def test_store_analysis_results():
    """Test storing analysis results."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Mock the execute and scalar_one_or_none methods
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ResourceAnalysis(id=uuid.uuid4(), status=ReportStatus.COMPLETED)
    db.execute.return_value = mock_result

    # Create service instance
    service = MockResourceAnalysisService(db)

    # Call the method
    analysis_id = uuid.uuid4()
    test_results = {"test": "results"}
    result = await service.store_analysis_results(
        analysis_id=analysis_id,
        results=test_results,
        contributor_insights="Test insights",
        topic_analysis="Test topics",
        resource_summary="Test summary",
        key_highlights="Test highlights",
        model_used="test-model",
    )

    # Check that execute was called twice (once for update, once for select)
    assert db.execute.call_count == 2

    # Check that the returned analysis has the correct status
    assert result.status == ReportStatus.COMPLETED


@pytest.mark.asyncio
async def test_handle_errors_non_retryable():
    """Test handling non-retryable errors."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Mock the execute and scalar_one_or_none methods
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ResourceAnalysis(id=uuid.uuid4(), status=ReportStatus.FAILED)
    db.execute.return_value = mock_result

    # Create service instance
    service = MockResourceAnalysisService(db)

    # Patch the _is_retryable_error method to return False
    with patch.object(service, "_is_retryable_error", return_value=False):
        # Call the method with a non-retryable error
        analysis_id = uuid.uuid4()
        error = ValueError("Test error")
        result = await service.handle_errors(error=error, analysis_id=analysis_id)

        # Check that the returned analysis has FAILED status
        assert result.status == ReportStatus.FAILED


@pytest.mark.asyncio
async def test_handle_errors_retryable():
    """Test handling retryable errors."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Mock the execute and scalar_one_or_none methods
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ResourceAnalysis(
        id=uuid.uuid4(),
        status=ReportStatus.PENDING,  # Should be set to PENDING for retry
    )
    db.execute.return_value = mock_result

    # Create service instance
    service = MockResourceAnalysisService(db)

    # Patch the _is_retryable_error method to return True
    with patch.object(service, "_is_retryable_error", return_value=True):
        # Call the method with a retryable error
        analysis_id = uuid.uuid4()
        error = ConnectionError("Test connection error")
        result = await service.handle_errors(error=error, analysis_id=analysis_id, max_retries=3, current_retry=0)

        # Check that the returned analysis has PENDING status for retry
        assert result.status == ReportStatus.PENDING


@pytest.mark.asyncio
async def test_run_analysis_success():
    """Test successful run_analysis flow."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Create service instance
    service = MockResourceAnalysisService(db)

    # Mock all the methods that run_analysis calls
    service.update_analysis_status = AsyncMock()
    service.fetch_data = AsyncMock(return_value={"test": "data"})
    service.prepare_data_for_analysis = AsyncMock(return_value={"processed": "data"})
    service.analyze_data = AsyncMock(
        return_value={
            "contributor_insights": "Test insights",
            "topic_analysis": "Test topics",
            "resource_summary": "Test summary",
            "key_highlights": "Test highlights",
            "model_used": "test-model",
        }
    )
    service.store_analysis_results = AsyncMock()

    # Call the method
    analysis_id = uuid.uuid4()
    resource_id = uuid.uuid4()
    integration_id = uuid.uuid4()

    now = datetime.utcnow()
    start_date = now - timedelta(days=30)
    end_date = now

    await service.run_analysis(
        analysis_id=analysis_id,
        resource_id=resource_id,
        integration_id=integration_id,
        analysis_type="CONTRIBUTION",
        period_start=start_date,
        period_end=end_date,
        parameters={"test": "param"},
    )

    # Check that all methods were called with expected arguments
    service.update_analysis_status.assert_called_with(analysis_id=analysis_id, status=ReportStatus.IN_PROGRESS)

    service.fetch_data.assert_called_with(
        resource_id=resource_id,
        start_date=start_date,
        end_date=end_date,
        integration_id=integration_id,
        parameters={"test": "param"},
    )

    service.prepare_data_for_analysis.assert_called_with(data={"test": "data"}, analysis_type="CONTRIBUTION")

    service.analyze_data.assert_called_with(
        data={"processed": "data"},
        analysis_type="CONTRIBUTION",
        parameters={"test": "param"},
    )

    service.store_analysis_results.assert_called_with(
        analysis_id=analysis_id,
        results={
            "contributor_insights": "Test insights",
            "topic_analysis": "Test topics",
            "resource_summary": "Test summary",
            "key_highlights": "Test highlights",
            "model_used": "test-model",
        },
        contributor_insights="Test insights",
        topic_analysis="Test topics",
        resource_summary="Test summary",
        key_highlights="Test highlights",
        model_used="test-model",
        message_count=None,
        participant_count=None,
        thread_count=None,
        reaction_count=None,
    )


@pytest.mark.asyncio
async def test_run_analysis_error():
    """Test run_analysis with an error."""
    # Create mock db session
    db = AsyncMock(spec=AsyncSession)

    # Create service instance
    service = MockResourceAnalysisService(db)

    # Mock the update_analysis_status method
    service.update_analysis_status = AsyncMock()

    # Mock fetch_data to raise an exception
    service.fetch_data = AsyncMock(side_effect=ValueError("Test error"))

    # Mock handle_errors
    service.handle_errors = AsyncMock()

    # Call the method
    analysis_id = uuid.uuid4()
    resource_id = uuid.uuid4()
    integration_id = uuid.uuid4()

    now = datetime.utcnow()
    start_date = now - timedelta(days=30)
    end_date = now

    await service.run_analysis(
        analysis_id=analysis_id,
        resource_id=resource_id,
        integration_id=integration_id,
        analysis_type="CONTRIBUTION",
        period_start=start_date,
        period_end=end_date,
    )

    # Check that update_analysis_status was called
    service.update_analysis_status.assert_called_with(analysis_id=analysis_id, status=ReportStatus.IN_PROGRESS)

    # Check that fetch_data was called
    service.fetch_data.assert_called()

    # Check that handle_errors was called with the error
    service.handle_errors.assert_called_with(error=service.fetch_data.side_effect, analysis_id=analysis_id)
