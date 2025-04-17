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

#### Using Docker (Recommended)

The easiest way to run the application is using Docker:

```bash
# Make the script executable if needed
chmod +x docker-dev.sh

# Start the development environment
./docker-dev.sh start
```

This will start both the frontend and backend containers, along with a PostgreSQL database.

**Important Note about Environment Variables:** 
- The Docker containers read environment variables from the `.env.docker` file in the project root.
- You can check which environment variables are loaded by running:
  ```bash
  docker compose exec backend printenv | grep VARIABLE_NAME
  ```

#### Manual Setup

If you prefer to run the application without Docker:

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

#### Database Setup and Migrations

**IMPORTANT**: Always use Alembic migrations for database schema management. This is the only supported method for consistent schema management across all environments.

To apply all migrations and set up the database:

```bash
# Apply all migrations to bring database to latest schema
docker exec tobancv-backend alembic upgrade head

# Check current migration status
docker exec tobancv-backend alembic current

# View migration history
docker exec tobancv-backend alembic history
```

The current Alembic migration sequence is:
- `001`: Create Slack models
- `7d5c89f714c7`: Add workspace_metadata column
- `9b8d4568d5be`: Add channel analysis model
- `48a0524f84c5`: Fix SlackChannelAnalysis table
- `fe6424d2cda2`: Add team models
- `002_add_team_integrations_models`: Add team integrations models

#### Creating New Migrations

When making schema changes, create a new migration:

```bash
docker exec tobancv-backend alembic revision -m "description_of_changes"
```

Edit the generated file in `backend/alembic/versions/` to define your schema changes.

#### Direct Schema Creation Scripts (Development Only)

The repository contains direct schema creation scripts (`scripts/create_*.py`) which should **NOT** be used in production environments. These scripts are only for development convenience but can lead to inconsistencies compared to proper migrations.

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

### Code Quality and Pre-commit Hooks

This project uses pre-commit hooks to ensure code quality. These hooks automatically run checks before each commit to catch issues early in the development process.

#### Setup Pre-commit Hooks

1. Install pre-commit:
   ```bash
   pip install pre-commit
   ```

2. Install the git hooks:
   ```bash
   pre-commit install
   ```

#### Included Hooks

The pre-commit configuration includes:

- **Python Hooks**:
  - Black for code formatting
  - isort for import sorting

- **TypeScript/Frontend Hooks**:
  - TypeScript compiler for type checking
  - ESLint for linting
  - Prettier for code formatting
  - Special checks for Vite configuration

- **General Hooks**:
  - End of file fixer
  - YAML and JSON syntax checking
  - Large file prevention
  - Merge conflict detection

#### Running Hooks Manually

You can run all pre-commit hooks manually on all files:

```bash
pre-commit run --all-files
```

Or run a specific hook:

```bash
pre-commit run black --all-files
```

#### Bypassing Hooks (Emergency Only)

In rare cases, you may need to bypass the pre-commit hooks for emergency commits:

```bash
git commit --no-verify -m "Emergency commit message"
```

**Important**: Use this sparingly and only in genuine emergencies. Follow up with a proper fix as soon as possible.

For more details about the pre-commit setup, see [PRE-COMMIT.md](PRE-COMMIT.md).

## Slack Integration

### Local Development with ngrok

For Slack OAuth to work in local development, you need a public URL that Slack can redirect to. We use ngrok for this:

1. Start ngrok on port 5173 (Frontend)
   ```bash
   ./scripts/start-ngrok.sh your_ngrok_auth_token
   ```

2. Update your `.env.docker` environment file to use the ngrok URL:
   ```
   NGROK_URL=https://your-ngrok-url.ngrok-free.app
   ```

3. Start Docker using the `docker-dev.sh` script:
   ```bash
   ./docker-dev.sh start
   ```
   
   **IMPORTANT**: Always use the `--env-file .env.docker` flag with Docker Compose commands when using ngrok:
   ```bash
   docker compose --env-file .env.docker up -d
   ```

4. Update your Slack App configuration with the ngrok URLs
   - Redirect URL: https://your-ngrok-url.ngrok-free.app/auth/slack/callback

### Troubleshooting Slack Integration

If you're having issues with Slack integration:

1. Check the logs to see if the OAuth flow is completing successfully
2. Verify token storage and retrieval in the database
3. Use the "Refresh" button on the workspaces page to manually update metadata
4. Reset the database and try connecting again

## Troubleshooting

### Database Issues

If you encounter database issues:

1. Check migration status
```bash
docker exec tobancv-backend alembic current
```

2. Check database tables 
```bash
docker exec tobancv-postgres psql -U toban_admin -d tobancv -c "\dt"
```

3. Reset database (development only!)
```bash
docker exec tobancv-backend bash scripts/reset_database.sh
```

4. Reapply migrations
```bash
docker exec tobancv-backend alembic upgrade head
```

### Common Issues

- **Missing tables**: If models exist but tables are missing, make sure migrations have been applied properly with `alembic upgrade head`.
- **Migration errors**: Check for conflicts in migration dependencies or incorrect database state.
- **Mismatch between models and tables**: This usually indicates direct schema creation (via scripts) vs. proper migrations. Always use Alembic migrations.
- **Integration errors**: If you're having trouble with the integration context API, ensure both the `team`, `teammember`, and integration-related tables exist in the database.

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
