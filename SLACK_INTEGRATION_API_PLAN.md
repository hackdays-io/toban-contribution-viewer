# Slack Integration API Modification Plan

## Overview
This document outlines the API changes required to implement uniqueness constraints for Slack integrations. It focuses on backend modifications to prevent duplicate integrations between the same team and Slack workspace.

## Current API Analysis

### Integration Creation Endpoints

1. **POST `/api/v1/integrations/slack`**
   - Current behavior: Creates a new Slack integration via OAuth
   - Response: Returns the created integration object
   - No validation for existing integrations with the same workspace ID

2. **Integration Service**
   - `SlackIntegrationService.create_from_oauth()` method
   - Creates integration record after successful OAuth
   - No checks for existing integrations with same workspace for team

### Workspace Identification

1. **OAuth Response Data**
   - Slack OAuth response contains:
     - `team.id`: Unique identifier for the Slack workspace
     - `team.name`: Name of the Slack workspace
     - `team.domain`: Domain of the Slack workspace (optional)
   - Currently stored in integration metadata but not used for uniqueness

## Required API Modifications

### 1. Database Model Changes

```python
# In app/models/integration.py - Integration model

# Add unique constraint or index for team_id and workspace_id combination
__table_args__ = (
    # Existing constraints...
    UniqueConstraint('owner_team_id', 'workspace_id', name='uix_team_workspace'),
)

# Add workspace_id column or ensure it exists in a consistent location
workspace_id = Column(String(255), nullable=True)  # Store Slack team.id here
```

### 2. Integration Service Modifications

```python
# In app/services/integration/slack.py

async def create_from_oauth(
    db: AsyncSession,
    team_id: UUID,
    user_id: str,
    auth_code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
) -> Tuple[Integration, Dict[str, Any]]:
    """Create a Slack integration from OAuth flow."""
    # Exchange code for token as before
    oauth_response = await slack_api.exchange_code(...)
    
    # Extract workspace info
    team_id_slack = oauth_response.get("team", {}).get("id")
    if not team_id_slack:
        raise ValueError("No team ID in Slack OAuth response")
    
    # Check for existing integration
    existing = await find_integration_by_workspace_id(
        db, team_id, team_id_slack
    )
    
    if existing:
        # Option 1: Update existing integration
        return await update_existing_integration(
            db, existing, oauth_response, user_id
        )
        
        # Option 2: Raise error about duplicate
        # raise IntegrationExistsError(
        #    "This Slack workspace is already connected to this team."
        # )
    
    # Continue with integration creation as before
    # ...
```

### 3. New Helper Methods

```python
async def find_integration_by_workspace_id(
    db: AsyncSession, team_id: UUID, workspace_id: str
) -> Optional[Integration]:
    """Find an existing integration by team and Slack workspace ID."""
    # Try direct lookup first if we have workspace_id column
    query = select(Integration).where(
        Integration.owner_team_id == team_id,
        Integration.workspace_id == workspace_id,
        Integration.service_type == IntegrationType.SLACK
    )
    
    result = await db.execute(query)
    integration = result.scalar_one_or_none()
    
    if integration:
        return integration
    
    # Fallback to metadata search if no direct column
    query = select(Integration).where(
        Integration.owner_team_id == team_id,
        Integration.service_type == IntegrationType.SLACK
    )
    
    result = await db.execute(query)
    integrations = result.scalars().all()
    
    # Search through metadata for workspace_id match
    for integration in integrations:
        metadata = integration.integration_metadata or {}
        if metadata.get("team_id") == workspace_id:
            return integration
    
    return None

async def update_existing_integration(
    db: AsyncSession, 
    integration: Integration,
    oauth_response: Dict[str, Any],
    user_id: str
) -> Tuple[Integration, Dict[str, Any]]:
    """Update an existing integration with new OAuth data."""
    # Update access tokens
    access_token = oauth_response.get("access_token")
    if not access_token:
        raise ValueError("No access token in OAuth response")
    
    # Update the credential
    for credential in integration.credentials:
        if credential.credential_type == CredentialType.OAUTH_TOKEN:
            credential.encrypted_value = access_token
            credential.updated_at = datetime.now()
            break
    else:
        # No credential found, create a new one
        new_credential = IntegrationCredential(
            integration_id=integration.id,
            credential_type=CredentialType.OAUTH_TOKEN,
            encrypted_value=access_token,
        )
        db.add(new_credential)
    
    # Update metadata if needed
    integration.integration_metadata = {
        **(integration.integration_metadata or {}),
        "team_id": oauth_response.get("team", {}).get("id"),
        "team_name": oauth_response.get("team", {}).get("name"),
        "last_updated_by": user_id,
        "last_updated_at": datetime.now().isoformat(),
    }
    
    # Update status to ACTIVE
    integration.status = IntegrationStatus.ACTIVE
    
    # Update last_used_at
    integration.last_used_at = datetime.now()
    
    await db.commit()
    
    return integration, oauth_response
```

### 4. API Endpoint Modifications

```python
@router.post(
    "/slack", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED
)
async def create_slack_integration(
    integration: SlackIntegrationCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: Dict = Depends(get_current_user),
):
    """Create a new Slack integration via OAuth."""
    # Permission checks remain the same
    
    try:
        # Attempt to create/update integration
        try:
            new_integration, _ = await SlackIntegrationService.create_from_oauth(...)
            
            # Commit and return as before
            await db.commit()
            return prepare_integration_response(new_integration)
            
        except IntegrationExistsError as e:
            # Handle duplicate integration error
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            )
            
    except ValueError as e:
        # Existing value error handling
        ...
        
    except Exception as e:
        # Existing exception handling
        ...
```

### 5. New Exception Class

```python
# In app/services/integration/base.py or a new exceptions.py file

class IntegrationError(Exception):
    """Base class for integration-related errors."""
    pass

class IntegrationExistsError(IntegrationError):
    """Error raised when attempting to create a duplicate integration."""
    pass
```

## API Response Modifications

### 1. Successful Update Response

For successful updates to existing integrations, return HTTP 200 (instead of 201) with a message indicating the integration was updated:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "My Slack Workspace",
  "status": "active",
  "service_type": "slack",
  "updated": true,
  "message": "Integration reconnected successfully",
  "owner_team": {
    "id": "456e4567-e89b-12d3-a456-426614174000",
    "name": "My Team"
  },
  "created_at": "2025-04-17T12:00:00Z",
  "updated_at": "2025-04-18T12:00:00Z"
}
```

### 2. Conflict Response

For rejected duplicate connections (if we choose that approach), return HTTP 409 Conflict:

```json
{
  "status": 409,
  "detail": "This Slack workspace is already connected to this team.",
  "existing_integration": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Slack Workspace"
  }
}
```

## Migration Considerations

1. **Handling Existing Duplicates**:
   - Create migration script to identify duplicate integrations
   - Choose primary integration to keep based on last_used_at or creation date
   - Update or archive duplicates

2. **Adding Workspace ID Column**:
   - Create migration to add workspace_id column if needed
   - Populate from metadata for existing records
   - Add indexes and constraints

## Testing Approach

1. **Unit Tests**:
   - Test `find_integration_by_workspace_id` with various scenarios
   - Test `update_existing_integration` to ensure proper updating
   - Test error handling for duplicates

2. **Integration Tests**:
   - Test full OAuth flow with new and existing workspaces
   - Verify correct responses for updates vs. creates
   - Test error handling and status codes

3. **API Contract Tests**:
   - Ensure backward compatibility of API responses
   - Verify all clients can handle new response fields

## Implementation Strategy

1. Start with database model changes and migrations
2. Implement service layer methods for checking and updating
3. Modify API endpoint to use new service methods
4. Add proper error handling and responses
5. Write tests to verify behavior
6. Update API documentation

## Rollout Considerations

1. This change may impact existing integrations if workspace IDs change
2. Consider implementing feature flag for gradual rollout
3. Monitor error rates during initial deployment
4. Prepare rollback plan for database constraints