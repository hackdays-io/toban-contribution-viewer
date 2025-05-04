import React, { useState } from 'react'
import {
  UserCacheContext,
  SlackUser,
  UserCacheContextType,
} from './SlackUserContextExports'

// Provider component for the UserCache
export const SlackUserCacheProvider: React.FC<{
  children: React.ReactNode
  workspaceId?: string
  workspaceUuid?: string
}> = ({ children, workspaceId, workspaceUuid }) => {
  // Use workspaceUuid if provided, otherwise fall back to workspaceId
  const effectiveWorkspaceId = workspaceUuid || workspaceId || ''
  console.log(
    'SlackUserCacheProvider initialized with workspace ID:',
    effectiveWorkspaceId
  )
  const [users, setUsers] = useState<Map<string, SlackUser>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Set<string>>(new Set())

  // Function to fetch a user by ID
  const fetchUser = async (
    userId: string,
    wsId?: string
  ): Promise<SlackUser | undefined> => {
    // Use provided workspace ID or fall back to the provider's workspaceId
    const targetWorkspaceId = wsId || effectiveWorkspaceId

    console.log(
      `fetchUser called for userId: ${userId}, wsId: ${wsId}, using targetWorkspaceId: ${targetWorkspaceId}`
    )

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
      // Import the slackApiClient here to avoid circular dependencies
      const { slackApiClient } = await import('../../lib/slackApiClient')

      console.log(
        `[SlackUserContext] Fetching user data for userId: ${userId}, workspace: ${targetWorkspaceId}`
      )

      const result = await slackApiClient.getUsersByIds(
        targetWorkspaceId,
        [userId],
        true // fetchFromSlack = true
      )

      // Check if the result is an ApiError
      if ('status' in result && 'message' in result) {
        console.error('[SlackUserContext] API returned an error:', result)
        throw new Error(`API Error: ${result.message || 'Unknown error'}`)
      }

      const data = result

      if (data.users && Array.isArray(data.users) && data.users.length > 0) {
        // Convert BaseSlackUser to SlackUser by ensuring slack_id and profile_image_url are present
        const apiUser = data.users[0]
        const user: SlackUser = {
          id: apiUser.id,
          slack_id: apiUser.slack_id || '',
          name: apiUser.name,
          display_name: apiUser.display_name || null,
          real_name: apiUser.real_name || null,
          profile_image_url: null, // Ensure this is present even if not provided by API
        }

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

        return user as SlackUser
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

// No additional exports here - only exporting the provider component
// All other exports are from SlackUserContextExports.ts
