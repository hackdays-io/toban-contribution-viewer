# Toban Contribution Viewer

TeamInsight is an AI-powered analytics platform designed to extract, analyze, and visualize team contributions across digital workspaces. The platform connects to Slack, GitHub, and Notion via their APIs to collect activity data, processes it using AI to identify meaningful contributions, and presents actionable insights through an intuitive dashboard.

## Business Value

- **Recognize Hidden Contributors**: Identify team members whose valuable contributions might otherwise go unnoticed in traditional performance reviews
- **Improve Team Collaboration**: Gain insights into communication patterns and knowledge sharing
- **Optimize Workflows**: Discover bottlenecks and inefficiencies in your team's digital processes
- **Foster Recognition**: Create a culture of appreciation by highlighting diverse forms of contribution
- **Data-Driven Management**: Make informed decisions based on comprehensive contribution metrics rather than anecdotal evidence

## Core Features

### Data Collection & Integration
- Secure OAuth connections to Slack, GitHub, and Notion
- Configurable data collection parameters (date ranges, channels, repositories)
- Real-time and scheduled data synchronization
- Privacy-focused data handling with anonymization options

### AI-Powered Analysis
- Content classification by type and value (problem-solving, knowledge sharing, coordination)
- Contribution quality assessment based on context and impact
- Cross-platform activity correlation (e.g., Slack discussions leading to GitHub commits)
- Trend identification and anomaly detection
- Channel conversation analysis with LLM insights
- Topic extraction and contributor recognition
- Key discussion highlights and pattern identification

### Visualization & Reporting
- Interactive dashboards with customizable views
- Individual and team contribution profiles
- Time-series analysis of activity patterns
- Exportable reports for performance reviews

## Technical Stack

- **Backend**: Python with FastAPI
- **Frontend**: React with TypeScript and Chakra UI
- **AI Processing**: OpenRouter API (Claude, GPT-4, and other LLMs)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: Supabase Auth (open-source)
- **Hosting**: AWS

## Getting Started

### Prerequisites

- Option 1 (Docker):
  - Docker with compose plugin

- Option 2 (Local Development):
  - Python 3.9+
  - Node.js 18+
  - PostgreSQL 13+

- Supabase Account (for authentication)
  - Create an account at [supabase.com](https://supabase.com/)
  - Create a new project and enable authentication
  - Configure auth providers (email, GitHub, Google, etc.)

- API keys for:
  - Slack
  - GitHub
  - Notion
  - OpenRouter (for LLM access)

### Option 1: Docker Setup (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/hackdays-io/toban-contribution-viewer.git
   cd toban-contribution-viewer
   ```

2. Create environment files:
   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```

3. Edit the .env files with your configuration (Auth0, API keys, etc.)

4. Start the Docker containers using the helper script:
   ```bash
   # Make the script executable
   chmod +x ./docker-dev.sh

   # Start the containers
   ./docker-dev.sh start
   ```

5. Access the applications:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

6. Use the helper script for common operations:
   ```bash
   # Show logs
   ./docker-dev.sh logs

   # Run backend tests
   ./docker-dev.sh test-backend

   # Run frontend tests
   ./docker-dev.sh test-frontend

   # Execute commands in containers
   ./docker-dev.sh backend python -m pytest
   ./docker-dev.sh frontend npm run lint

   # Restart containers
   ./docker-dev.sh restart

   # Rebuild containers after dependency changes
   ./docker-dev.sh rebuild
   ```

7. Shut down the containers when done:
   ```bash
   ./docker-dev.sh stop
   ```

### Option 2: Local Development Setup

#### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

#### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Supabase Authentication Setup

This project uses Supabase for authentication, which is an open-source alternative to Auth0.

### Setting Up Supabase

1. Create an account at [supabase.com](https://supabase.com/)
2. Create a new project
3. Navigate to Authentication → Settings and configure:
   - Enable Email/Password sign-in
   - Configure redirect URLs (add http://localhost:5173/auth/callback for local development)
   - Optional: Enable social providers like GitHub and Google
4. Get your Supabase credentials:
   - Project URL: Found in Project Settings → API
   - Anon Key: Public API key found in Project Settings → API
   - Service Role Key: Found in Project Settings → API (keep this secret!)
   - JWT Secret: Found in Project Settings → API → JWT Settings
5. Add these credentials to your environment variables

### Authentication Flow

1. Users sign in through the login form or social providers
2. Supabase handles the authentication and returns a JWT token
3. The token is stored in the browser and sent with API requests
4. The backend validates the JWT using the JWT secret

## Database Structure

The application uses PostgreSQL with SQLAlchemy ORM for data modeling and Alembic for migrations.

### Database Setup

1. Initialize the database models:
   ```bash
   cd backend
   source venv/bin/activate
   alembic revision --autogenerate -m "Initial migration"
   ```

2. Apply migrations to create the database schema:
   ```bash
   alembic upgrade head
   ```

### Key Models

#### Slack Integration Models

- **SlackWorkspace**: Connected Slack workspaces
- **SlackChannel**: Channels within workspaces
- **SlackUser**: User profiles from Slack
- **SlackMessage**: Messages from Slack channels
- **SlackReaction**: Emoji reactions to messages
- **SlackAnalysis**: Analysis configurations and results
- **SlackContribution**: User contribution scores and insights

#### Relationships

- A Workspace has many Channels and Users
- A Channel contains many Messages
- A Message belongs to a Channel and a User
- A Message may have many Reactions
- An Analysis includes multiple Channels
- Contribution scores are calculated per User, Analysis, and optionally per Channel

Detailed model documentation can be found in the `backend/docs/models/` directory.

## Slack Integration

The Toban Contribution Viewer integrates with Slack to analyze team communication patterns and contributions.

### Required OAuth Scopes

When creating your Slack app, the following scopes are required for comprehensive contribution tracking:

#### Message Access:
- `channels:history` - Read messages and threads in public channels
- `groups:history` - Read messages and threads in private channels
- `im:history` - Access direct messages (optional, for 1:1 contributions)
- `mpim:history` - Access group direct messages

#### Channel Information:
- `channels:read` - View basic info about public channels
- `groups:read` - View basic info about private channels

#### User Information:
- `users:read` - Access basic user information
- `users.profile:read` - Access user profile details
- `team:read` - View basic workspace information

#### Reactions & Engagement:
- `reactions:read` - View emoji reactions (for measuring engagement)

#### Optional Scopes:
- `files:read` - Access files (if tracking document contributions)

**Note about search functionality**: The `search:read` scope is required for using Slack's search API, but this scope cannot be directly requested through the OAuth & Permissions page. Instead, the application will need to use the standard history scopes (`channels:history`, `groups:history`, etc.) to collect and index messages for searching within the application.

### Integration Flow

1. User authenticates via OAuth flow to grant workspace access
2. App periodically collects message and reaction data
3. AI analysis identifies patterns and valuable contributions
4. Metrics are displayed in the contribution dashboard

### Setup Process

1. Create a Slack app at [api.slack.com](https://api.slack.com/apps)
2. Configure OAuth scopes listed above
3. Set redirect URLs for OAuth flow
4. Install app to your workspace
5. After creating your Slack app, you'll need the client ID and client secret:
   - These will be entered directly in the application UI when connecting to Slack
   - No environment variables are needed for Slack credentials

### Using ngrok for Slack OAuth

Slack requires HTTPS URLs for OAuth redirects in production environments. For local development, you can use ngrok to create a secure HTTPS tunnel:

#### Step 1: Install ngrok
```bash
npm install -g ngrok
```

#### Step 2: Start Docker containers
```bash
docker compose up -d
```

#### Step 3: Start ngrok for the frontend
Use the provided script to start ngrok with your authtoken:

```bash
# Make the script executable if needed
chmod +x ./scripts/start-ngrok.sh

# Run the script with your authtoken
./scripts/start-ngrok.sh your_ngrok_authtoken

# Alternatively, create a .env.ngrok file with your token
echo "NGROK_AUTHTOKEN=your_ngrok_authtoken" > .env.ngrok
# If you have custom URL, specify NGROK_CUSTOM_DOMAIN (without https://)
echo "NGROK_CUSTOM_DOMAIN=your_ngrok_custom_app.com" >> .env.ngrok
./scripts/start-ngrok.sh
```

This will display an output showing your ngrok URL, for example:
```
Tunnel Status  app       online  https://xyz-123-abc.ngrok-free.app -> http://localhost:5173
```

#### Step 4: Configure Slack app
1. Go to [api.slack.com/apps](https://api.slack.com/apps) and select your app
2. Navigate to "OAuth & Permissions"
3. Add the ngrok URL to the "Redirect URLs" section:
   ```
   https://xyz-123-abc.ngrok-free.app/auth/slack/callback
   ```
   **IMPORTANT**: This URL should match the frontend callback route, not the API endpoint
4. Save changes

#### Step 5: Update environment variables
Create or edit your `.env.docker` file to include:
```
# Slack credentials
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

# ngrok URL (from the output of the ngrok command)
NGROK_URL=https://xyz-123-abc.ngrok-free.app

# Required for ngrok configuration
NGROK_AUTHTOKEN=your_ngrok_auth_token

# OpenRouter for LLM analytics
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3-opus:20240229
```

#### Step 6: Restart the containers
```bash
docker compose restart
```

#### Step 7: Test the OAuth flow
1. Navigate to the frontend at your ngrok URL (e.g., https://xyz-123-abc.ngrok-free.app)
2. Go to the Slack connection page
3. Click "Connect to Slack" to initiate the OAuth flow

#### Important notes
- The ngrok URLs change each time you restart ngrok unless you have a paid account with a reserved domain
- Remember to update both your Slack app settings and `.env.docker` file when the URLs change
- For persistent development, consider upgrading to ngrok Pro for fixed subdomains
- The frontend must be accessible via HTTPS for the complete OAuth flow to work correctly

### Sample App Manifest

For faster setup, you can use this app manifest (replace the placeholder URLs with your actual URLs). You can create a new app using a manifest by clicking "Create New App" in the Slack API dashboard, then selecting "From an app manifest":

```yaml
display_information:
  name: Toban Contribution Viewer
  description: Track and analyze team contributions across Slack
  background_color: "#4A154B"

features:
  bot_user:
    display_name: Toban
    always_online: false

oauth_config:
  redirect_urls:
    - https://your-app-domain.com/auth/slack/callback
    - http://localhost:5173/auth/slack/callback
    - https://your-ngrok-app-url.ngrok-free.app/auth/slack/callback
  scopes:
    bot:
      - channels:history
      - channels:read
      - groups:history
      - groups:read
      - im:history
      - mpim:history
      - reactions:read
      - users:read
      - users.profile:read
      - team:read
      - files:read

settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

After creating your app using the manifest, you'll need to:

1. Enable "Event Subscriptions" and configure request URL
2. Subscribe to Bot Events:
   - `message.channels`
   - `message.groups`
   - `reaction_added`
   - `team_join`
   - `user_change`

## Environment Variables Management

The project uses a structured approach to environment variables management to ensure proper configuration across environments.

### Docker Environment Variables

When using Docker, environment variables are managed through several files:

1. **Docker Compose Environment File**: All shared variables are defined in `.env.docker` which is used by Docker Compose
2. **Environment Example Files**: Example files (`.env.docker.example`) are provided as templates
3. **Variable Inheritance**: Environment variables can be passed from your host environment to override the defaults

To set up Docker environment variables:
```bash
# Copy the example file
cp .env.docker.example .env.docker

# Edit with your values
nano .env.docker  # or use any text editor
```

Required Docker environment variables:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: Database connection settings
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`: Supabase authentication settings
- `OPENAI_API_KEY`: For AI-powered analysis
- Integration variables (as needed):
  - Note: Slack credentials are now entered directly in the UI and not required as environment variables
  - `NGROK_URL`: Your ngrok HTTPS URL for development with Slack OAuth

### Backend Environment Variables

Backend environment variables are managed through:

1. **Configuration Definition**: All environment variables are defined in `app/config.py` using Pydantic for validation
2. **Environment Validation**: The application validates required variables at startup and logs warnings if any are missing
3. **Testing Utility**: A utility (`app/core/env_test.py`) is provided to check environment configurations
4. **Command-line Verification**: The `scripts/check_env.py` script can be used to verify environment variables before deployment

Required backend environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Application secret key for security
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`: Supabase authentication settings
- `OPENROUTER_API_KEY`: API key for LLM access via OpenRouter
- `OPENROUTER_DEFAULT_MODEL`: Default LLM model to use (e.g., `anthropic/claude-3-opus:20240229`)
- Note: Slack credentials are now entered directly in the UI and not required as environment variables

### Frontend Environment Variables

Frontend environment variables are managed through:

1. **Centralized Configuration**: All environment variables are accessed through the `src/config/env.ts` module
2. **Validation at Runtime**: The application validates required variables during initialization
3. **Build-time Verification**: The `npm run check-env` script verifies environment variables during build
4. **Typed Access**: Strongly-typed access to environment variables with proper error handling

Required frontend environment variables:
- `VITE_API_URL`: URL to the backend API
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Supabase authentication settings

## Deployment

The project uses GitHub Actions for continuous deployment to AWS.

### Backend Deployment

The backend is deployed to AWS Elastic Beanstalk:

1. Push to the `main` branch triggers the deployment workflow
2. Tests are run to ensure code quality
3. A deployment package is created and uploaded to Elastic Beanstalk
4. Environment variables are managed through the Elastic Beanstalk configuration

Required deployment secrets:
- `AWS_ACCESS_KEY_ID`: AWS access key with permissions for Elastic Beanstalk
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: The AWS region where your Elastic Beanstalk environment is located
- `EB_APPLICATION_NAME`: The name of your Elastic Beanstalk application
- `EB_ENVIRONMENT_NAME`: The name of your Elastic Beanstalk environment
- All the required backend environment variables for production

### Frontend Deployment

The frontend is deployed to AWS S3 and CloudFront:

1. Push to the `main` branch triggers the deployment workflow
2. A production build is created with environment variables
3. The build is uploaded to an S3 bucket
4. CloudFront cache is invalidated to serve the latest version

Required deployment secrets:
- `AWS_ACCESS_KEY_ID`: AWS access key with S3 and CloudFront permissions
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: The AWS region where your S3 bucket is located
- `S3_BUCKET_NAME`: The name of your S3 bucket for hosting
- `CLOUDFRONT_DISTRIBUTION_ID`: The ID of your CloudFront distribution
- `SITE_DOMAIN`: The domain name of your site
- All the required frontend environment variables for production

### Manual Deployment

You can also trigger deployments manually through the GitHub Actions interface using the workflow_dispatch event.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Code Quality and CI Checks

This project uses local CI check scripts to ensure code quality before pushing changes.

1. Run the CI checks:
   ```bash
   # Run checks on changed files only
   ./run-ci-checks.sh
   
   # Or run all checks regardless of changes
   ./run-ci-checks.sh --all
   ```

2. You can also run specific checks:
   ```bash
   # Frontend checks only
   ./frontend/scripts/run-ci-checks.sh
   
   # Backend checks only
   ./backend/scripts/run-ci-checks.sh
   ```

3. These checks mirror the GitHub Actions workflow and help catch issues early.

For more information on development practices, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
