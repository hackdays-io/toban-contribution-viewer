# Toban Contribution Viewer Development Guide

## Build & Run Commands
- Frontend: `npm run dev` (development), `npm run build` (production), `npm run preview` (preview build)
- Backend: `uvicorn app.main:app --reload` (development)

## Lint & Format Commands
- Frontend: `npm run lint`, `npm run format`, `npm run format:check`, `npm run typecheck`
- Backend: `black .`, `isort .`, `flake8`, `mypy .`

## Test Commands
- Frontend: `npm run test` (all tests), `npm run test:watch` (watch mode)
- Backend: `pytest` (all tests), `pytest tests/test_file.py::test_function` (single test)
- Coverage: `pytest --cov=app --cov-report=term-missing` (backend)

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

## Do test before creating new pull requests
- Run above test, lint, format, black, isort, flake8, mypy when you create new pull requests.
- Also run those tests when you push changes to the branch which already sent a pull request
