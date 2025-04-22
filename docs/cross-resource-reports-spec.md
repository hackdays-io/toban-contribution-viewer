# Cross-Resource Reports Specification

## Overview

The Cross-Resource Reports feature will allow users to create comprehensive reports that span multiple resources (Slack channels, GitHub repositories, etc.) within a team. These reports will aggregate analyses from individual resources and generate an AI-powered comprehensive analysis that synthesizes insights across all resources.

## Goals

- Provide a holistic view of team activity across multiple platforms and resources
- Enable comparison of contributions and activity patterns across different resources
- Leverage LLM capabilities to generate insights that span multiple contexts
- Create a flexible foundation for future integration types beyond Slack

## Database Schema

### New Models

#### 1. CrossResourceReport

This represents a high-level report that spans multiple resources within a team.

```
CrossResourceReport
- id: UUID (PK)
- team_id: UUID (FK -> Team.id)
- title: String
- description: String (optional)
- created_at: DateTime
- updated_at: DateTime
- status: Enum ['pending', 'in_progress', 'completed', 'failed']
- date_range_start: DateTime
- date_range_end: DateTime
- report_parameters: JSONB (stores any additional parameters)
- comprehensive_analysis: Text (LLM-generated report combining insights from all resource analyses)
- comprehensive_analysis_generated_at: DateTime (when the comprehensive analysis was created)
- model_used: String (LLM model used for comprehensive analysis)
```

#### 2. ResourceAnalysis

This represents an analysis of a specific resource (e.g., Slack channel, GitHub repo) as part of a cross-resource report.

```
ResourceAnalysis
- id: UUID (PK)
- cross_resource_report_id: UUID (FK -> CrossResourceReport.id)
- integration_id: UUID (FK -> Integration.id)
- resource_id: UUID (FK -> Resource.id) 
- resource_type: Enum ['slack_channel', 'github_repo', 'notion_page', etc.]
- analysis_type: Enum ['contribution', 'topics', 'sentiment', etc.]
- status: Enum ['pending', 'in_progress', 'completed', 'failed']
- analysis_parameters: JSONB (store analysis configurations)
- results: JSONB (raw analysis results)
- created_at: DateTime
- updated_at: DateTime
- period_start: DateTime
- period_end: DateTime
- contributor_insights: Text (LLM analysis of contributors)
- topic_analysis: Text (LLM analysis of topics)
- resource_summary: Text (LLM summary of the resource)
- key_highlights: Text (LLM-identified key points)
- model_used: String (LLM model used)
- analysis_generated_at: DateTime
```

### Database Migrations

1. Create the `cross_resource_report` table
2. Create the `resource_analysis` table with appropriate foreign key constraints
3. Update any existing tables that need to reference these new entities

## API Endpoints

### Cross-Resource Reports

```
GET /api/v1/teams/{team_id}/cross-resource-reports
POST /api/v1/teams/{team_id}/cross-resource-reports
GET /api/v1/teams/{team_id}/cross-resource-reports/{report_id}
PUT /api/v1/teams/{team_id}/cross-resource-reports/{report_id}
DELETE /api/v1/teams/{team_id}/cross-resource-reports/{report_id}
```

### Resource Analyses

```
GET /api/v1/teams/{team_id}/cross-resource-reports/{report_id}/resource-analyses
POST /api/v1/teams/{team_id}/cross-resource-reports/{report_id}/resource-analyses
GET /api/v1/teams/{team_id}/cross-resource-reports/{report_id}/resource-analyses/{analysis_id}
```

### Report Generation

```
POST /api/v1/teams/{team_id}/cross-resource-reports/{report_id}/generate
GET /api/v1/teams/{team_id}/cross-resource-reports/{report_id}/status
```

## UI Flow

### 1. Create Cross-Resource Report Flow

#### Step 1: Initiate Report Creation
- Navigate to "Analytics" dashboard
- Click "Create Cross-Resource Report"
- Select a team (if applicable)

#### Step 2: Configure Report Parameters
- Set report title and description
- Select date range for analysis
- Configure global analysis parameters (e.g., include threads, include reactions)

#### Step 3: Select Resources to Analyze
- Display a list of available integrations (Slack workspaces, GitHub repositories, etc.)
- For each integration, allow selection of specific resources (channels, repos)
- Show previously selected resources as pre-selected for convenience

#### Step 4: Review and Submit
- Show summary of selections (date range, resources, parameters)
- Option to save configuration as a template for future runs
- Submit button to initiate the analysis process

### 2. Report Generation Process

1. System creates CrossResourceReport entry with status "pending"
2. System creates ResourceAnalysis entries for each selected resource with status "pending"
3. Background workers process each ResourceAnalysis:
   - Fetch data for the resource within date range
   - Generate resource-specific analysis using LLM
   - Update ResourceAnalysis status to "completed"
4. When all ResourceAnalysis entries are completed:
   - System generates comprehensive analysis using LLM by synthesizing insights across all resources
   - Updates CrossResourceReport status to "completed"

### 3. View Reports Flow

#### Primary Reports List
- Show list of all CrossResourceReports for the team
- Display status, creation date, title, and number of resources analyzed
- Allow filtering by status, date, and resource types

#### Cross-Resource Report Detail View
- Show report metadata (title, date range, creation date)
- Display the comprehensive analysis with visualizations:
  - Top contributors across resources
  - Common topics across resources
  - Activity patterns
  - Resource comparison charts
- Include tabs/sections for:
  - Executive summary
  - Contributor insights
  - Topic analysis
  - Resource comparisons
  - Individual resource analyses

#### Individual Resource Analysis View
- Access from the Cross-Resource Report detail view
- Show the specific analysis for a single resource
- Include resource-specific visualizations and insights

## LLM Prompting Strategy

### Resource Analysis Prompts
- Similar to existing SlackAnalysis prompts but generalized for different resource types
- Include resource-specific context (e.g., channel purpose, repo description)
- Generate insights specific to the resource type

### Comprehensive Analysis Prompts
- Input: Summaries and key insights from each individual resource analysis
- Goal: Synthesize cross-cutting insights that span multiple resources
- Focus areas:
  - Common contributors and their impact across resources
  - Thematic connections between different resources
  - Activity patterns and correlations
  - Recommendations that leverage cross-resource insights

## Technical Implementation Considerations

### Asynchronous Processing
- Use background workers for all analysis tasks
- Implement progress tracking and status updates
- Handle failures gracefully with retry mechanisms

### Data Aggregation
- Create services that can normalize and combine metrics across different resource types
- Define common metrics that make sense across resource types (e.g., activity, contributions)

### Performance and Scalability
- Implement parallel processing of individual resource analyses
- Consider batching strategies for LLM API calls
- Implement caching for frequently accessed reports and visualizations

## Future Extensions

### Scheduled Reports
- Allow users to schedule recurring cross-resource reports
- Automatically generate reports on a regular basis (weekly, monthly)
- Compare results over time

### Custom Report Templates
- Allow users to save and reuse report configurations
- Create predefined templates for common use cases (e.g., team activity, project health)

### Additional Resource Types
- GitHub pull requests and issues
- Notion pages and databases
- Jira issues and epics
- Custom data sources via API