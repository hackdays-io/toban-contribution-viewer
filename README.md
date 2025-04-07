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

### Visualization & Reporting
- Interactive dashboards with customizable views
- Individual and team contribution profiles
- Time-series analysis of activity patterns
- Exportable reports for performance reviews

## Technical Stack

- **Backend**: Python with FastAPI
- **Frontend**: React with TypeScript and Chakra UI
- **AI Processing**: OpenAI API (GPT-4)
- **Database**: PostgreSQL for structured data
- **Authentication**: Supabase Auth (open-source)
- **Hosting**: AWS

## Getting Started

### Prerequisites

- Option 1 (Docker): 
  - Docker and Docker Compose
  
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
  - OpenAI

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
- `search:read` - For historical search features

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
5. Add Slack credentials to environment variables:
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
   - `SLACK_SIGNING_SECRET`

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
- `OPENAI_API_KEY`: For AI-powered analysis
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`: For Slack integration

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.