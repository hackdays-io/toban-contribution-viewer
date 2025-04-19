# Slack Integration Uniqueness Constraints - UI Implementation Plan

## Overview

This document outlines the UI implementation plan for handling Slack integration uniqueness constraints. It addresses how the UI should handle duplicate integration attempts, error message displays, updates to integration management interfaces, and user flows for reconnecting existing integrations.

## 1. Handling Duplicate Integration Attempts

### 1.1 Duplicate Detection Flow

When a user attempts to connect a Slack workspace that's already integrated, we need to provide clear feedback and appropriate actions.

#### Implementation Details:

1. **Pre-connection Check:**
   - Add a new method to `integrationService.ts` to check if a workspace is already connected:

```typescript
/**
 * Check if a Slack workspace is already connected for a team
 */
async checkSlackWorkspaceExists(
  teamId: string, 
  workspaceId: string
): Promise<{ exists: boolean, integration?: Integration } | ApiError> {
  try {
    const headers = await this.getAuthHeaders();
    const url = `${this.apiUrl}/slack/check?team_id=${teamId}&workspace_id=${workspaceId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw response;
    }

    return await response.json();
  } catch (error) {
    return this.handleError(error, 'Failed to check workspace status');
  }
}
```

2. **OAuth Callback Enhancement:**
   - Modify `OAuthCallback.tsx` to handle duplicate workspace responses:

```typescript
// In handleCallback function after receiving OAuth response
if (result.status === 'duplicate_workspace') {
  setStatus('duplicate');
  setDuplicateData({
    integrationId: result.integration_id,
    workspaceName: result.workspace_name,
    teamName: result.team_name
  });
  return;
}
```

### 1.2 UI Updates for Duplicate Detection

Add a new state to the `OAuthCallback` component to handle duplicates:

```typescript
// Add to state declarations in OAuthCallback.tsx
const [status, setStatus] = useState<
  'loading' | 'success' | 'error' | 'duplicate'
>('loading');
const [duplicateData, setDuplicateData] = useState<{
  integrationId: string;
  workspaceName: string;
  teamName: string;
} | null>(null);

// Add to return JSX
{status === 'duplicate' && duplicateData && (
  <>
    <Alert status="warning" borderRadius="md">
      <AlertIcon />
      Workspace already connected
    </Alert>
    <Text>
      This Slack workspace "{duplicateData.workspaceName}" is already 
      connected to team "{duplicateData.teamName}".
    </Text>
    <VStack spacing={3} mt={4}>
      <Button
        as={Link}
        to={`/dashboard/integrations/${duplicateData.integrationId}`}
        colorScheme="blue"
        width="full"
      >
        View Existing Integration
      </Button>
      <Button
        as={Link}
        to="/dashboard/integrations"
        variant="outline"
        width="full"
      >
        Return to Integrations
      </Button>
    </VStack>
  </>
)}
```

## 2. Error Messages & Notifications

### 2.1 Standardized Error Messages

Define clear, user-friendly error messages for various uniqueness constraint scenarios:

| Scenario | Error Message | UI Location |
|----------|---------------|------------|
| Duplicate workspace | "This Slack workspace is already connected to team [Team Name]" | OAuthCallback component |
| Token expired/invalid | "Authentication token has expired. Please reconnect this workspace" | IntegrationDetail component |
| Permission error | "You don't have permission to connect this workspace to this team" | ConnectWorkspace component |
| Workspace limitation | "Your plan allows only [X] workspaces. Please upgrade to add more" | ConnectWorkspace component |

### 2.2 Toast Notification Implementation

Implement toast notifications for transient error states:

```typescript
// Add to ConnectWorkspace.tsx
const handleDuplicateError = (workspaceName: string, teamName: string) => {
  toast({
    title: 'Workspace already connected',
    description: `The workspace "${workspaceName}" is already connected to team "${teamName}"`,
    status: 'warning',
    duration: 5000,
    isClosable: true,
  });
};
```

### 2.3 Form Validation Enhancements

Add validation to the ConnectWorkspace component to prevent submission when issues are detected:

```typescript
// Add to ConnectWorkspace.tsx validateForm function
if (detectedDuplicate) {
  setGeneralError('This workspace is already connected to one of your teams');
  isValid = false;
}
```

## 3. Integration Management Interface Updates

### 3.1 IntegrationList Component Updates

Update the IntegrationList component to show connection status more clearly:

```typescript
// Add to IntegrationList.tsx getStatusWithReason function
const getStatusWithReason = (integration: Integration) => {
  if (integration.status === IntegrationStatus.ERROR) {
    // Check for specific error types in metadata
    const errorType = integration.metadata?.error_type;
    
    switch (errorType) {
      case 'token_revoked':
        return {
          label: 'Reconnection Required',
          description: 'Authentication token has been revoked',
          actionLabel: 'Reconnect',
          action: 'reconnect'
        };
      case 'token_expired':
        return {
          label: 'Token Expired',
          description: 'Authentication token has expired',
          actionLabel: 'Refresh Token',
          action: 'reconnect'
        };
      case 'duplicate_workspace':
        return {
          label: 'Duplicate Workspace',
          description: 'Connected to another team',
          actionLabel: 'View Details',
          action: 'view'
        };
      default:
        return {
          label: 'Error',
          description: 'Connection error',
          actionLabel: 'Fix Issues',
          action: 'settings'
        };
    }
  }
  
  return null;
};
```

### 3.2 IntegrationDetail Component Enhancements

Enhance the IntegrationDetail component to show workspace uniqueness information:

```typescript
// Add to IntegrationDetail.tsx
const renderUniqueConstraintInfo = () => {
  if (
    integration?.service_type === IntegrationType.SLACK &&
    integration?.metadata?.workspace_id
  ) {
    return (
      <Box mt={4} p={3} bg="gray.50" borderRadius="md">
        <Text fontWeight="bold">Workspace Uniqueness</Text>
        <Text fontSize="sm">
          Workspace ID: {integration.metadata.workspace_id}
        </Text>
        <Text fontSize="sm">
          This workspace can only be connected to one team at a time.
        </Text>
      </Box>
    );
  }
  return null;
};
```

### 3.3 Integration Filter for Duplicates

Add a filter to the IntegrationList to help identify potential duplicates:

```typescript
// Add to IntegrationList.tsx filter options
<Select
  placeholder="Status"
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
  width={{ base: '100%', md: '200px' }}
>
  <option value="">All Statuses</option>
  <option value="error_duplicate">Duplicate Error</option>
  <option value="active">Active</option>
  <option value="error">Error</option>
  <option value="disconnected">Disconnected</option>
</Select>
```

## 4. User Flow for Reconnecting Existing Integrations

### 4.1 Reconnection Dialog Component

Create a new `ReconnectIntegration` component for handling reconnection flows:

```typescript
// src/components/integration/ReconnectIntegration.tsx
import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { Integration, IntegrationType } from '../../lib/integrationService';

interface ReconnectIntegrationProps {
  integration: Integration;
  isOpen: boolean;
  onClose: () => void;
  onReconnect: (integration: Integration) => Promise<boolean>;
}

const ReconnectIntegration: React.FC<ReconnectIntegrationProps> = ({
  integration,
  isOpen,
  onClose,
  onReconnect,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleReconnect = async () => {
    setIsLoading(true);
    try {
      const success = await onReconnect(integration);
      if (success) {
        toast({
          title: 'Reconnection successful',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        onClose();
      } else {
        toast({
          title: 'Reconnection failed',
          description: 'Please try again or check your credentials',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Reconnection error',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Reconnect {integration.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="flex-start">
            <Text>
              This integration needs to be reconnected due to:
            </Text>
            <Text fontWeight="bold">
              {integration.metadata?.error_reason || 'Authentication issues'}
            </Text>
            <Text>
              Reconnecting will initiate a new authentication flow with{' '}
              {integration.service_type}. Any existing resources will be
              preserved.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleReconnect}
            isLoading={isLoading}
          >
            Reconnect
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReconnectIntegration;
```

### 4.2 Integration Detail Reconnection

Update `IntegrationDetail` to include reconnection options:

```typescript
// Add to IntegrationDetail.tsx
const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false);

const handleReconnect = async (integration: Integration) => {
  if (integration.service_type !== IntegrationType.SLACK) {
    return false;
  }
  
  try {
    // Store the integration ID for the OAuth callback to use
    sessionStorage.setItem('reconnect_integration_id', integration.id);
    
    // Get a new OAuth URL for this integration
    const oauthUrlResponse = await integrationService.getReconnectUrl(integration.id);
    
    if (integrationService.isApiError(oauthUrlResponse)) {
      throw new Error(oauthUrlResponse.message);
    }
    
    // Redirect to the OAuth URL
    window.location.href = oauthUrlResponse.url;
    return true;
  } catch (error) {
    console.error('Error in reconnect flow:', error);
    return false;
  }
};

// Add to render JSX
{needsReconnection && (
  <Button
    colorScheme="orange"
    leftIcon={<FiRefreshCw />}
    onClick={() => setIsReconnectModalOpen(true)}
    mb={4}
  >
    Reconnect Integration
  </Button>
)}

{/* Reconnection Modal */}
<ReconnectIntegration 
  integration={currentIntegration}
  isOpen={isReconnectModalOpen}
  onClose={() => setIsReconnectModalOpen(false)}
  onReconnect={handleReconnect}
/>
```

### 4.3 OAuthCallback Reconnection Flow

Update `OAuthCallback` to handle reconnection flows:

```typescript
// Add to OAuthCallback.tsx

// Check if this is a reconnection flow
const reconnectIntegrationId = sessionStorage.getItem('reconnect_integration_id');
const isReconnectionFlow = Boolean(reconnectIntegrationId);

// In the handleCallback function:
if (isReconnectionFlow && reconnectIntegrationId) {
  try {
    // Special API endpoint for reconnection
    const reconnectUrl = new URL(`${env.apiUrl}/integrations/${reconnectIntegrationId}/reconnect`);
    reconnectUrl.searchParams.append('code', code);
    
    const reconnectResponse = await fetch(reconnectUrl.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
    });
    
    if (!reconnectResponse.ok) {
      const errorData = await reconnectResponse.json();
      throw new Error(errorData.detail || 'Failed to reconnect integration');
    }
    
    const reconnectResult = await reconnectResponse.json();
    
    // Clear the reconnection ID
    sessionStorage.removeItem('reconnect_integration_id');
    
    setStatus('success');
    setSuccessMessage('Integration successfully reconnected!');
    
    // Navigate back to the integration detail page
    setTimeout(() => {
      navigate(`/dashboard/integrations/${reconnectIntegrationId}`);
    }, 2000);
    
    return;
  } catch (reconnectError) {
    console.error('Error reconnecting integration:', reconnectError);
    setStatus('error');
    setErrorMessage(
      reconnectError instanceof Error 
        ? reconnectError.message 
        : 'Failed to reconnect integration'
    );
    return;
  }
}
```

## 5. IntegrationService Enhancements

Add new methods to `integrationService.ts` to support uniqueness constraint handling:

```typescript
/**
 * Get a reconnection URL for an existing integration
 */
async getReconnectUrl(
  integrationId: string
): Promise<{ url: string } | ApiError> {
  try {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${this.apiUrl}/${integrationId}/reconnect-url`,
      {
        method: 'GET',
        headers,
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw response;
    }

    return await response.json();
  } catch (error) {
    return this.handleError(error, 'Failed to get reconnection URL');
  }
}

/**
 * Check for duplicate integrations by service criteria
 */
async checkDuplicateIntegrations(
  teamId: string,
  criteria: {
    service_type: IntegrationType;
    [key: string]: any;
  }
): Promise<{ duplicates: Integration[] } | ApiError> {
  try {
    const headers = await this.getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    queryParams.append('team_id', teamId);
    queryParams.append('service_type', criteria.service_type);
    
    // Add additional criteria to query params
    Object.entries(criteria)
      .filter(([key]) => key !== 'service_type')
      .forEach(([key, value]) => {
        queryParams.append(`criteria[${key}]`, value);
      });
    
    const response = await fetch(
      `${this.apiUrl}/check-duplicates?${queryParams.toString()}`,
      {
        method: 'GET',
        headers,
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw response;
    }

    return await response.json();
  } catch (error) {
    return this.handleError(error, 'Failed to check for duplicate integrations');
  }
}
```

## 6. Implementation Timeline and Dependencies

### Phase 1: Backend API Support
- Implement backend API endpoints for checking uniqueness constraints
- Add validation for duplicate workspace connections
- Implement reconnection API endpoints

### Phase 2: Error Handling Enhancement
- Update error handling in IntegrationContext
- Add detailed error messages for uniqueness violations
- Implement toast notifications

### Phase 3: UI Component Updates
- Update OAuthCallback to handle duplicates
- Create ReconnectIntegration component
- Enhance IntegrationList filters and statuses

### Phase 4: Testing and Refinement
- Test duplicate workspace scenarios
- Test reconnection flows
- Verify error messaging clarity

## 7. Conclusion

This implementation plan provides a comprehensive approach to handling Slack integration uniqueness constraints in the UI. By implementing these changes, we will:

1. Prevent duplicate workspace integrations with clear user feedback
2. Provide detailed error messages specific to the constraint violation
3. Enhance the integration management interfaces to highlight uniqueness status
4. Support seamless reconnection flows for broken or expired integrations

The changes focus on maintaining a positive user experience while enforcing the necessary backend uniqueness constraints, guiding users through appropriate actions when constraint violations occur.