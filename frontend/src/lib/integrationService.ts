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
  updated?: boolean // Flag indicating if this was an update to an existing integration

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
  workspace_id?: string // Add workspace_id field for external service identifier
  metadata?: Record<string, unknown>
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
  }

  /**
   * Helper method to create auth headers
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token

    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      Origin: window.location.origin,
    }
  }

  /**
   * Helper method to handle API errors
   */
  private handleError(error: unknown, defaultMessage: string): ApiError {
    console.error('API Error:', error)

    // Handle Response objects
    if (error instanceof Response) {
      return {
        status: error.status,
        message: error.statusText || defaultMessage,
      }
    }

    // Handle response-like objects (for testing or other scenarios)
    if (
      error &&
      typeof error === 'object' &&
      'ok' in error &&
      !error.ok &&
      'status' in error &&
      'statusText' in error
    ) {
      const responseError = error as { status: number; statusText: string }
      return {
        status: responseError.status,
        message: responseError.statusText || defaultMessage,
      }
    }

    // Default error handling
    return {
      status: 500,
      message: error instanceof Error ? error.message : defaultMessage,
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
      return this.handleError(error, 'Failed to fetch integrations')
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
      return this.handleError(error, 'Failed to fetch integration')
    }
  }

  /**
   * Create a new integration
   */
  async createIntegration(
    data: CreateIntegrationRequest
  ): Promise<(Integration & { updated?: boolean }) | ApiError> {
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

      // Parse the response which may include an 'updated' field
      // to indicate if this was a reconnection
      const result = await response.json()
      return result
    } catch (error) {
      return this.handleError(error, 'Failed to create integration')
    }
  }

  /**
   * Create a new Slack integration using OAuth
   */
  async createSlackIntegration(
    data: CreateSlackIntegrationRequest
  ): Promise<Integration | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.apiUrl}/slack`, {
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
      return this.handleError(error, 'Failed to create Slack integration')
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
      return this.handleError(error, 'Failed to update integration')
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
      return this.handleError(error, 'Failed to fetch resources')
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
      console.log('[SYNC DEBUG] Starting syncResources with ID:', integrationId)
      console.log('[SYNC DEBUG] Resource types:', resourceTypes)

      const headers = await this.getAuthHeaders()
      let url = `${this.apiUrl}/${integrationId}/sync`

      if (resourceTypes && resourceTypes.length > 0) {
        // Using resource_type (singular) to match the API's expected parameter name
        const resourceTypeParams = resourceTypes
          .map((type) => `resource_type=${type}`)
          .join('&')
        url += `?${resourceTypeParams}`
      }

      console.log('[SYNC DEBUG] Sync URL:', url)
      console.log('[SYNC DEBUG] Headers:', {
        ...headers,
        Authorization: 'Bearer [redacted]',
      })

      // Make the request
      console.log('[SYNC DEBUG] Making fetch request...')
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
      })

      console.log('[SYNC DEBUG] Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers:
          response.headers instanceof Headers
            ? Object.fromEntries([...response.headers.entries()])
            : '(headers not available)',
      })

      // Try to parse the response as JSON
      let result: Record<string, unknown>
      try {
        const text = await response.text()
        console.log('[SYNC DEBUG] Raw response text:', text)

        try {
          result = text ? JSON.parse(text) : {}
          console.log('[SYNC DEBUG] Parsed JSON result:', result)
        } catch (jsonError) {
          console.error('[SYNC DEBUG] Failed to parse JSON:', jsonError)
          // If can't parse as JSON, use a default result based on status
          result = {
            status: response.ok ? 'success' : 'error',
            message: response.ok
              ? 'Resources synced successfully'
              : `Failed to parse response: ${text}`,
          }
        }
      } catch (textError) {
        console.error('[SYNC DEBUG] Failed to get response text:', textError)
        // Fallback if we can't even get text
        result = {
          status: response.ok ? 'success' : 'error',
          message: response.ok
            ? 'Resources synced successfully'
            : 'Failed to read response',
        }
      }

      // For non-OK responses, return an error
      if (!response.ok) {
        console.error(
          '[SYNC DEBUG] Response not OK:',
          response.status,
          response.statusText
        )

        // Try to get detailed error message
        let errorDetail = ''
        try {
          const errorData = await response.json()
          errorDetail = errorData.detail || ''
          console.log('Error detail:', errorDetail)
        } catch {
          // Ignore JSON parsing errors
        }

        // Return a friendly error instead of throwing
        return {
          status: response.status,
          message:
            errorDetail ||
            'Failed to sync resources. Please reconnect the integration.',
        }
      }

      return result
    } catch (error) {
      console.error('[SYNC DEBUG] Exception in syncResources:', error)
      return this.handleError(error, 'Failed to sync resources')
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
      return this.handleError(error, 'Failed to share integration')
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
      return this.handleError(error, 'Failed to revoke share')
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
      return this.handleError(error, 'Failed to grant resource access')
    }
  }

  /**
   * Helper method to check if a response is an API error
   *
   * IMPORTANT: This needs to distinguish between success responses that have
   * status/message fields and actual error responses
   */
  isApiError(response: unknown): response is ApiError {
    // Only consider it an API error if:
    // 1. It's an object with status and message properties
    // 2. The status is a number (HTTP status code) OR status is not the string "success"
    return (
      response !== null &&
      typeof response === 'object' &&
      'status' in response &&
      'message' in response &&
      // If status is a number, it's likely an HTTP error status
      (typeof response.status === 'number' ||
        // Or if status is a string but not "success"
        (typeof response.status === 'string' && response.status !== 'success'))
    )
  }
}

// Export singleton instance
const integrationService = new IntegrationService()
export default integrationService
