# Implementation Notes

This document outlines the implementation details for key features in the Toban Contribution Viewer.

## Issue #101: Authentication System Updates for Team Support

_Part of parent issue #88: Add Team Concept for Multi-Team Organization Support_

### Implementation Details

This issue involved enhancing the authentication system to support team-based access control and context switching. The implementation includes both backend and frontend changes to integrate team context into the auth flow.

#### Backend Implementation
1. **Enhanced JWT Tokens**
   - Modified `get_current_user` function to extract team context from token
   - Added team ID and role to JWT token claims
   - Created token refresh endpoint to update team context

2. **Team Context Management**
   - Added `get_user_team_context` function to load team data if not in token
   - Created `switch_team_context` function to switch user's current team
   - Implemented `create_token_with_team_context` to generate new JWT with team data

3. **Team Authentication Dependencies**
   - Created `TeamRequiredAuth` dependency class for role-based access control
   - Added predefined dependencies: `require_owner`, `require_admin`, `require_member`
   - Added verification for team membership and role requirements

4. **Team Auth API Endpoints**
   - Created new API routes in `/backend/app/api/v1/team/auth.py`:
     - `GET /teams/auth/context`: Get current user's team context
     - `POST /teams/auth/switch-team`: Switch to a different team
     - `POST /teams/auth/refresh-token`: Refresh JWT with current team context

#### Frontend Implementation
1. **Enhanced AuthContext**
   - Added team-related types: `TeamRole`, `Team`, `TeamContext`
   - Added team context state and setter functions
   - Implemented `loadTeamContext` to fetch team data from API
   - Created `switchTeam` function to change current team context
   - Updated auth initialization to load team context after login

2. **Team Context Components**
   - Created `TeamSwitcher` component to switch between teams
   - Added `TeamContext` component to display team information
   - Integrated components into Dashboard layout

3. **Team Utilities**
   - Added helper functions in `teamUtils.ts` for role-based access control:
     - `hasRequiredRole`: Check if user has required permissions
     - `canPerformAdminActions`: Check for admin privileges
     - `canViewTeamResources`: Check view permissions
     - `canEditTeamResources`: Check edit permissions
   - Added formatting utilities: `getRoleDisplayName` and `getRoleBadgeColorScheme`

### Migration Path
- Users without team assignments will be automatically assigned to a personal team
- Existing processes remain unaffected if team context is not used
- A default team is selected if the user has multiple teams

### Testing Plan
- Unit tests for team authentication dependencies
- Integration tests for team context API endpoints
- Frontend component tests for team switcher
- E2E test for team switching and context persistence

### Future Enhancements
- Team-specific settings and preferences
- Team invitation management in UI
- Custom team branding and themes
- Team access logs and audit trails

### Reference to Parent Issue #88
This implementation is part of the larger initiative to add a Team concept for multi-team organization support. The parent issue defines:

- Data model with Organization > Teams > Team Members & Integrations
- New UI navigation structure that's team-scoped
- Key features including team management, context switching, dashboards, cross-team analysis, and permissions
- Technical requirements and migration strategy
- Acceptance criteria for the complete feature set

## Slack Workspace Metadata

This section outlines the implementation of the service to retrieve and store basic workspace information after Slack OAuth connection.

## Components Implemented

### 1. Slack API Client (`/app/services/slack/api.py`)

- Created a robust Slack API client with error handling and rate limiting support
- Implemented methods for API requests with proper error handling
- Added specific methods for workspace info retrieval and token verification

### 2. Workspace Service (`/app/services/slack/workspace.py`)

- Implemented `WorkspaceService` to handle workspace metadata management
- Added methods to fetch and update workspace metadata from Slack API
- Implemented token verification functionality

### 3. Background Tasks (`/app/services/slack/tasks.py`)

- Added background tasks for periodic token verification
- Implemented scheduled metadata updates
- Setup task management in the application startup

### 4. OAuth Flow Enhancement (`/app/api/v1/slack/oauth.py`)

- Updated OAuth callback to retrieve basic workspace information
- Added background task to fetch additional metadata
- Enhanced workspace list endpoint to include metadata
- Added a token verification endpoint

### 5. Application Startup (`/app/main.py`)

- Implemented lifespan context manager for background tasks
- Added proper task cleanup on application shutdown

## Data Storage

The implementation uses the existing `SlackWorkspace` model with the following fields:

- `workspace_metadata`: JSON field for additional workspace data
- `icon_url`: URL to the workspace icon
- `team_size`: Number of users in the workspace

## Features

1. **Workspace Metadata Retrieval**: Fetches workspace name, icon, and team size
2. **Token Verification**: Regularly checks if tokens are still valid
3. **Error Handling**: Gracefully handles token expiration and API errors
4. **Background Processing**: Updates metadata without blocking user requests
5. **Manual Verification**: Added endpoint to manually verify tokens and refresh metadata

## Testing

Added comprehensive tests for:

- API client functionality with mocked responses
- Workspace service with dependency injection
- Token verification scenarios
- Error handling

## Next Steps

1. Enhance the frontend to display workspace icons and additional metadata
2. Add pagination for large workspaces when retrieving user data
3. Implement token refresh flow if Slack adds support for refresh tokens
4. Add more detailed workspace analytics and statistics

## Slack Channel Analysis Implementation

This section details the implementation of the LLM-powered Slack channel analysis feature.

### Architecture Overview

The channel analysis feature uses a layered architecture:

1. **API Layer** (`app/api/v1/slack/analysis.py`)
   - Handles HTTP requests and parameter validation
   - Orchestrates data retrieval from the database
   - Returns formatted responses

2. **Service Layer** 
   - **LLM Service** (`app/services/llm/openrouter.py`)
     - Manages communication with OpenRouter API
     - Formats prompts and processes responses
   - **Slack Message Service** (`app/services/slack/messages.py`)
     - Retrieves messages from selected channels
     - Processes message data for analysis

3. **Data Access Layer**
   - Uses SQLAlchemy models and queries to access the database
   - Retrieves message, user, and channel data

### Key Implementation Decisions

#### 1. Message Sampling Strategy

For channels with large volumes of messages:
- First 20 messages (chronologically)
- Middle 20 messages (for context)
- Last 20 messages (recent activity)

This ensures a representative sample while staying within token limits.

#### 2. Prompt Engineering Approach

The prompts are structured to:
- Clearly define the LLM's role as a communication analyst
- Provide specific, objective criteria for each analysis section
- Request specific evidence from the message data
- Focus on actionable insights over general observations

#### 3. Response Parsing

The LLM responses are parsed using section headings to extract:
- Channel summary
- Topic analysis
- Contributor insights
- Key highlights

#### 4. Error Handling and Resilience

The implementation includes:
- Retry logic for API failures
- Graceful degradation if certain analysis sections fail
- Comprehensive error messages for debugging

### Future Enhancements

Planned implementation improvements:
1. Response caching with TTL to reduce API costs
2. Asynchronous processing for large channels
3. Progressive rendering of results as they become available
4. More granular control over analysis focus areas

### Technical Debt and Considerations

1. **Token Management**
   - Currently uses simple sampling; could implement more sophisticated relevance-based selection

2. **Cost Optimization**
   - Consider implementing a job queue for batching analysis requests

3. **Result Storage**
   - May need to implement a storage solution for analysis results as usage grows

4. **Security Considerations**
   - LLM prompts and responses should be monitored to prevent data leakage
