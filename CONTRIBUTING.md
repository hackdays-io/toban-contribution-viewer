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

## Pre-commit Hooks

This project uses pre-commit hooks to ensure code quality. Please set them up before making any commits:

1. Install pre-commit:
   ```bash
   pip install pre-commit
   ```

2. Install the git hooks:
   ```bash
   pre-commit install
   ```

For more details about the pre-commit configuration, see [PRE-COMMIT.md](PRE-COMMIT.md).

## Pull Request Process

1. Fork the repository and create a new branch for your feature or bugfix.
2. Ensure your code follows the style guidelines (enforced by pre-commit hooks).
3. Make sure all tests pass.
4. Update any relevant documentation.
5. Submit a pull request with a clear description of the changes.

### Pull Request Checklist

Before submitting a pull request, please ensure:

- [ ] The code builds without errors or warnings
- [ ] Tests have been added or updated to cover your changes
- [ ] All existing tests pass
- [ ] The pre-commit hooks pass
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