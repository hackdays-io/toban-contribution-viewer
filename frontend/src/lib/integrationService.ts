/**
 * Integration API Service
 * Handles all communication with the integration endpoints of the backend API
 */

import env from '../config/env'
import { supabase } from './supabase'

// Types for integration service
export enum IntegrationType {
  SLACK = 'slack',
  GITHUB = 'github',
  NOTION = 'notion',
  DISCORD = 'discord',
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  DISCONNECTED = 'disconnected',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error',
}

export enum ShareLevel {
  FULL_ACCESS = 'full_access',
  LIMITED_ACCESS = 'limited_access',
  READ_ONLY = 'read_only',
}

export enum ResourceType {
  // Slack resources
  SLACK_CHANNEL = 'slack_channel',
  SLACK_USER = 'slack_user',
  SLACK_EMOJI = 'slack_emoji',

  // GitHub resources
  GITHUB_REPOSITORY = 'github_repository',
  GITHUB_ISSUE = 'github_issue',
  GITHUB_PR = 'github_pr',
  GITHUB_WEBHOOK = 'github_webhook',

  // Notion resources
  NOTION_PAGE = 'notion_page',
  NOTION_DATABASE = 'notion_database',
  NOTION_BLOCK = 'notion_block',

  // Discord resources
  DISCORD_GUILD = 'discord_guild',
  DISCORD_CHANNEL = 'discord_channel',
}

export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

// Basic team and user info
export interface TeamInfo {
  id: string
  name: string
  slug: string
}

export interface UserInfo {
  id: string
  email?: string
  name?: string
}

// Integration data types
export interface Integration {
  id: string
  name: string
  description?: string
  service_type: IntegrationType
  status: IntegrationStatus
  metadata?: Record<string, unknown>
  last_used_at?: string

  owner_team: TeamInfo
  created_by: UserInfo
  created_at: string
  updated_at: string

  credentials?: CredentialInfo[]
  resources?: ServiceResource[]
  shared_with?: IntegrationShare[]
}

export interface ServiceResource {
  id: string
  integration_id: string
  resource_type: ResourceType
  external_id: string
  name: string
  metadata?: Record<string, unknown>
  last_synced_at?: string
  created_at: string
  updated_at: string
}

export interface IntegrationShare {
  id: string
  integration_id: string
  team_id: string
  share_level: ShareLevel
  status: string
  revoked_at?: string
  shared_by: UserInfo
  team: TeamInfo
  created_at: string
  updated_at: string
}

export interface ResourceAccess {
  id: string
  resource_id: string
  team_id: string
  access_level: AccessLevel
  granted_by: UserInfo
  team: TeamInfo
  created_at: string
  updated_at: string
}

export interface CredentialInfo {
  id: string
  credential_type: string
  expires_at?: string
  scopes?: string[]
  created_at: string
  updated_at: string
}

// Request types
export interface CreateIntegrationRequest {
  name: string
  service_type: IntegrationType
  description?: string
  team_id: string
}

export interface CreateSlackIntegrationRequest
  extends CreateIntegrationRequest {
  service_type: IntegrationType.SLACK
  code: string
  redirect_uri: string
}

export interface UpdateIntegrationRequest {
  name?: string
  description?: string
  status?: IntegrationStatus
  metadata?: Record<string, unknown>
}

export interface IntegrationShareRequest {
  team_id: string
  share_level: ShareLevel
}

export interface ResourceAccessRequest {
  team_id: string
  access_level: AccessLevel
}

// Error types
export interface ApiError {
  status: number
  message: string
  details?: unknown
}

/**
 * Integration Service class
 */
class IntegrationService {
  private apiUrl: string

  constructor() {
    this.apiUrl = `${env.apiUrl}/integrations`

    // Log the API URL for debugging purposes
    if (env.isDev) {
      console.log('IntegrationService initialized with API URL:', this.apiUrl)

      // Check if API URL is relative or absolute
      if (!env.apiUrl.startsWith('http') && !env.apiUrl.startsWith('https')) {
        console.log(
          'Using relative API URL. For local development, make sure your backend is running correctly.'
        )
        console.log(
          'Full API URL resolved to:',
          window.location.origin + env.apiUrl + '/integrations'
        )
      }
    }
  }

  /**
   * Helper method to create auth headers
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    console.log('Getting auth headers for API request...');
    const {
      data: { session },
    } = await supabase.auth.getSession()
    
    // Debug auth session details
    console.log('Auth session exists:', !!session);
    console.log('Auth session status:', session ? 'Active' : 'Null or undefined');
    
    if (!session) {
      console.error('No active auth session found when preparing API request!');
    } else {
      console.log('Session user:', session.user?.email);
      console.log('Token expires at:', new Date(session.expires_at * 1000).toISOString());
      console.log('Token valid?', new Date(session.expires_at * 1000) > new Date());
    }
    
    const token = session?.access_token
    console.log('Access token exists:', !!token);
    
    if (token) {
      console.log('Token length:', token.length);
      console.log('Token preview:', token.substring(0, 10) + '...' + token.substring(token.length - 5));
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      Origin: window.location.origin,
    };
    
    console.log('Headers prepared:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': headers['Authorization'] ? 'Bearer token exists' : 'No token',
      'Origin': headers['Origin']
    });
    
    return headers;
  }

  /**
   * Helper method to handle API errors
   */
  private async handleError(
    error: unknown,
    defaultMessage: string
  ): Promise<ApiError> {
    console.error('API Error:', error)

    // Handle network errors like "Failed to fetch" or "Connection refused"
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error detected:', error.message)
      return {
        status: 503, // Service Unavailable
        message: `Backend server connection failed: ${error.message}. Please make sure the API server is running.`,
        details: { originalError: error.message },
      }
    }

    // Handle Response objects
    if (error instanceof Response) {
      try {
        // Try to get the error details from the response json
        const errorData = await error.json()
        return {
          status: error.status,
          message:
            errorData.detail ||
            errorData.message ||
            error.statusText ||
            defaultMessage,
          details: errorData,
        }
      } catch {
        // If we can't parse the JSON, use the response status text
        return {
          status: error.status,
          message: error.statusText || defaultMessage,
        }
      }
    }

    // Handle response-like objects (for testing or other scenarios)
    if (
      error &&
      typeof error === 'object' &&
      'ok' in error &&
      !error.ok &&
      'status' in error
    ) {
      const responseError = error as {
        status?: number
        statusText?: string
        message?: string
        details?: unknown
      }
      return {
        status: responseError.status || 500,
        message:
          responseError.statusText || responseError.message || defaultMessage,
        details: responseError.details || responseError,
      }
    }

    // Default error handling
    return {
      status: 500,
      message: error instanceof Error ? error.message : defaultMessage,
      details: error,
    }
  }

  /**
   * Get all integrations for a team
   */
  async getIntegrations(
    teamId: string,
    serviceType?: IntegrationType
  ): Promise<Integration[] | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      let url = `${this.apiUrl}?team_id=${teamId}`

      if (serviceType) {
        url += `&service_type=${serviceType}`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw response
      }

      const data = await response.json()
      return data
    } catch (error) {
      return await this.handleError(error, 'Failed to fetch integrations')
    }
  }

  /**
   * Get a single integration by ID
   */
  async getIntegration(integrationId: string): Promise<Integration | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.apiUrl}/${integrationId}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to fetch integration')
    }
  }

  /**
   * Create a new integration
   */
  async createIntegration(
    data: CreateIntegrationRequest
  ): Promise<Integration | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to create integration')
    }
  }

  /**
   * Create a new Slack integration using OAuth
   */
  async createSlackIntegration(
    data: CreateSlackIntegrationRequest
  ): Promise<Integration | ApiError> {
    try {
      // Log environment and context
      console.log('Current window.location.origin:', window.location.origin);
      console.log('Current API URL configuration:', env.apiUrl);
      
      // Get auth headers with detailed logging
      const headers = await this.getAuthHeaders()
      console.log('API URL for Slack integration:', `${this.apiUrl}/slack`)

      // Log request (without sensitive data)
      console.log('Creating Slack integration with request:', {
        method: 'POST',
        url: `${this.apiUrl}/slack`,
        contentType: headers['Content-Type'],
        hasAuth: !!headers['Authorization'],
        teamId: data.team_id,
        serviceType: data.service_type,
        redirect_uri: data.redirect_uri,
        // Omitting sensitive fields
      })

      // Log the full headers for debugging (omitting sensitive values)
      const debugHeaders = {...headers};
      if (debugHeaders['Authorization']) {
        debugHeaders['Authorization'] = '(Bearer token exists)';
      }
      console.log('Request headers:', debugHeaders);
      
      // Deep debugging of the data being sent
      console.log('POST body sent to server (sensitive data redacted):', {
        ...data, 
        code: data.code ? data.code.substring(0, 5) + '...' : null,
        client_id: data.client_id ? data.client_id.substring(0, 5) + '...' : null,
        client_secret: data.client_secret ? '(secret exists)' : null
      });
      
      // Try with a timeout to catch hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout - aborting after 15 seconds');
        controller.abort();
      }, 15000); // 15 second timeout
      
      console.log('Starting fetch request to Slack integration endpoint...');
      
      // Try to use a different approach to identify the issue
      try {
        // Try a simpler approach first to test connectivity
        console.log('Testing connectivity with a simple GET request...');
        const testResponse = await fetch(`${env.apiUrl}/healthcheck`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        console.log('Test connectivity result:', testResponse.status, testResponse.statusText);
      } catch (testError) {
        console.error('Test request failed:', testError);
      }
      
      // Now try the real request
      console.log('Proceeding with actual integration creation request...');
      const response = await fetch(`${this.apiUrl}/slack`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('Fetch request completed with status:', response.status, response.statusText);

      console.log(
        'Slack integration response status:',
        response.status,
        response.statusText
      )

      if (!response.ok) {
        console.error(
          'Error response from Slack integration API:',
          response.status,
          response.statusText
        )

        // Try to get more detailed error information
        try {
          const errorText = await response.text()
          console.error('Error details:', errorText)
        } catch (textError) {
          console.error('Could not read error details:', textError)
        }

        throw response
      }

      console.log('Response is OK, attempting to parse JSON response');
      let responseText;
      try {
        // First get the raw text for debugging
        responseText = await response.clone().text();
        console.log('Raw response text:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
      } catch (e) {
        console.error('Error reading response text:', e);
      }
      
      try {
        const result = await response.json();
        console.log(
          'Slack integration success, received data type:',
          typeof result,
          'data:', 
          result ? JSON.stringify(result).substring(0, 100) + '...' : 'null'
        );
        return result;
      } catch (e) {
        console.error('Error parsing JSON from response:', e);
        console.error('Failed to parse response body:', responseText);
        throw new Error('Failed to parse response from server: ' + e.message);
      }
    } catch (error) {
      console.error('Error in createSlackIntegration:', error)
      return await this.handleError(error, 'Failed to create Slack integration')
    }
  }

  /**
   * Update an integration
   */
  async updateIntegration(
    integrationId: string,
    data: UpdateIntegrationRequest
  ): Promise<Integration | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.apiUrl}/${integrationId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to update integration')
    }
  }

  /**
   * Get integration resources
   */
  async getResources(
    integrationId: string,
    resourceTypes?: ResourceType[]
  ): Promise<ServiceResource[] | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      let url = `${this.apiUrl}/${integrationId}/resources`

      if (resourceTypes && resourceTypes.length > 0) {
        const resourceTypeParams = resourceTypes
          .map((type) => `resource_type=${type}`)
          .join('&')
        url += `?${resourceTypeParams}`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to fetch resources')
    }
  }

  /**
   * Sync integration resources
   */
  async syncResources(
    integrationId: string,
    resourceTypes?: string[]
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      console.log(
        'Starting syncResources in integrationService with ID:',
        integrationId
      )
      console.log('Resource types:', resourceTypes)

      const headers = await this.getAuthHeaders()
      let url = `${this.apiUrl}/${integrationId}/sync`

      if (resourceTypes && resourceTypes.length > 0) {
        // Using resource_type (singular) to match the API's expected parameter name
        const resourceTypeParams = resourceTypes
          .map((type) => `resource_type=${type}`)
          .join('&')
        url += `?${resourceTypeParams}`
      }

      console.log('Sync URL:', url)
      console.log('Headers:', headers)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
      })

      console.log('Sync response status:', response.status)

      if (!response.ok) {
        console.error(
          'Sync response not OK:',
          response.status,
          response.statusText
        )
        throw response
      }

      const result = await response.json()
      console.log('Sync result:', result)
      return result
    } catch (error) {
      console.error('Error in syncResources:', error)
      return await this.handleError(error, 'Failed to sync resources')
    }
  }

  /**
   * Share an integration with another team
   */
  async shareIntegration(
    integrationId: string,
    data: IntegrationShareRequest
  ): Promise<IntegrationShare | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.apiUrl}/${integrationId}/share`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to share integration')
    }
  }

  /**
   * Revoke an integration share
   */
  async revokeShare(
    integrationId: string,
    teamId: string
  ): Promise<{ status: string; message: string } | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(
        `${this.apiUrl}/${integrationId}/share/${teamId}`,
        {
          method: 'DELETE',
          headers,
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to revoke share')
    }
  }

  /**
   * Grant access to a resource
   */
  async grantResourceAccess(
    integrationId: string,
    resourceId: string,
    data: ResourceAccessRequest
  ): Promise<ResourceAccess | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(
        `${this.apiUrl}/${integrationId}/resources/${resourceId}/access`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return await this.handleError(error, 'Failed to grant resource access')
    }
  }

  /**
   * Helper method to check if a response is an API error
   */
  isApiError(response: unknown): response is ApiError {
    return (
      response !== null &&
      typeof response === 'object' &&
      'status' in response &&
      'message' in response
    )
  }
}

// Export singleton instance
const integrationService = new IntegrationService()
export default integrationService
