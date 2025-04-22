import React, { useState, useContext, createContext } from 'react'
import env from '../../config/env'

// Interface for Slack user data from API - duplicated from SlackUserDisplay for modularity
export interface SlackUser {
  id: string
  slack_id: string
  name: string
  display_name: string | null
  real_name: string | null
  profile_image_url: string | null
}

// Context type for the UserCache
interface UserCacheContextType {
  users: Map<string, SlackUser>
  loading: Set<string>
  errors: Set<string>
  fetchUser: (
    userId: string,
    workspaceId: string
  ) => Promise<SlackUser | undefined>
  getUser: (userId: string) => SlackUser | undefined
  isLoading: (userId: string) => boolean
  hasError: (userId: string) => boolean
}

// Create context for the user cache
export const UserCacheContext = createContext<UserCacheContextType | undefined>(
  undefined
)

// Provider component for the UserCache
export const SlackUserCacheProvider: React.FC<{
  children: React.ReactNode
  workspaceId: string
}> = ({ children, workspaceId }) => {
  console.log("SlackUserCacheProvider initialized with workspace ID:", workspaceId);
  const [users, setUsers] = useState<Map<string, SlackUser>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Set<string>>(new Set())

  // Function to fetch a user by ID
  const fetchUser = async (
    userId: string,
    wsId?: string
  ): Promise<SlackUser | undefined> => {
    // Use provided workspace ID or fall back to the provider's workspaceId
    const targetWorkspaceId = wsId || workspaceId
    
    console.log(`fetchUser called for userId: ${userId}, wsId: ${wsId}, using targetWorkspaceId: ${targetWorkspaceId}`)
    
    if (!userId || !targetWorkspaceId) {
      console.warn('Cannot fetch user: Missing userId or workspaceId')
      return undefined
    }

    // Already loading this user
    if (loading.has(userId)) return undefined

    // Already have this user
    if (users.has(userId)) return users.get(userId)

    // Mark as loading
    setLoading((prev) => new Set([...prev, userId]))

    try {
      const url = `${env.apiUrl}/slack/workspaces/${targetWorkspaceId}/users?user_ids=${encodeURIComponent(userId)}`

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
      })

      if (!response.ok) {
        throw new Error(
          `Error fetching user: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      if (data.users && Array.isArray(data.users) && data.users.length > 0) {
        const user = data.users[0]

        // Update users map
        setUsers((prev) => {
          const next = new Map(prev)
          next.set(userId, user)
          return next
        })

        // Remove from loading
        setLoading((prev) => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        })

        return user
      } else {
        // User not found, create placeholder
        const placeholderUser: SlackUser = {
          id: userId,
          slack_id: '',
          name: 'Unknown User',
          display_name: null,
          real_name: null,
          profile_image_url: null,
        }

        // Update users map with placeholder
        setUsers((prev) => {
          const next = new Map(prev)
          next.set(userId, placeholderUser)
          return next
        })

        // Remove from loading
        setLoading((prev) => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        })

        // Add to errors
        setErrors((prev) => new Set([...prev, userId]))

        return placeholderUser
      }
    } catch (error) {
      console.error('Error fetching user data:', error)

      // Remove from loading
      setLoading((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })

      // Add to errors
      setErrors((prev) => new Set([...prev, userId]))

      return undefined
    }
  }

  // Function to get a user from the cache
  const getUser = (userId: string): SlackUser | undefined => {
    return users.get(userId)
  }

  // Function to check if a user is loading
  const isLoading = (userId: string): boolean => {
    return loading.has(userId)
  }

  // Function to check if there was an error fetching a user
  const hasError = (userId: string): boolean => {
    return errors.has(userId)
  }

  // Context value
  const contextValue: UserCacheContextType = {
    users,
    loading,
    errors,
    fetchUser,
    getUser,
    isLoading,
    hasError,
  }

  return (
    <UserCacheContext.Provider value={contextValue}>
      {children}
    </UserCacheContext.Provider>
  )
}

// Hook to use the UserCache context
export const useUserCache = () => {
  const context = useContext(UserCacheContext)
  if (context === undefined) {
    throw new Error('useUserCache must be used within a SlackUserCacheProvider')
  }
  return context
}
