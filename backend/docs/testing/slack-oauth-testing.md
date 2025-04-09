# Testing Slack OAuth Integration

This document provides instructions for testing the Slack OAuth integration in both Docker and local development environments.

> **Note**: The automated tests currently have some known issues with database initialization and the self-referential relationship in the `SlackMessage` model. We'll fix these in upcoming pull requests. For now, manual testing is the most reliable method.

## Prerequisites

- A Slack App with appropriate OAuth scopes configured
- Environment variables set up with your Slack API credentials

## Testing with Docker

1. Ensure Docker is running on your machine.

2. Start the development environment:
   ```bash
   ./docker-dev.sh start
   ```

3. Run the backend tests for Slack OAuth:
   ```bash
   ./docker-dev.sh test-backend tests/api/v1/slack/test_oauth.py
   ```

4. For a more verbose output, add the `-v` flag:
   ```bash
   ./docker-dev.sh test-backend tests/api/v1/slack/test_oauth.py -v
   ```

5. For code coverage analysis:
   ```bash
   ./docker-dev.sh test-backend "tests/api/v1/slack/test_oauth.py --cov=app.api.v1.slack --cov-report=term-missing"
   ```

## Testing Locally

1. Activate your virtual environment:
   ```bash
   cd backend
   source venv/bin/activate
   ```

2. Install all required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the tests:
   ```bash
   pytest tests/api/v1/slack/test_oauth.py -v
   ```

## Manual Testing

For manual testing of the OAuth flow:

1. Setup a Slack App in [api.slack.com](https://api.slack.com/apps) with the following OAuth scopes:
   - `channels:history`, `channels:read`
   - `groups:history`, `groups:read`
   - `reactions:read`
   - `users:read`, `users.profile:read`
   - `team:read`

2. Set the OAuth Redirect URL in your Slack App to:
   - http://localhost:8000/api/v1/slack/oauth-callback
   - Note: We always use the backend URL for callbacks, even when initiated from the frontend

3. Add your Slack credentials to the `.env` file:
   ```
   SLACK_CLIENT_ID=your_client_id
   SLACK_CLIENT_SECRET=your_client_secret
   SLACK_SIGNING_SECRET=your_signing_secret
   API_URL=http://localhost:8000  # For local development
   ```

4. Start the backend and frontend servers.

5. Navigate to http://localhost:5173/dashboard/slack/connect

6. Click "Connect to Slack" to initiate the OAuth flow.

7. After authorization on Slack's site, you should be redirected back to the application.

8. Check the workspace list at http://localhost:5173/dashboard/slack/workspaces to verify your workspace was added.

## Troubleshooting

- If you see `ModuleNotFoundError: No module named 'asyncpg'` or `No module named 'greenlet'`, ensure these packages are installed:
  ```bash
  pip install asyncpg greenlet
  ```
  
- If using Docker, you may need to rebuild the containers:
  ```bash
  ./docker-dev.sh rebuild
  ```

- For database connection issues, verify the `DATABASE_URL` in your `.env` file.

- For errors during the OAuth flow, check the callback URL in your Slack App settings.

- Enable debug logs by setting `LOG_LEVEL=DEBUG` in your environment variables.

- If you see an error about "relation 'slackworkspace' does not exist", you need to run the database migrations:
  ```bash
  # In local development
  alembic upgrade head
  
  # In Docker
  ./docker-dev.sh backend alembic upgrade head
  ```

- If you encounter an error with the SlackMessage model's parent relationship:
  ```
  Column expression expected for argument 'remote_side'; got <built-in function id>.
  ```
  This is a known issue with the self-referential relationship definition that will be fixed in an upcoming PR.

## Known Issues and Future Improvements

1. **Self-referential relationship in SlackMessage model**: The parent-child relationship in the SlackMessage model needs to be fixed to properly reference the model's id column. The immediate workaround is to comment out the problematic relationship:

   ```python
   # Temporarily comment out the relationship to allow for testing
   # This will be fixed in a separate issue/PR
   # parent: Mapped[Optional["SlackMessage"]] = relationship(
   #     "SlackMessage", remote_side=["SlackMessage.id"], backref="replies"
   # )
   ```

2. **Database initialization in tests**: Proper handling of database setup/teardown is needed in the test environment. The current implementation uses SQLite with aiosqlite for in-memory testing, which is optimal for CI/CD environments. Make sure to install the aiosqlite package:

   ```bash
   pip install aiosqlite
   ```

3. **Mocking in async tests**: Mocking async database sessions is challenging due to the way FastAPI's dependency injection system works with async generators. We've implemented a solution where:

   - We use `MagicMock` and `AsyncMock` to create mock database sessions
   - We use `app.dependency_overrides` to override the get_async_db dependency
   - We create mock responses for Slack API calls
   
4. **Test Structure**: Some tests are temporarily skipped due to the complexity of properly mocking all async dependencies. We'll address these in future PRs with a more comprehensive approach to async testing.

These issues will be addressed in separate pull requests to improve test reliability. We recommend using manual testing for now to verify the OAuth flow works correctly in development environments.