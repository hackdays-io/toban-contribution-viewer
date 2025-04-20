# Contributing to Toban Contribution Viewer

Thank you for your interest in contributing to Toban Contribution Viewer! This document outlines the process for contributing to this project.

## Code of Conduct

Please help us maintain a positive and inclusive environment by following our code of conduct:

- Be respectful and considerate of others
- Use inclusive language and respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community

## Development Setup

Please refer to the [DEVELOPMENT.md](DEVELOPMENT.md) file for detailed setup instructions.

## Code Quality Checks

> **Note**: We are transitioning away from pre-commit hooks to CI check scripts. The pre-commit hooks are being phased out in favor of a more flexible approach.

### CI Check Scripts (Recommended)

We recommend using the CI check scripts to verify your changes before committing. These scripts mirror the GitHub Actions workflows and provide more flexibility:

```bash
# Run checks on changed files only
./run-ci-checks.sh

# Run all checks regardless of what has changed
./run-ci-checks.sh --all

# Automatically fix common issues with formatting and linting
./run-ci-checks.sh --auto-fix
```

These scripts provide several advantages:
- They only run checks for the parts of the codebase that changed
- They can automatically fix many common issues with the `--auto-fix` option
- They match the checks that will run in CI, ensuring consistency

### Removing Pre-commit Hooks

If you have pre-commit hooks installed and want to remove them, run:

```bash
./scripts/remove-pre-commit.sh
```

For more details about the previous pre-commit configuration, see [PRE-COMMIT.md](PRE-COMMIT.md).

## Pull Request Process

1. Fork the repository and create a new branch for your feature or bugfix.
2. Ensure your code follows the style guidelines (verified with the CI check scripts).
3. Make sure all tests pass.
4. Update any relevant documentation.
5. Submit a pull request with a clear description of the changes.

### Pull Request Checklist

Before submitting a pull request, please ensure:

- [ ] The code builds without errors or warnings
- [ ] Tests have been added or updated to cover your changes
- [ ] All existing tests pass
- [ ] The CI check scripts pass (`./run-ci-checks.sh`)
- [ ] Documentation has been updated if necessary
- [ ] The PR title clearly describes the change
- [ ] The PR description explains why the change is necessary and how it works

## Commit Message Guidelines

Use clear and descriptive commit messages:

- Start with a concise summary line (50 characters or less)
- If necessary, provide more detailed explanations in subsequent lines
- Reference issue numbers if applicable (e.g., "Fixes #123")

## Issue Reporting

When reporting issues, please include:

1. A clear and descriptive title
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots or code snippets if applicable
6. Environment details (OS, browser, versions, etc.)

## Code Style Guidelines

This project follows specific style guidelines for different parts of the codebase:

### Backend (Python)

- We use [Black](https://black.readthedocs.io/) for code formatting
- [isort](https://pycqa.github.io/isort/) for import ordering with the Black profile
- Type annotations are required for function parameters and returns
- Maximum line length is 120 characters

### Frontend (TypeScript/React)

- We use [ESLint](https://eslint.org/) for linting
- [Prettier](https://prettier.io/) for code formatting
- Two-space indentation
- Maximum line length is 100 characters
- Use functional components with hooks instead of class components
- Use TypeScript types/interfaces for all components and functions

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).