# Contributing to Toban Contribution Viewer

Thank you for your interest in contributing to Toban Contribution Viewer! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to uphold our Code of Conduct, which requires treating all individuals with respect and creating a positive environment for everyone.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up the development environment** following the instructions in the README.md
4. **Create a feature branch** from the main branch for your changes

## Development Process

### Before You Start

1. Check the project's GitHub issues for related work
2. If you're planning a significant change, open an issue to discuss it first
3. Ensure your planned changes align with the project's goals and architecture

### Development Workflow

1. Keep your changes focused and related to a single issue or feature
2. Write clean, well-documented code
3. Include tests for new features or bug fixes
4. Follow the project's coding standards and patterns
5. Keep commits logically organized and with clear messages

### Pull Request Process

1. Update your fork with the latest changes from the main repository
2. Push your changes to your fork
3. Submit a pull request to the main repository
4. Include a clear title and description of your changes
5. Reference any related issues using GitHub's issue linking (e.g., "Fixes #123")
6. Be responsive to feedback and questions during the review process

## Coding Standards

### General Guidelines

- Follow the established patterns in the codebase
- Write self-documenting code with clear variable and function names
- Include comments for complex logic
- Ensure your code is well-tested

### Backend (Python)

- Follow PEP 8 style guidelines
- Use type hints
- Document functions and classes with docstrings
- Organize imports according to PEP 8 (standard library, third-party, local)

### Frontend (TypeScript/React)

- Follow ESLint and Prettier configurations
- Use TypeScript types/interfaces
- Follow React best practices (hooks, functional components, etc.)
- Keep components focused and maintainable
- CSS/styling should be consistent with the project's approach

## Testing

- Ensure all tests pass before submitting a pull request
- Add tests for new features
- Update tests for modified features
- Aim for high test coverage, especially for critical functionality

## Documentation

- Update documentation for any user-facing changes
- Document new features, configuration options, and APIs
- Keep code documentation up-to-date with implementation

## Commit Messages

Follow these guidelines for commit messages:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

Example:
```
Add Slack message analysis feature

- Implement message fetching from Slack API
- Add sentiment analysis for messages
- Create database schema for storing results

Fixes #123
```

## Questions?

If you have questions about contributing, please open an issue or reach out to the project maintainers.

Thank you for contributing to Toban Contribution Viewer!