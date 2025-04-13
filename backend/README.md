# Toban Contribution Viewer Backend

This is the backend service for the Toban Contribution Viewer, built with FastAPI and PostgreSQL.

## Local Development

### Prerequisites

- Python 3.9+
- PostgreSQL 13+
- Docker with Compose plugin (recommended)

### Setup with Docker (Recommended)

1. Make sure Docker is running on your system.

2. From the project root directory:
   ```bash
   docker compose up
   ```

3. The backend API will be available at http://localhost:8000.
   - API Documentation: http://localhost:8000/docs
   - ReDoc Alternative: http://localhost:8000/redoc

### Accessing the PostgreSQL Database

When running in Docker, the PostgreSQL database can be accessed with:

- **Connection Details**:
  - Host: localhost
  - Port: 5432
  - Username: toban_admin
  - Password: postgres
  - Database: tobancv

- **Connect via Docker**:
  ```bash
  docker compose exec postgres psql -U toban_admin -d tobancv
  ```

- **Run Queries via Docker**:
  ```bash
  docker compose exec postgres psql -U toban_admin -d tobancv -c "SELECT * FROM slackuser LIMIT 5;"
  ```

- **Connection URI** (for database clients):
  ```
  postgresql://toban_admin:postgres@localhost:5432/tobancv
  ```

### Manual Setup (Without Docker)

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

## Testing

Run tests with pytest:

```bash
# Run all tests
pytest

# Run specific tests
pytest tests/test_file.py::test_function

# With coverage report
pytest --cov=app --cov-report=term-missing
```

## API Documentation

When the server is running, access the auto-generated OpenAPI documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Features

### Slack Integration

The backend provides robust integration with Slack workspaces:

- OAuth-based workspace connection
- Channel management
- Message syncing and retrieval
- Thread support

### LLM-Powered Analytics

The application uses large language models via OpenRouter to provide analytics:

- Channel communication analysis
- Topic identification
- Contributor insights
- Key conversation highlights

For details, see:
- [OpenRouter Integration](./docs/integrations/openrouter.md)
- [Channel Analysis API](./docs/api/channel-analysis.md)

## Environment Variables

In addition to the database configuration, you'll need to set the following environment variables:

```
# Slack API credentials
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret

# OpenRouter (for LLM analytics)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3-opus:20240229
OPENROUTER_MAX_TOKENS=4000
OPENROUTER_TEMPERATURE=0.7
```
