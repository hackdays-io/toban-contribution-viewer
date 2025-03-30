# TeamInsight - Contribution Analytics Platform

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
- **Authentication**: Auth0
- **Hosting**: AWS

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL
- API keys for:
  - Slack
  - GitHub
  - Notion
  - OpenAI

### Backend Setup

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

### Frontend Setup

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

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.