import { createContext } from 'react'
import { BaseSlackUser } from '../../lib/slackApiClient'

// Interface for Slack user data from API
export interface SlackUser extends BaseSlackUser {
  slack_id: string
  profile_image_url: string | null
}

// Context type for the UserCache
export interface UserCacheContextType {
  users: Map<string, SlackUser>
  loading: Set<string>
  errors: Set<string>
  fetchUser: (
    userId: string,
    workspaceId?: string
  ) => Promise<SlackUser | undefined>
  getUser: (userId: string) => SlackUser | undefined
  isLoading: (userId: string) => boolean
  hasError: (userId: string) => boolean
}

// Create context for the user cache
export const UserCacheContext = createContext<UserCacheContextType | undefined>(
  undefined
)
