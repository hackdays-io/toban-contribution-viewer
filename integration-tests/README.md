# Integration Testing Framework

This directory contains the integration testing framework for the Toban Contribution Viewer application. The framework uses Docker Compose to set up a complete test environment with mock services for external dependencies.

## Directory Structure

```
integration-tests/
├── setup/                # Setup scripts for the test environment
├── mocks/                # Mock implementations of external services
│   ├── slack-api/        # Mock Slack API
│   └── openrouter-api/   # Mock OpenRouter API
├── tests/                # Test suites
│   ├── e2e/              # End-to-end tests with Playwright
│   └── api/              # API tests with pytest
└── utils/                # Utility functions for tests
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

### Running Tests

1. Start the test environment:

```bash
cd integration-tests
docker compose -f docker-compose.test.yml up -d
```

2. Run the tests:

```bash
docker compose -f docker-compose.test.yml run test-runner
```

3. View test results:

```bash
# E2E test results
open results/e2e-report/index.html

# API test results
cat results/api-results.xml
```

4. Shut down the test environment:

```bash
docker compose -f docker-compose.test.yml down
```

## Mock Services

### Mock Slack API

A simplified implementation of the Slack API that returns predefined responses for testing purposes. The mock API implements the following endpoints:

- `/api/conversations.list` - Returns a list of mock channels
- `/api/users.list` - Returns a list of mock users
- `/api/conversations.history` - Returns mock message history

### Mock OpenRouter API

A mock implementation of the OpenRouter API that returns predefined responses for LLM requests. This allows testing the analysis functionality without making actual API calls to OpenRouter.

## Test Runner

The test runner container is responsible for executing the tests against the test environment. It waits for all services to be ready before starting the tests and generates reports in JUnit XML and HTML formats.

## Adding New Tests

### E2E Tests

Add new Playwright test files to the `tests/e2e` directory. See the [Playwright documentation](https://playwright.dev/docs/intro) for more information.

### API Tests

Add new pytest test files to the `tests/api` directory. See the [pytest documentation](https://docs.pytest.org/en/stable/) for more information.
