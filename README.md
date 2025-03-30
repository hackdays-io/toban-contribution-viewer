# Toban Contribution Viewer

Toban Contribution Viewer is an AI-powered analytics platform designed to extract, analyze, and visualize team contributions across digital workspaces. The platform connects to Slack, GitHub, and Notion via their APIs to collect activity data, processes it using AI to identify meaningful contributions, and presents actionable insights through an intuitive dashboard.

## Business Value

- **Recognize Hidden Contributors**: Identify team members whose valuable contributions might otherwise go unnoticed in traditional performance reviews
- **Improve Team Collaboration**: Gain insights into communication patterns and knowledge sharing
- **Optimize Workflows**: Discover bottlenecks and inefficiencies in your team's digital processes
- **Foster Recognition**: Create a culture of appreciation by highlighting diverse forms of contribution
- **Data-Driven Management**: Make informed decisions based on comprehensive contribution metrics rather than anecdotal evidence

## Technical Stack

- **Backend**: Python with FastAPI
- **Frontend**: React with TypeScript and Chakra UI
- **AI Processing**: OpenAI API (GPT-4)
- **Database**: PostgreSQL for structured data
- **Authentication**: Auth0
- **Hosting**: AWS

## Development Setup

This section provides detailed instructions for setting up the project for local development.

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 13+
- Git

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/hackdays-io/toban-contribution-viewer.git
   cd toban-contribution-viewer
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Copy the example environment variables file and configure it:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration using your preferred editor
   ```

5. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

6. Access the API documentation at http://localhost:8000/docs

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment variables file and configure it:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Access the application at http://localhost:5173

## Development Workflow

### Code Style and Linting

We use automated tools to ensure code consistency:

#### Backend

- **Black**: For code formatting
- **isort**: For import sorting
- **flake8**: For linting

Run these tools before committing:
```bash
cd backend
black .
isort .
flake8
```

#### Frontend

- **ESLint**: For linting
- **Prettier**: For code formatting
- **TypeScript**: For type checking

Run these tools before committing:
```bash
cd frontend
npm run lint
npm run format
npm run typecheck
```

### Testing

#### Backend Tests

Run the tests with pytest:
```bash
cd backend
pytest
```

For test coverage:
```bash
pytest --cov=app --cov-report=term-missing
```

#### Frontend Tests

Run the tests with Vitest:
```bash
cd frontend
npm test
```

For watching mode during development:
```bash
npm run test:watch
```

### Git Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, commit regularly with descriptive messages:
   ```bash
   git add .
   git commit -m "Add feature: description of changes"
   ```

3. Push your branch and create a pull request:
   ```bash
   git push -u origin feature/your-feature-name
   ```

4. Ensure CI checks pass and request a code review
5. After approval, merge your PR into `main`

## API Integrations

To fully use the application, you'll need to set up the following API integrations:

### Required API Keys

- **Slack API**: For accessing workspace activity
- **GitHub API**: For accessing repository contributions
- **Notion API**: For accessing document contributions
- **OpenAI API**: For AI-powered analysis

Refer to each platform's documentation for obtaining API keys. Add these keys to your `.env` files as described in the setup sections.

## Continuous Integration/Deployment

Our CI/CD pipeline is set up with GitHub Actions:

- **Pull Requests**: Automatically run tests, linting, and build checks
- **Main Branch**: Automated deployments to staging environment
- **Release Tags**: Automated deployments to production environment

## Troubleshooting

### Common Issues

1. **Backend dependency issues**: Make sure your Python version matches the requirements (3.12+)
2. **Frontend build errors**: Clear node_modules and reinstall dependencies
3. **Database connection issues**: Verify PostgreSQL is running and credentials are correct

### Getting Help

If you encounter issues not covered in this documentation:

1. Check existing GitHub issues
2. Create a new issue with detailed information about your problem
3. Reach out to the team on the project Slack channel

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.