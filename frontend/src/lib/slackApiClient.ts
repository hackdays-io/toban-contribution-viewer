/**
 * Slack API Client
 * Handles all Slack-related API calls
 */

import { ApiClient, ApiError } from './apiClient'

// Response and request types
export interface SlackWorkspace {
  id: string
  team_id: string
  name: string
  domain: string
  icon_url: string
  is_connected: boolean
  created_at: string
  updated_at: string
}

export interface SlackChannel {
  id: string
  workspace_id: string
  channel_id: string
  name: string
  is_private: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  topic?: string
  purpose?: string
  num_members?: number
}

// For use in API calls where profile_image_url might not be present
export interface BaseSlackUser {
  id: string
  slack_id?: string
  name: string
  display_name?: string | null
  real_name?: string | null
}

export interface SlackUser {
  id: string
  workspace_id: string
  user_id: string
  name: string
  real_name: string
  display_name: string
  email?: string
  avatar_url?: string
  is_bot: boolean
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface SlackMessage {
  id: string
  channel_id: string
  user_id: string
  ts: string
  text: string
  thread_ts?: string
  is_thread_parent: boolean
  reactions?: Record<string, unknown>[]
  created_at: string
}

export interface SlackAnalysisResult {
  analysis_id: string
  channel_id: string
  channel_name: string
  analysis_type: string
  result: Record<string, unknown>
  created_at: string
  generated_at?: string
  period?: {
    start: string
    end: string
  }
  stats?: {
    message_count: number
    participant_count: number
    thread_count: number
    reaction_count: number
  }
  channel_summary?: string
  topic_analysis?: string
  contributor_insights?: string
  key_highlights?: string
  model_used?: string
  json_mode?: boolean
}

export interface SlackOAuthRequest {
  code: string
  redirect_uri: string
  client_id: string
  client_secret: string
}

// Import env config
import env from '../config/env'

// Slack API client class
class SlackApiClient extends ApiClient {
  // Store the calculated base URL for logging
  private apiBaseUrl: string

  constructor() {
    // Use the full API URL with the slack path
    // The baseUrl should include the protocol, host, and API prefix

    // Add basic logging
    console.log('SlackApiClient constructor - apiUrl value:', env.apiUrl)

    // The env.apiUrl is '/api/v1' from docker-compose.yml
    // For direct API calls we need to make this a full URL or relative path

    // Since apiUrl is a relative path ('/api/v1'), we'll use it directly
    // This will work with the browser's current origin
    const baseUrl = `${env.apiUrl}/slack`

    console.log(`SlackApiClient constructor - final baseUrl: ${baseUrl}`)

    super(baseUrl)

    // Store the base URL for logging
    this.apiBaseUrl = baseUrl

    // Debug information about API URL construction
    console.log('SlackApiClient debug info:')
    console.log('- env.apiUrl:', env.apiUrl)
    console.log('- Full base URL:', baseUrl)
    console.log(
      '- Example POST endpoint:',
      `${baseUrl}/workspaces/{workspace_id}/channels/{channel_id}/analyze`
    )
    console.log('- API client will prepend "/" to any API paths.')
  }

  /**
   * Get all Slack workspaces for the current team
   */
  async getWorkspaces(teamId?: string): Promise<SlackWorkspace[] | ApiError> {
    const endpoint = teamId ? `workspaces?team_id=${teamId}` : 'workspaces'
    return this.get<SlackWorkspace[]>(endpoint)
  }

  /**
   * Get a single Slack workspace
   */
  async getWorkspace(workspaceId: string): Promise<SlackWorkspace | ApiError> {
    return this.get<SlackWorkspace>(`workspaces/${workspaceId}`)
  }

  /**
   * Connect a new Slack workspace using OAuth
   */
  async connectWorkspace(
    oauthData: SlackOAuthRequest,
    teamId: string,
    name: string
  ): Promise<Record<string, unknown> | ApiError> {
    const data = {
      ...oauthData,
      service_type: 'slack',
      name,
      team_id: teamId,
    }

    // Use empty string to hit the root /api/v1/slack endpoint
    return this.post<Record<string, unknown>>('', data)
  }

  /**
   * Get all channels for a workspace
   */
  async getChannels(workspaceId: string): Promise<SlackChannel[] | ApiError> {
    return this.get<SlackChannel[]>(`workspaces/${workspaceId}/channels`)
  }

  /**
   * Get a single channel
   */
  async getChannel(
    workspaceId: string,
    channelId: string
  ): Promise<SlackChannel | ApiError> {
    return this.get<SlackChannel>(
      `workspaces/${workspaceId}/channels/${channelId}`
    )
  }

  /**
   * Get messages for a channel
   */
  async getMessages(
    workspaceId: string,
    channelId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SlackMessage[] | ApiError> {
    return this.get<SlackMessage[]>(
      `workspaces/${workspaceId}/channels/${channelId}/messages?limit=${limit}&offset=${offset}`
    )
  }

  /**
   * Get thread messages
   */
  async getThreadMessages(
    workspaceId: string,
    channelId: string,
    threadTs: string
  ): Promise<SlackMessage[] | ApiError> {
    return this.get<SlackMessage[]>(
      `workspaces/${workspaceId}/channels/${channelId}/threads/${threadTs}`
    )
  }

  /**
   * Get all users for a workspace
   */
  async getUsers(workspaceId: string): Promise<SlackUser[] | ApiError> {
    return this.get<SlackUser[]>(`workspaces/${workspaceId}/users`)
  }

  /**
   * Get a single user
   */
  async getUser(
    workspaceId: string,
    userId: string
  ): Promise<SlackUser | ApiError> {
    return this.get<SlackUser>(`workspaces/${workspaceId}/users/${userId}`)
  }

  /**
   * Get users by IDs
   * @param workspaceId Database UUID for the workspace
   * @param userIds Array of user IDs (Slack IDs or database UUIDs)
   * @param fetchFromSlack Whether to fetch users from Slack API if not found in DB
   */
  async getUsersByIds(
    workspaceId: string,
    userIds: string[],
    fetchFromSlack: boolean = true
  ): Promise<{ users: BaseSlackUser[] } | ApiError> {
    if (!userIds || userIds.length === 0) {
      return { users: [] }
    }

    console.log('[SlackApiClient] getUsersByIds - Input params:', {
      workspaceId,
      userIds,
      fetchFromSlack,
    })

    try {
      // Directly use the path that will match the backend route
      const path = `/workspaces/${workspaceId}/users`

      // Create URLSearchParams object to properly handle multiple parameters with the same name
      const searchParams = new URLSearchParams();
      
      // Add fetch_from_slack parameter
      searchParams.append('fetch_from_slack', fetchFromSlack.toString());
      
      // Add user_ids[] parameter for each user ID
      userIds.forEach((id) => {
        searchParams.append('user_ids[]', id);
      });
      
      const params = Object.fromEntries(searchParams.entries());

      console.log('[SlackApiClient] getUsersByIds - Using path:', path)
      console.log('[SlackApiClient] getUsersByIds - Using params:', params)
      console.log('[SlackApiClient] getUsersByIds - URLSearchParams:', searchParams.toString())

      return this.get<{ users: BaseSlackUser[] }>(path, params)
    } catch (error) {
      console.error('[SlackApiClient] getUsersByIds - Error:', error)
      return {
        status: 'CLIENT_ERROR',
        message: `Error fetching users: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Run channel analysis
   * @param workspaceId Database UUID for the workspace
   * @param channelId Database UUID for the channel
   * @param analysisType Type of analysis to run (e.g., 'contribution')
   * @param options Optional parameters for the analysis
   */
  async analyzeChannel(
    workspaceId: string,
    channelId: string,
    analysisType: string,
    options?: {
      start_date?: string
      end_date?: string
      include_threads?: boolean
      include_reactions?: boolean
      model?: string
      use_json_mode?: boolean
    }
  ): Promise<SlackAnalysisResult | ApiError> {
    const data = {
      analysis_type: analysisType,
      ...options,
    }

    // Build path with workspaceId (database UUID) and channelId (database UUID)
    // Make sure to use a leading slash so it builds the URL correctly
    const path = `/workspaces/${workspaceId}/channels/${channelId}/analyze`

    // Log the full URL that will be constructed
    console.log(`Making API call to: ${this.apiBaseUrl}${path}`)

    return this.post<SlackAnalysisResult>(path, data)
  }

  /**
   * Get analysis history for a channel
   */
  async getAnalysisHistory(
    workspaceId: string,
    channelId: string
  ): Promise<SlackAnalysisResult[] | ApiError> {
    // Be consistent with leading slash
    const path = `/workspaces/${workspaceId}/channels/${channelId}/analyses`
    console.log(`Getting analysis history from: ${this.apiBaseUrl}${path}`)
    return this.get<SlackAnalysisResult[]>(path)
  }

  /**
   * Sync workspace data
   */
  async syncWorkspace(
    workspaceId: string
  ): Promise<Record<string, unknown> | ApiError> {
    return this.post<Record<string, unknown>>(`workspaces/${workspaceId}/sync`)
  }

  /**
   * Get workspace ID from integration ID
   * This is useful when we only have an integration ID but need to fetch user data
   * @param integrationId The integration ID
   * @returns Promise with the workspace ID or ApiError
   */
  async getWorkspaceIdFromIntegration(
    integrationId: string
  ): Promise<string | ApiError> {
    if (!integrationId) {
      console.warn('[SlackApiClient] getWorkspaceIdFromIntegration - No integrationId provided')
      return ''
    }

    try {
      // Use the integration endpoint to get the integration details
      const apiUrl = `${env.apiUrl}/integrations/${integrationId}`
      
      console.log(`[SlackApiClient] getWorkspaceIdFromIntegration - Fetching from ${apiUrl}`)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        return {
          status: response.status,
          message: `Failed to get workspace ID: ${response.status} ${response.statusText}`,
        }
      }

      const integration = await response.json()
      
      if (integration && 
          integration.metadata && 
          integration.metadata.workspace_id) {
        console.log(`[SlackApiClient] getWorkspaceIdFromIntegration - Found workspace_id: ${integration.metadata.workspace_id}`)
        return integration.metadata.workspace_id
      }
      
      console.warn('[SlackApiClient] getWorkspaceIdFromIntegration - No workspace_id found in integration metadata')
      return ''
    } catch (error) {
      console.error('[SlackApiClient] getWorkspaceIdFromIntegration - Error:', error)
      return {
        status: 'CLIENT_ERROR',
        message: `Error fetching workspace ID: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
}

// Export singleton instance
export const slackApiClient = new SlackApiClient()
export default slackApiClient
