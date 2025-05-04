# Docker Compose Integration Testing Framework Implementation Strategy

This document details the implementation strategy for the integration testing framework for the Toban Contribution Viewer project.

## 1. Purpose

The main purposes of this framework are:

- Enable complete end-to-end testing that connects frontend and backend
- Automatically verify actual user flows
- Provide a stable testing environment by mocking external dependencies (Slack API, OpenRouter API)
- Integrate with CI/CD pipelines for continuous quality assurance

## 2. Architecture

The proposed integration testing framework consists of the following components:

```
integration-tests/
├── docker-compose.test.yml     # Docker Compose configuration for testing
├── setup/                      # Test environment setup scripts
│   ├── init-db.sh              # Test database initialization
│   └── wait-for-services.sh    # Service startup wait script
├── mocks/                      # External service mocks
│   ├── slack-api/              # Slack API mock
│   │   ├── server.js           # Mock server
│   │   ├── data/               # Test data
│   │   └── Dockerfile          # Container definition
│   └── openrouter-api/         # OpenRouter API mock
│       ├── server.js           # Mock server
│       ├── data/               # Test data
│       └── Dockerfile          # Container definition
├── tests/                      # Test cases
│   ├── e2e/                    # E2E tests
│   │   ├── auth.spec.js        # Authentication flow
│   │   ├── slack.spec.js       # Slack integration flow
│   │   └── analysis.spec.js    # Analysis flow
│   └── api/                    # API tests
│       ├── slack.spec.js       # Slack API integration
│       └── teams.spec.js       # Team management API
├── utils/                      # Utility functions
│   ├── test-data-generator.js  # Test data generation
│   ├── auth-helper.js          # Authentication helper
│   └── slack-data-fetcher.js   # Actual Slack data fetching
├── Dockerfile.test-runner      # Test runner container definition
└── run-tests.sh                # Test execution script
```

## 3. Implementation Details

### 3.1 Docker Compose Configuration

The `docker-compose.test.yml` file defines a complete stack for the test environment:

```yaml
version: '3.8'

services:
  # Test PostgreSQL database
  postgres-test:
    image: postgres:13
    environment:
      - POSTGRES_USER=test_user
      - POSTGRES_PASSWORD=test_password
      - POSTGRES_DB=test_db
    ports:
      - "5433:5432"  # Port that doesn't conflict with the regular DB
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d test_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Mock Slack API
  slack-api-mock:
    build: ./mocks/slack-api
    ports:
      - "3001:3001"
    volumes:
      - ./mocks/slack-api/data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Mock OpenRouter API
  openrouter-api-mock:
    build: ./mocks/openrouter-api
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Backend service (test mode)
  backend-test:
    build:
      context: ../backend
      dockerfile: Dockerfile
    environment:
      - TESTING=True
      - DATABASE_URL=postgresql://test_user:test_password@postgres-test:5432/test_db
      - SLACK_API_BASE_URL=http://slack-api-mock:3001
      - OPENROUTER_API_URL=http://openrouter-api-mock:3002
      - FRONTEND_URL=http://frontend-test:5173
    ports:
      - "8001:8000"  # Port that doesn't conflict with the regular backend
    depends_on:
      postgres-test:
        condition: service_healthy
      slack-api-mock:
        condition: service_healthy
      openrouter-api-mock:
        condition: service_healthy
    volumes:
      - ../backend:/app:cached
      - /app/__pycache__

  # Frontend service (test mode)
  frontend-test:
    build:
      context: ../frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=http://backend-test:8000/api/v1
      - VITE_ENVIRONMENT=test
      - VITE_SUPABASE_URL=http://supabase-mock:9000
      - VITE_SUPABASE_ANON_KEY=test-key
    ports:
      - "5174:5173"  # Port that doesn't conflict with the regular frontend
    depends_on:
      - backend-test
    volumes:
      - ../frontend:/app:cached
      - /app/node_modules

  # Test runner
  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test-runner
    volumes:
      - ./tests:/tests
      - ./reports:/reports
    depends_on:
      - frontend-test
      - backend-test
    command: ["./wait-for-services.sh", "npm", "run", "test"]
```

### 3.2 Test Runner

We'll implement E2E tests using Playwright. The test runner Dockerfile will be as follows:

```dockerfile
FROM mcr.microsoft.com/playwright:latest

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy test scripts and utilities
COPY tests/ ./tests/
COPY utils/ ./utils/
COPY setup/ ./setup/
COPY playwright.config.js ./

# Grant execution permissions
RUN chmod +x ./setup/wait-for-services.sh

# Create reports directory
RUN mkdir -p /reports

CMD ["npm", "run", "test"]
```

### 3.3 Slack API Mock

The Slack API mock server will be implemented as an Express server that returns responses in the same format as the actual Slack API:

```javascript
// mocks/slack-api/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

// Load test data
const loadTestData = (filename) => {
  try {
    const dataPath = path.join(__dirname, 'data', filename);
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
    console.warn(`Warning: Test data file ${filename} not found`);
    return null;
  } catch (error) {
    console.error(`Error loading test data ${filename}:`, error);
    return null;
  }
};

// Channels list endpoint
app.get('/api/conversations.list', (req, res) => {
  const channelsData = loadTestData('channels.json') || {
    ok: true,
    channels: [
      { id: 'C12345', name: 'general', is_private: false },
      { id: 'C67890', name: 'random', is_private: false }
    ],
    response_metadata: { next_cursor: '' }
  };
  
  res.json(channelsData);
});

// Message history endpoint
app.get('/api/conversations.history', (req, res) => {
  const channelId = req.query.channel;
  const messagesData = loadTestData(`messages_${channelId}.json`) || {
    ok: true,
    messages: [
      { ts: '1620000000.000100', text: 'Hello world', user: 'U12345' },
      { ts: '1620000001.000200', text: 'Test message', user: 'U67890' }
    ],
    has_more: false
  };
  
  res.json(messagesData);
});

// User information endpoint
app.get('/api/users.info', (req, res) => {
  const userId = req.query.user;
  const usersData = loadTestData('users.json') || {
    users: [
      { id: 'U12345', name: 'testuser1', real_name: 'Test User 1' },
      { id: 'U67890', name: 'testuser2', real_name: 'Test User 2' }
    ]
  };
  
  const user = usersData.users.find(u => u.id === userId) || {
    id: userId,
    name: `unknown_${userId}`,
    real_name: `Unknown User (${userId})`
  };
  
  res.json({
    ok: true,
    user
  });
});

// OAuth authentication endpoint
app.post('/api/oauth.v2.access', (req, res) => {
  const oauthData = loadTestData('oauth.json') || {
    ok: true,
    app_id: 'A12345',
    authed_user: { id: 'U12345' },
    scope: 'channels:history,channels:read',
    token_type: 'bot',
    access_token: 'xoxb-test-token',
    bot_user_id: 'B12345',
    team: { id: 'T12345', name: 'Test Team', domain: 'test' },
    is_enterprise_install: false
  };
  
  res.json(oauthData);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Slack API mock server running on port ${PORT}`);
});
```

### 3.4 Slack Data Fetching Script

We'll implement a script to fetch test data from the actual Slack API:

```javascript
// utils/slack-data-fetcher.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const OUTPUT_DIR = path.join(__dirname, '..', 'mocks', 'slack-api', 'data');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Save data as JSON file
const saveData = (filename, data) => {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved data to ${filePath}`);
};

// Slack API client
const slackClient = axios.create({
  baseURL: 'https://slack.com/api',
  headers: {
    Authorization: `Bearer ${SLACK_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Fetch channel list
const fetchChannels = async () => {
  try {
    const response = await slackClient.get('/conversations.list', {
      params: {
        types: 'public_channel,private_channel',
        limit: 100,
      },
    });
    
    if (response.data.ok) {
      saveData('channels.json', response.data);
      return response.data.channels;
    } else {
      console.error('Error fetching channels:', response.data.error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching channels:', error.message);
    return [];
  }
};

// Fetch channel messages
const fetchMessages = async (channelId) => {
  try {
    const response = await slackClient.get('/conversations.history', {
      params: {
        channel: channelId,
        limit: 50,
      },
    });
    
    if (response.data.ok) {
      saveData(`messages_${channelId}.json`, response.data);
      return response.data.messages;
    } else {
      console.error(`Error fetching messages for channel ${channelId}:`, response.data.error);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching messages for channel ${channelId}:`, error.message);
    return [];
  }
};

// Fetch user information
const fetchUsers = async (userIds) => {
  const users = [];
  
  for (const userId of userIds) {
    try {
      const response = await slackClient.get('/users.info', {
        params: {
          user: userId,
        },
      });
      
      if (response.data.ok) {
        users.push(response.data.user);
      } else {
        console.error(`Error fetching user ${userId}:`, response.data.error);
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error.message);
    }
  }
  
  saveData('users.json', { users });
  return users;
};

// Create OAuth mock data
const createOAuthMock = () => {
  const oauthData = {
    ok: true,
    app_id: 'A12345',
    authed_user: { id: 'U12345' },
    scope: 'channels:history,channels:read',
    token_type: 'bot',
    access_token: 'xoxb-test-token',
    bot_user_id: 'B12345',
    team: { id: 'T12345', name: 'Test Team', domain: 'test' },
    is_enterprise_install: false
  };
  
  saveData('oauth.json', oauthData);
};

// Main function
const main = async () => {
  if (!SLACK_TOKEN) {
    console.error('Error: SLACK_TOKEN environment variable is required');
    process.exit(1);
  }
  
  console.log('Fetching Slack data for testing...');
  
  // Fetch channel list
  const channels = await fetchChannels();
  console.log(`Fetched ${channels.length} channels`);
  
  // Fetch messages from up to 5 channels
  const channelsToFetch = channels.slice(0, 5);
  const userIds = new Set();
  
  for (const channel of channelsToFetch) {
    console.log(`Fetching messages for channel: ${channel.name} (${channel.id})`);
    const messages = await fetchMessages(channel.id);
    console.log(`Fetched ${messages.length} messages`);
    
    // Collect user IDs from messages
    messages.forEach(msg => {
      if (msg.user) {
        userIds.add(msg.user);
      }
    });
  }
  
  // Fetch user information
  console.log(`Fetching information for ${userIds.size} users`);
  await fetchUsers([...userIds]);
  
  // Create OAuth mock data
  createOAuthMock();
  
  console.log('Data fetching complete!');
};

// Only run if script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
}

module.exports = {
  fetchChannels,
  fetchMessages,
  fetchUsers,
  createOAuthMock,
};
```

### 3.5 Test Execution Script

```bash
#!/bin/bash
# run-tests.sh

# Set environment variables
export TEST_ENV=integration

# Parse arguments
SKIP_DATA_FETCH=false
SKIP_CLEANUP=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --skip-data-fetch) SKIP_DATA_FETCH=true ;;
    --skip-cleanup) SKIP_CLEANUP=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Fetch test data (unless skipped)
if [ "$SKIP_DATA_FETCH" = false ]; then
  echo "Fetching test data from Slack API..."
  
  if [ -z "$SLACK_TOKEN" ]; then
    echo "Error: SLACK_TOKEN environment variable is required for data fetching"
    echo "Set it with: export SLACK_TOKEN=xoxb-your-token"
    echo "Or skip data fetching with: $0 --skip-data-fetch"
    exit 1
  fi
  
  node utils/slack-data-fetcher.js
  
  if [ $? -ne 0 ]; then
    echo "Error fetching test data"
    exit 1
  fi
fi

# Start test environment with Docker Compose
echo "Starting test environment..."
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
./setup/wait-for-services.sh

# Run tests
echo "Running tests..."
docker-compose -f docker-compose.test.yml run test-runner

# Save test results
TEST_EXIT_CODE=$?
echo "Saving test reports..."
mkdir -p ./reports
docker cp test-runner:/reports ./reports

# Clean up test environment (unless skipped)
if [ "$SKIP_CLEANUP" = false ]; then
  echo "Cleaning up test environment..."
  docker-compose -f docker-compose.test.yml down -v
fi

echo "Test execution complete!"
exit $TEST_EXIT_CODE
```

### 3.6 Service Wait Script

```bash
#!/bin/bash
# setup/wait-for-services.sh

# Maximum wait time (seconds)
MAX_WAIT=120
INTERVAL=5

# Check if backend is ready
wait_for_backend() {
  local url="http://backend-test:8000/api/v1/health"
  local elapsed=0
  
  echo "Waiting for backend to be ready..."
  
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -s $url > /dev/null; then
      echo "Backend is ready!"
      return 0
    fi
    
    echo "Backend not ready yet, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  
  echo "Timed out waiting for backend"
  return 1
}

# Check if frontend is ready
wait_for_frontend() {
  local url="http://frontend-test:5173"
  local elapsed=0
  
  echo "Waiting for frontend to be ready..."
  
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -s $url > /dev/null; then
      echo "Frontend is ready!"
      return 0
    fi
    
    echo "Frontend not ready yet, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  
  echo "Timed out waiting for frontend"
  return 1
}

# Wait for all services
wait_for_backend && wait_for_frontend

if [ $? -eq 0 ]; then
  echo "All services are ready!"
  exit 0
else
  echo "Failed to start all services"
  exit 1
fi
```

## 4. User Flows to Test

The following key user flows will be targeted for testing:

### 4.1 Authentication Flow

- User registration
- Login
- Team switching

### 4.2 Slack Integration Flow

- Connecting Slack workspace
- Channel synchronization
- Channel selection
- Message retrieval

### 4.3 Analysis Flow

- Running channel analysis
- Displaying analysis results
- Report generation

### 4.4 Team Management Flow

- Team creation
- Member invitation
- Permission management

## 5. CI/CD Integration

We'll add integration tests to the GitHub Actions workflow:

```yaml
name: Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Run integration tests
        env:
          SLACK_TOKEN: ${{ secrets.SLACK_TEST_TOKEN }}
        run: |
          cd integration-tests
          ./run-tests.sh
      
      - name: Upload test reports
        uses: actions/upload-artifact@v4
        with:
          name: integration-test-reports
          path: integration-tests/reports
```

## 6. Implementation Steps

The implementation of the integration testing framework will proceed in the following steps:

1. Set up the basic structure
   - Create the `integration-tests` directory
   - Create necessary subdirectories and files

2. Implement mock services
   - Implement Slack API mock server
   - Implement OpenRouter API mock server

3. Implement test data fetching script
   - Implement data retrieval functionality from Slack API
   - Manage and store test data

4. Create Docker Compose configuration
   - Define services for the test environment
   - Configure health checks and dependencies

5. Configure the test runner
   - Set up Playwright
   - Build the test execution environment

6. Implement E2E test cases
   - Test authentication flow
   - Test Slack integration flow
   - Test analysis flow

7. Implement API test cases
   - Test backend APIs
   - Test external service integrations

8. Integrate with CI/CD
   - Create GitHub Actions workflow
   - Configure test result reporting

## 7. Considerations

- **Mock Accuracy**: Mock services must be maintained to exactly match the actual APIs. When API specifications change, the mocks must also be updated.

- **Test Data Freshness**: Test data needs to be updated periodically to reflect actual use cases. Consider setting up jobs in the CI/CD pipeline to periodically refresh test data.

- **Environment Variable Management**: Environment variables used in the test environment should be managed in a `.env.test` file, with sensitive information stored as secrets in the CI/CD system.

- **Test Execution Time**: Strategies for optimizing test execution time are needed in the CI environment. Consider splitting or running in parallel tests that take a long time to execute.

- **Frontend Rendering**: Some UI components may not render correctly during test execution in headless browsers. In such cases, test environment-specific adjustments may be necessary.

## 8. Benefits

- **Complete End-to-End Testing**: Test the entire flow from frontend to backend and database
- **Stable Test Environment**: Control external dependencies through mock services
- **CI/CD Integration**: Automated test execution and report generation
- **Parallel Development Support**: Run tests without affecting the development environment
- **Comprehensive Coverage**: Cover all key user flows

## 9. Future Extensions

- **Performance Testing**: Add load testing and response time measurement
- **Accessibility Testing**: Accessibility checks for UI components
- **Security Testing**: Vulnerability scanning and penetration testing
- **Visual Regression Testing**: Snapshot testing to detect visual changes in the UI
- **Cross-Browser Testing**: Test execution across multiple browsers
