# Toban Contribution Viewer - Developer Guide

This document contains information and guides for developers working on the Toban Contribution Viewer project.

## Getting Started

### Prerequisites

- Node.js 16+ for frontend
- Python 3.9+ for backend
- Docker and Docker Compose for local development
- PostgreSQL 13 (provided in Docker setup)

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/hackdays-io/toban-contribution-viewer.git
   cd toban-contribution-viewer
   ```

2. Start the Docker containers:
   ```bash
   docker compose up -d
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

4. Install backend dependencies:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

5. Set up environment variables:
   - Create a `.env` file in the backend directory (see `.env.example` for required variables)
   - Create a `.env` file in the frontend directory (see `.env.example` for required variables)

## Development

### Running the Application

1. Start the backend:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Database Management

The project uses PostgreSQL with SQLAlchemy and Alembic for database management.

#### Resetting the Database (Development)

To reset the database for testing purposes, a utility script is provided:

```bash
cd backend
./scripts/reset_database.sh
```

This script will:
- Truncate all Slack-related tables (clearing data while preserving structure)
- Reset any sequence counters
- Preserve the database schema and Alembic version information

Use this when you want to start with a clean database without having to recreate the schema.

#### Database Migrations

To create a new migration:

```bash
cd backend
alembic revision --autogenerate -m "Description of changes"
```

To apply migrations:

```bash
cd backend
alembic upgrade head
```

### Testing

#### Backend Testing

```bash
cd backend
pytest
# Run with coverage report
pytest --cov=app --cov-report=term-missing
```

#### Frontend Testing

```bash
cd frontend
npm run test
# Watch mode
npm run test:watch
```

## Slack Integration

### Local Development with ngrok

For Slack OAuth to work in local development, you need a public URL that Slack can redirect to. We use ngrok for this:

1. Start ngrok on port 8000 (API) and 5173 (Frontend)
   ```bash
   ./scripts/start-ngrok.sh
   ```

2. Update your environment variables to use the ngrok URLs
   ```
   # Backend .env
   API_URL=https://your-ngrok-url.ngrok-free.app
   FRONTEND_URL=https://your-frontend-ngrok-url.ngrok-free.app
   ```

3. Update your Slack App configuration with the ngrok URLs
   - Redirect URL: https://your-frontend-ngrok-url.ngrok-free.app/auth/slack/callback

### Troubleshooting Slack Integration

If you're having issues with Slack integration:

1. Check the logs to see if the OAuth flow is completing successfully
2. Verify token storage and retrieval in the database
3. Use the "Refresh" button on the workspaces page to manually update metadata
4. Reset the database and try connecting again

## Code Organization

### Backend Structure

- `app/`: Main application code
  - `api/`: API endpoints
  - `core/`: Core functionality
  - `db/`: Database setup
  - `models/`: SQLAlchemy models
  - `services/`: Business logic
- `alembic/`: Database migrations
- `scripts/`: Utility scripts
- `tests/`: Unit and integration tests

### Frontend Structure

- `src/`: Source code
  - `components/`: React components
  - `context/`: React context providers
  - `lib/`: Utility libraries
  - `pages/`: Page components
  - `__tests__/`: Frontend tests

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.
