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
  channel_id: string
  analysis_type: string
  result: Record<string, unknown>
  created_at: string
}

export interface SlackOAuthRequest {
  code: string
  redirect_uri: string
  client_id: string
  client_secret: string
}

// Slack API client class
class SlackApiClient extends ApiClient {
  constructor() {
    // Pass the slack path to the base class
    super('/integrations/slack')
  }

  /**
   * Get all Slack workspaces for the current team
   */
  async getWorkspaces(teamId?: string): Promise<SlackWorkspace[] | ApiError> {
    const endpoint = teamId ? `?team_id=${teamId}` : ''
    return this.get<SlackWorkspace[]>(endpoint)
  }

  /**
   * Get a single Slack workspace
   */
  async getWorkspace(workspaceId: string): Promise<SlackWorkspace | ApiError> {
    return this.get<SlackWorkspace>(`${workspaceId}`)
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

    // Use the specific slack endpoint for creating Slack integrations
    return this.post<Record<string, unknown>>('/slack', data)
  }

  /**
   * Get all channels for a workspace
   */
  async getChannels(workspaceId: string): Promise<SlackChannel[] | ApiError> {
    return this.get<SlackChannel[]>(`${workspaceId}/channels`)
  }

  /**
   * Get a single channel
   */
  async getChannel(
    workspaceId: string,
    channelId: string
  ): Promise<SlackChannel | ApiError> {
    return this.get<SlackChannel>(`${workspaceId}/channels/${channelId}`)
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
      `${workspaceId}/channels/${channelId}/messages?limit=${limit}&offset=${offset}`
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
      `${workspaceId}/channels/${channelId}/threads/${threadTs}`
    )
  }

  /**
   * Get all users for a workspace
   */
  async getUsers(workspaceId: string): Promise<SlackUser[] | ApiError> {
    return this.get<SlackUser[]>(`${workspaceId}/users`)
  }

  /**
   * Get a single user
   */
  async getUser(
    workspaceId: string,
    userId: string
  ): Promise<SlackUser | ApiError> {
    return this.get<SlackUser>(`${workspaceId}/users/${userId}`)
  }

  /**
   * Run channel analysis
   */
  async analyzeChannel(
    workspaceId: string,
    channelId: string,
    analysisType: string
  ): Promise<SlackAnalysisResult | ApiError> {
    return this.post<SlackAnalysisResult>(
      `${workspaceId}/channels/${channelId}/analyze`,
      { analysis_type: analysisType }
    )
  }

  /**
   * Get analysis history for a channel
   */
  async getAnalysisHistory(
    workspaceId: string,
    channelId: string
  ): Promise<SlackAnalysisResult[] | ApiError> {
    return this.get<SlackAnalysisResult[]>(
      `${workspaceId}/channels/${channelId}/analysis`
    )
  }

  /**
   * Sync workspace data
   */
  async syncWorkspace(
    workspaceId: string
  ): Promise<Record<string, unknown> | ApiError> {
    return this.post<Record<string, unknown>>(`${workspaceId}/sync`)
  }
}

// Export singleton instance
export const slackApiClient = new SlackApiClient()
export default slackApiClient
