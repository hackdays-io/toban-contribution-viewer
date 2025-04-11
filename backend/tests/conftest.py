"""
Pytest configuration file with shared fixtures.
"""

import asyncio
import os
from typing import AsyncGenerator
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.api.router import router as api_router
from app.db.base import Base
from app.db.session import get_async_db

# Set test environment variable
os.environ["TESTING"] = "True"

# Use an in-memory SQLite database for tests
TEST_SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create async engine for tests
test_engine = create_async_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)

# Create session factory
TestingSessionLocal = sessionmaker(
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """
    Create an instance of the default event loop for each test case.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def init_db():
    """
    Initialize database with tables before tests and drop them after.
    """
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Drop all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def db_session(init_db) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a new database session for a test.
    """
    session = TestingSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


@pytest.fixture(scope="function")
def override_get_db(db_session: AsyncSession):
    """
    Override the get_db dependency to use the test database.
    """

    # Create a non-async wrapper function
    async def _get_test_db():
        try:
            yield db_session
        finally:
            pass

    return _get_test_db


@pytest.fixture
def app(override_get_db):
    """
    Create a FastAPI test app with dependencies overridden.
    """
    app = FastAPI()
    app.include_router(api_router)

    # Override the get_async_db dependency
    app.dependency_overrides[get_async_db] = override_get_db

    yield app

    # Clear the override after test is done
    app.dependency_overrides.clear()


@pytest.fixture
def client(app):
    """
    Create a test client for the app.
    """
    from fastapi.testclient import TestClient

    return TestClient(app)


@pytest.fixture(scope="function")
def mock_slack_api_success():
    """
    Mock successful Slack API response.
    """
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "ok": True,
        "app_id": "A12345",
        "authed_user": {"id": "U12345"},
        "scope": "channels:history,channels:read",
        "token_type": "bot",
        "access_token": "xoxb-test-token",
        "bot_user_id": "B12345",
        "team": {"id": "T12345", "name": "Test Team", "domain": "test"},
        "is_enterprise_install": False,
    }

    with patch("requests.post", return_value=mock_response):
        yield


@pytest.fixture(scope="function")
def mock_slack_api_error():
    """
    Mock failed Slack API response.
    """
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"ok": False, "error": "invalid_code"}

    with patch("requests.post", return_value=mock_response):
        yield
