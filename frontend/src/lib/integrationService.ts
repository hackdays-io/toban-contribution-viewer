/**
 * Integration API Service
 * Handles all communication with the integration endpoints of the backend API
 */

import env from '../config/env'
import { supabase } from './supabase'

// Cross-Resource Reports API Base URL
const REPORTS_API_BASE = `${env.apiUrl}/reports`

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
  workspace_id?: string // External service identifier (e.g., Slack workspace ID)

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
  is_selected_for_analysis?: boolean // Added for direct selection status access
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

export interface ChannelSelectionRequest {
  channel_ids: string[]
  for_analysis: boolean
}

export interface AnalysisOptions {
  start_date?: string
  end_date?: string
  include_threads?: boolean
  include_reactions?: boolean
  analysis_type?: string
  use_json_mode?: boolean
}

// Error types
export interface ApiError {
  status: number
  message: string
  details?: unknown
  detail?: string
}

/**
 * Integration Service class
 */
class IntegrationService {
  // Make apiUrl public so it can be used for custom endpoints
  public apiUrl: string

  constructor() {
    this.apiUrl = `${env.apiUrl}/integrations`
  }

  /**
   * Helper method to create auth headers
   * Made public to allow custom API calls to integration endpoints
   */
  public async getAuthHeaders(): Promise<HeadersInit> {
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
   * Get a specific resource by ID
   * Note: This method fetches all resources and filters for the specific one,
   * as there's no direct API endpoint for fetching a single resource by ID.
   */
  async getResource(
    integrationId: string,
    resourceId: string
  ): Promise<ServiceResource | ApiError> {
    try {
      // Fetch all resources and filter for the specific one
      const resources = await this.getResources(integrationId)

      // Check if we got an error from getResources
      if (this.isApiError(resources)) {
        console.error('Error fetching resources:', resources.message)
        throw new Error(`Failed to fetch resources: ${resources.message}`)
      }

      // Filter for the specific resource
      const resource = resources.find((res) => res.id === resourceId)

      if (!resource) {
        console.error(
          `Resource ${resourceId} not found in integration ${integrationId}`
        )
        throw new Error(`Resource ${resourceId} not found`)
      }
      return resource
    } catch (error) {
      return this.handleError(error, 'Failed to fetch resource')
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
      // Basic logging for sync request
      console.log(
        `Syncing resources for integration ${integrationId}`,
        resourceTypes && resourceTypes.length > 0
          ? resourceTypes
          : 'all resource types'
      )

      const headers = await this.getAuthHeaders()
      let url = `${this.apiUrl}/${integrationId}/sync`

      if (resourceTypes && resourceTypes.length > 0) {
        // Using resource_type (singular) to match the API's expected parameter name
        const resourceTypeParams = resourceTypes
          .map((type) => `resource_type=${type}`)
          .join('&')
        url += `?${resourceTypeParams}`
      }

      // Make the request with concise logging
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
      })

      // Try to parse the response as JSON
      let result: Record<string, unknown>
      try {
        const text = await response.text()

        try {
          result = text ? JSON.parse(text) : {}
        } catch (jsonError) {
          console.warn('Failed to parse sync response as JSON', jsonError)
          // If can't parse as JSON, use a default result based on status
          result = {
            status: response.ok ? 'success' : 'error',
            message: response.ok
              ? 'Resources synced successfully'
              : `Failed to parse response: ${text}`,
          }
        }
      } catch (textError) {
        console.warn('Failed to get sync response text', textError)
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
          'Sync request failed:',
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
   * Sync messages for a specific channel
   * @param integrationId Integration UUID
   * @param channelId Channel UUID
   * @param options Options for syncing including date range and thread inclusion
   */
  async syncChannelMessages(
    integrationId: string,
    channelId: string,
    options: {
      start_date?: string
      end_date?: string
      include_replies?: boolean
    }
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const syncChannelEndpoint = `${this.apiUrl}/${integrationId}/resources/${channelId}/sync-messages`

      // Build the request URL with query parameters
      const url = new URL(syncChannelEndpoint)
      if (options.start_date) {
        url.searchParams.append('start_date', options.start_date)
      }
      if (options.end_date) {
        url.searchParams.append('end_date', options.end_date)
      }
      if (options.include_replies !== undefined) {
        url.searchParams.append(
          'include_replies',
          options.include_replies.toString()
        )
      }

      // Make the channel messages sync request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const responseText = await response.text()
          try {
            const errorData = JSON.parse(responseText)
            errorDetail = errorData.detail || errorData.message || responseText
          } catch {
            errorDetail = responseText || response.statusText
          }
        } catch {
          // Ignore response reading errors
        }

        return {
          status: response.status,
          message: `Channel sync failed: ${errorDetail}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to sync channel messages')
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
   * Select channels for analysis
   * Marks specified channels as selected for analysis
   */
  async selectChannelsForAnalysis(
    integrationId: string,
    data: ChannelSelectionRequest
  ): Promise<{ status: string; message: string } | ApiError> {
    try {
      const headers = await this.getAuthHeaders()

      // Use the direct integration API endpoint
      const response = await fetch(
        `${this.apiUrl}/${integrationId}/resources/channel-selection`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            channel_ids: data.channel_ids,
            for_analysis: data.for_analysis,
          }),
        }
      )

      if (!response.ok) {
        throw response
      }

      // After successful selection/deselection, refresh the resources
      await this.getResources(integrationId, [ResourceType.SLACK_CHANNEL])

      return {
        status: 'success',
        message: data.for_analysis
          ? 'Channels selected for analysis'
          : 'Channels deselected from analysis',
      }
    } catch (error) {
      return this.handleError(error, 'Failed to select channels for analysis')
    }
  }

  /**
   * Get selected channels for analysis
   * Returns a list of channels that are marked for analysis
   */
  async getSelectedChannels(
    integrationId: string
  ): Promise<ServiceResource[] | ApiError> {
    try {
      // Get all channels from the resources endpoint
      const resources = await this.getResources(integrationId, [
        ResourceType.SLACK_CHANNEL,
      ])

      if (this.isApiError(resources)) {
        console.error('Error getting channel resources:', resources)
        throw resources
      }

      // Filter for channels with the is_selected_for_analysis flag
      // Check both the metadata.is_selected_for_analysis field and the top-level field
      // that might have been added by the backend
      const selectedChannels = resources.filter((resource) => {
        const metadataSelected =
          resource.metadata?.is_selected_for_analysis === true
        const resourceSelected = resource.is_selected_for_analysis === true

        return (
          (metadataSelected || resourceSelected) &&
          resource.resource_type === ResourceType.SLACK_CHANNEL
        )
      })

      console.log(
        `Found ${selectedChannels.length} channels selected for analysis out of ${resources.length} total channels`
      )

      return selectedChannels
    } catch (error) {
      console.error('Error getting selected channels:', error)
      return this.handleError(error, 'Failed to get selected channels')
    }
  }

  /**
   * Analyze a resource (channel) through the team integration
   * @param integrationId Integration UUID
   * @param resourceId Resource UUID (channel)
   * @param options Analysis options
   */
  async analyzeResource(
    integrationId: string,
    resourceId: string,
    options?: AnalysisOptions
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const url = `${this.apiUrl}/${integrationId}/resources/${resourceId}/analyze`

      // Create request body with analysis options
      const body = options || {}

      // Make the API call
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        // Try to extract more detailed error information
        let errorDetail = ''
        try {
          const errorText = await response.text()
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorText
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Analysis request failed: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to analyze resource')
    }
  }

  /**
   * Create a cross-resource report for multiple channels or a single channel
   * This function can be used for both single and multi-channel analyses
   * @param teamId Team UUID
   * @param channels Array of channel resources to include in the report
   * @param options Analysis options
   * @param title Custom title for the report (optional)
   * @param description Custom description for the report (optional)
   */
  async createChannelReport(
    teamId: string,
    channels: { id: string; name: string; integration_id: string }[],
    options: {
      start_date?: string
      end_date?: string
      include_threads?: boolean
      include_reactions?: boolean
      analysis_type?: string
    },
    title?: string,
    description?: string
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      // Use the new dedicated API endpoint for channel reports
      const headers = await this.getAuthHeaders()
      const url = `${env.apiUrl}/reports/${teamId}/channel-reports`

      // Prepare request body
      const requestData = {
        team_id: teamId,
        channels: channels,
        start_date: options.start_date,
        end_date: options.end_date,
        include_threads: options.include_threads ?? true,
        include_reactions: options.include_reactions ?? true,
        analysis_type: options.analysis_type?.toUpperCase() || 'CONTRIBUTION',
        title: title,
        description: description,
      }

      console.log('Creating channel report with data:', requestData)

      // Make the API call
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorText = await response.text()
          try {
            const errorJson = JSON.parse(errorText)
            errorDetail = errorJson.detail || errorJson.message || errorText
          } catch {
            errorDetail = errorText
          }
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Failed to create channel report: ${errorDetail}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      console.error('Error in createChannelReport:', error)
      return this.handleError(error, 'Failed to create channel report')
    }
  }

  /**
   * Get analysis history for a resource
   * @param integrationId Integration UUID
   * @param resourceId Resource UUID (channel)
   */
  async getResourceAnalyses(
    integrationId: string,
    resourceId: string
  ): Promise<Record<string, unknown>[] | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const url = `${this.apiUrl}/${integrationId}/resources/${resourceId}/analyses`

      // Make the API call
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        // Try to extract more detailed error information
        let errorDetail = ''
        try {
          const errorText = await response.text()
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorText
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Failed to retrieve analysis history: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to get resource analyses')
    }
  }

  /**
   * Get latest analysis for a resource
   * @param integrationId Integration UUID
   * @param resourceId Resource UUID (channel)
   */
  async getLatestResourceAnalysis(
    integrationId: string,
    resourceId: string
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const url = `${this.apiUrl}/${integrationId}/resources/${resourceId}/analyses/latest`

      // Make the API call
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        // Try to extract more detailed error information
        let errorDetail = ''
        try {
          const errorText = await response.text()
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorText
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Failed to retrieve latest analysis: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to get latest resource analysis')
    }
  }

  /**
   * Get a specific analysis for a resource
   * @param integrationId Integration UUID
   * @param resourceId Resource UUID (channel)
   * @param analysisId Analysis ID
   */
  async getResourceAnalysis(
    integrationId: string,
    resourceId: string,
    analysisId: string
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const url = `${this.apiUrl}/${integrationId}/resources/${resourceId}/analysis/${analysisId}`

      // Make the API call
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        // Try to extract more detailed error information
        let errorDetail = ''
        try {
          const errorText = await response.text()
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorText
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Failed to retrieve analysis: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to get resource analysis')
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

  /**
   * Get cross-resource report by ID
   * @param teamId Team UUID
   * @param reportId Report UUID
   * @param includeAnalyses Whether to include resource analyses in the response
   */
  async getCrossResourceReport(
    teamId: string,
    reportId: string,
    includeAnalyses: boolean = true
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      const url = `${REPORTS_API_BASE}/${teamId}/cross-resource-reports/${reportId}?include_analyses=${includeAnalyses}`

      // Make the API call
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        // Try to extract more detailed error information
        let errorDetail = ''
        try {
          const errorText = await response.text()
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorText
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Failed to retrieve report: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to get cross-resource report')
    }
  }

  /**
   * Get cross-resource reports history for a team
   * @param teamId Team UUID
   * @param page Page number (optional, defaults to 1)
   * @param limit Number of reports per page (optional, defaults to 10)
   * @param status Filter by report status (optional)
   */
  async getCrossResourceReports(
    teamId: string,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<Record<string, unknown> | ApiError> {
    try {
      const headers = await this.getAuthHeaders()
      let url = `${REPORTS_API_BASE}/${teamId}/cross-resource-reports?page=${page}&limit=${limit}`

      if (status) {
        url += `&status=${status}`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorText = await response.text()
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorText
        } catch {
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `Failed to retrieve reports: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        }
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, 'Failed to get cross-resource reports')
    }
  }
}

// Export singleton instance
const integrationService = new IntegrationService()
export default integrationService
