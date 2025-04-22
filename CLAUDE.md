# Toban Contribution Viewer Development Guide

## Build & Run Commands
- Frontend: `npm run dev` (development), `npm run build` (production), `npm run preview` (preview build)
- Backend: `uvicorn app.main:app --reload` (development)

## Lint & Format Commands
- `./run-ci-checks.sh` cover all tests.
- `./run-ci-checks.sh --ci-compatible` will use same condition as the github CI settings.
- Frontend: `npm run lint`, `npm run format`, `npm run format:check`, `npm run typecheck`
- Backend: `black .`, `isort .`, `flake8`, `mypy .`

## Test Commands
- Frontend: `npm run test` (all tests), `npm run test:watch` (watch mode)
- Backend: `pytest` (all tests), `pytest tests/test_file.py::test_function` (single test)
- Coverage: `pytest --cov=app --cov-report=term-missing` (backend)

## Development
- For using python, use `source backend/venv/bin/activate`.

## Style Guidelines
- Frontend (TypeScript/React):
  - TypeScript for type safety
  - React hooks linting rules
  - 2-space indentation
  - Max line length: 100 characters
  - Imports sorted by module type
  
- Backend (Python/FastAPI):
  - Follow Black code style
  - Max line length: 120 characters
  - Max complexity: 10
  - Type annotations required
  - Exception handling with appropriate error codes

## Environment Setup
- Frontend: `npm run check-env` (verify environment variables)
- Backend: `python scripts/check_env.py` (verify environment variables)

## Development
- Backend: Activate venv before running python.

## Database Access
- The PostgreSQL database running in Docker can be accessed with these credentials:
  - Host: localhost
  - Port: 5432
  - Username: toban_admin
  - Password: postgres
  - Database: tobancv
  
- Connect using Docker:
  ```bash
  docker compose exec postgres psql -U toban_admin -d tobancv
  ```
  
- Execute SQL query through Docker:
  ```bash
  docker compose exec postgres psql -U toban_admin -d tobancv -c "SELECT * FROM slackuser LIMIT 5;"
  ```
  
- Alternative connection with external PostgreSQL client:
  ```
  postgresql://toban_admin:postgres@localhost:5432/tobancv
  ```

## CI Checks
- Always run CI checks using the CI-compatibility mode before pushing your code to GitHub:
  ```bash
  ./run-ci-checks.sh --ci-compatible --auto-fix
  ```
  This command will:
  - Automatically fix common issues like formatting and linting
  - Use the same configuration as GitHub Actions
  - Skip checks that aren't run in GitHub CI (like mypy)
  - Prevent CI failures in the GitHub workflow

- Options for CI checks:
  - `--all`: Run all checks regardless of which files changed
  - `--auto-fix`: Automatically fix common issues
  - `--ci-compatible`: Use the same configuration as GitHub Actions
  - `--skip-mypy`: Skip mypy type checking (included in --ci-compatible)

- Run these checks before:
  - Creating new pull requests
  - Pushing changes to branches with existing pull requests
