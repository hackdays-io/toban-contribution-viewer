# Team Integrations Specification

This document outlines the data model and architecture for implementing team-based integrations (Slack, GitHub, Notion) that can be shared between teams.

## Overview

The Team Integrations feature allows team admins to set up service integrations (Slack, GitHub, Notion) that can be:
1. Owned by a specific team
2. Shared with other teams where the admin has privileges
3. Configured with granular resource-level permissions

## Data Model

### Core Entities

#### Integration

Central entity representing a connection to an external service.

```
Integration
- id: uuid (PK)
- name: string (user-friendly name, e.g., "Engineering GitHub")
- description: string (optional)
- service_type: enum (slack, github, notion)
- owner_team_id: uuid (FK to Team)
- status: enum (active, disconnected, expired, revoked)
- created_by_user_id: string (FK to User)
- created_at: timestamp
- updated_at: timestamp
- last_used_at: timestamp
- metadata: jsonb (service-specific metadata)
```

#### Integration Credentials

Separated from the main integration record for enhanced security.

```
IntegrationCredential
- id: uuid (PK)
- integration_id: uuid (FK to Integration)
- credential_type: enum (oauth_token, personal_token, api_key, app_token)
- encrypted_value: string (encrypted token/credential)
- expires_at: timestamp (null for non-expiring tokens)
- refresh_token: string (encrypted, if applicable)
- scopes: string[] (permissions granted)
- created_at: timestamp
- updated_at: timestamp
```

#### Integration Sharing

Manages how integrations are shared between teams.

```
IntegrationShare
- id: uuid (PK)
- integration_id: uuid (FK to Integration)
- team_id: uuid (FK to Team receiving access)
- shared_by_user_id: string (FK to User)
- share_level: enum (full_access, limited_access, read_only)
- status: enum (active, revoked, pending)
- created_at: timestamp
- updated_at: timestamp
- revoked_at: timestamp (null if active)
```

#### Service Resources

Represents specific resources within external services (repos, channels, etc.).

```
ServiceResource
- id: uuid (PK)
- integration_id: uuid (FK to Integration)
- external_id: string (ID in external service)
- resource_type: enum (repository, channel, page, database)
- name: string (human-readable name)
- metadata: jsonb (additional properties)
- created_at: timestamp
- updated_at: timestamp
- last_synced_at: timestamp
```

#### Resource Access Control

Controls which teams can access which resources.

```
ResourceAccess
- id: uuid (PK)
- resource_id: uuid (FK to ServiceResource)
- team_id: uuid (FK to Team)
- access_level: enum (read, write, admin)
- granted_by_user_id: string (FK to User)
- created_at: timestamp
- updated_at: timestamp
```

#### Integration Events/Audit Log

Tracks important events related to integrations.

```
IntegrationEvent
- id: uuid (PK)
- integration_id: uuid (FK to Integration)
- event_type: enum (created, shared, unshared, updated, disconnected)
- actor_user_id: string (FK to User)
- affected_team_id: uuid (FK to Team, optional)
- details: jsonb
- created_at: timestamp
```

### Service-Specific Metadata

#### Slack-Specific Fields (in metadata)

```json
{
  "workspace_id": "T12345678",
  "workspace_name": "Company Workspace",
  "workspace_domain": "company",
  "bot_user_id": "U87654321",
  "installed_channels": ["C12345", "C67890"],
  "default_channel": "C12345",
  "scopes": ["channels:read", "chat:write"]
}
```

#### GitHub-Specific Fields (in metadata)

```json
{
  "installation_id": 12345678,
  "account_login": "company-org",
  "account_type": "organization",
  "installation_url": "https://github.com/organizations/company-org/settings/installations/12345678",
  "app_permissions": {
    "contents": "read",
    "issues": "write",
    "pull_requests": "write"
  }
}
```

#### Notion-Specific Fields (in metadata)

```json
{
  "workspace_id": "abc123def456",
  "workspace_name": "Company Workspace",
  "bot_id": "xyz789",
  "default_page_id": "def456xyz789",
  "capabilities": ["read_content", "update_content", "create_content"]
}
```

## Key Workflows

### Integration Creation

1. Team admin initiates integration connection
2. Completes OAuth flow or enters credentials
3. Sets up initial configuration (name, description, etc.)
4. The system creates Integration, IntegrationCredential records
5. Initial resources are discovered and added as ServiceResource records

### Integration Sharing

1. Team admin views their team's integrations 
2. Selects "Share with team" option for an integration
3. Chooses another team where they have admin rights
4. Sets sharing level (full_access, limited_access, read_only)
5. System creates IntegrationShare record
6. Admin of receiving team gets notification

### Resource Configuration

1. Team admin (of owner or shared team) views available resources
2. Selects which resources their team needs access to
3. Configures access level for each resource
4. System creates/updates ResourceAccess records

### Integration Disconnection

1. Owner team admin initiates disconnection
2. System shows warning about impact on shared teams
3. Upon confirmation:
   - Update Integration status to "disconnected"
   - Revoke/delete credentials where possible
   - Notify all teams with access
   - Create IntegrationEvent records

## Authentication and Token Management

### Credential Security

1. All credentials stored encrypted at rest
2. Private keys and sensitive tokens never exposed in UI or logs
3. Credentials accessible only to backend services, not directly to clients

### Token Refresh

1. Background job checks for expiring tokens regularly
2. For OAuth tokens, uses refresh tokens to obtain new access tokens
3. For GitHub Apps, generates new JWT tokens as needed
4. Updates IntegrationCredential records with new tokens

### Token Failure Handling

1. If refresh fails, mark Integration as "expired"
2. Notify owner team admins
3. Provide re-authentication flow in UI
4. Track failed refresh attempts in logs

## Implementation Phases

### Phase 1: Core Model

1. Create database schema for Integration and IntegrationCredential
2. Implement basic CRUD operations
3. Add service-specific metadata handling

### Phase 2: Sharing Model

1. Implement IntegrationShare and permissions model
2. Add team selection UI for sharing
3. Create notification system for share events

### Phase 3: Resource Management

1. Implement ServiceResource and ResourceAccess
2. Add discovery mechanisms for each service type
3. Create resource selection UI

### Phase 4: Audit and Monitoring

1. Implement IntegrationEvent for audit trail
2. Add dashboards for integration health
3. Create admin tools for troubleshooting

## Security Considerations

1. Credential encryption using a secure key management service
2. RBAC controls based on team membership and roles
3. Audit logging for all sensitive operations
4. Rate limiting to prevent abuse
5. Regular credential rotation where supported

## Migration Strategy

1. Identify existing integrations in the current model
2. Create migration script to convert to new model
3. For each integration:
   - Create Integration record
   - Create IntegrationCredential record
   - Discover and create ServiceResource records
   - Set appropriate ownership and sharing
4. Run migration with validation steps
5. Implement backward compatibility for existing API endpoints

## Future Enhancements

1. Integration templates for common configurations
2. Usage analytics for each integration
3. Cost allocation features for paid service integrations
4. Health monitoring and automatic recovery
5. Support for additional service types
