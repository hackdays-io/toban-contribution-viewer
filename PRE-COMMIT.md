# Pre-commit Hook Configuration

This project uses pre-commit hooks to ensure code quality and consistency. These hooks run automatically before each commit to catch issues early.

## Setup

To install the pre-commit hooks, run:

```bash
pip install pre-commit
pre-commit install
```

This will set up the git hooks to run checks before each commit.

## Included Hooks

The pre-commit configuration includes the following checks:

### For All Files:
- End of file fixer (ensures files end with a newline)
- YAML and JSON syntax checkers
- Large file checker (prevents accidentally committing large files)
- Merge conflict detection
- Private key detection

### For Backend (Python):
- Black formatter (code formatting)
- isort (import sorting)
- flake8 for linting with multiple plugins
- mypy for static type checking
- bandit for security vulnerability scanning

### For Frontend (TypeScript/JavaScript):
- TypeScript compiler check
- ESLint (code linting)
- Prettier (code formatting)
- Special check for Vite configuration

## Bypassing Hooks (Emergency Only)

In some cases, you may need to bypass the pre-commit hooks for emergency commits. Use this sparingly:

```bash
git commit --no-verify -m "Your emergency commit message"
```

## Common Issues and Solutions

### Using CI Check Scripts with Auto-Fix

For a more streamlined approach to fixing common issues, you can use the CI check scripts with the `--auto-fix` option:

```bash
# Fix issues in both frontend and backend (only for changed files)
./run-ci-checks.sh --auto-fix

# Fix issues in frontend only
./frontend/scripts/run-ci-checks.sh --auto-fix

# Fix issues in backend only
./backend/scripts/run-ci-checks.sh --auto-fix
```

This will automatically fix:
- Formatting issues (Prettier for frontend, Black for backend)
- Linting issues (ESLint for frontend, simple flake8 issues for backend)
- Import sorting issues (isort for backend)

For more complex issues that cannot be fixed automatically, you'll still need to resolve them manually.

### TypeScript Errors

If you see TypeScript errors, the error message will tell you exactly what line and file needs to be fixed. For example:

```
TypeScript Check failed...
frontend/vite.config.ts:49:19 - error TS2339: Property 'proxy' does not exist on type '...'
```

Solution: Fix the TypeScript type issues or use proper type definitions.

### ESLint Errors

ESLint errors indicate code quality issues. To fix them:

```bash
cd frontend && npm run lint -- --fix
```

### Prettier Formatting Issues

If the pre-commit hook fails due to Prettier formatting issues, you can fix them with:

```bash
cd frontend && npm run format
```

## Updating the Hooks

To update the pre-commit hooks to the latest versions:

```bash
pre-commit autoupdate
```

## Custom Scripts

The pre-commit configuration uses several custom scripts located in:
- `frontend/scripts/check-vite-config.sh` - Special check for Vite configuration

## CI Integration

Note that additional checks disabled in pre-commit are still run in CI. These include:
- flake8 (Python linting)
- mypy (Python type checking)
- bandit (Python security scanning)