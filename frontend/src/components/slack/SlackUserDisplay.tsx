import React, { useState, useEffect, useContext } from 'react'
import {
  Box,
  Avatar,
  Flex,
  // Spinner, // Uncomment if needed
  Tooltip,
  Link,
  // SkeletonText, // Uncomment if needed
  // SkeletonCircle, // Uncomment if needed
  useColorModeValue,
} from '@chakra-ui/react'

// Import the context types from exports file
import { UserCacheContext, SlackUser } from './SlackUserContextExports'

// Interface for the component props
export interface SlackUserDisplayProps {
  userId: string // Required: Slack user ID (e.g., database UUID)
  workspaceId?: string // Optional: Workspace ID (if not provided, will use context)
  showAvatar?: boolean // Optional: Whether to show the user's avatar (default: false)
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg' // Optional: Size of the avatar (default: 'sm')
  displayFormat?: 'username' | 'real_name' | 'both' // Optional: Display format (default: 'username')
  fallback?: string // Optional: Text to display if user info can't be fetched (default: userId)
  isLink?: boolean // Optional: Whether to make the name a clickable link to profile (default: false)
  asComponent?: React.ElementType // Optional: Render as a different component (default: 'span')
  hideOnError?: boolean // Optional: Hide component if there's an error fetching user info (default: false)
  fetchFromSlack?: boolean // Optional: Fetch user data from Slack API if not found in DB (default: false)
  onError?: (userId: string) => void // Optional: Callback for when an error occurs
  // For testing only - don't use in production
  _skipLoading?: boolean // Skip loading state (for testing)
  _testUser?: SlackUser | null // Provide test user (for testing)
  _hasError?: boolean // Set error state directly (for testing)
}

/**
 * Component to display Slack user information.
 *
 * Shows a user's name and optionally their avatar, with loading and error states.
 */
const SlackUserDisplay: React.FC<SlackUserDisplayProps> = ({
  userId,
  workspaceId,
  showAvatar = false,
  avatarSize = 'sm',
  displayFormat = 'username',
  fallback,
  isLink = false,
  asComponent = 'span',
  hideOnError = false,
  fetchFromSlack = false,
  onError,
  // For testing only - don't use in production
  _skipLoading = false,
  _testUser = null,
  _hasError = false,
}) => {
  const Component = asComponent
  const context = useContext(UserCacheContext)
  const [user, setUser] = useState<SlackUser | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(!_skipLoading)
  const [hasError, setHasError] = useState<boolean>(_hasError)

  // Color mode values
  const errorColor = useColorModeValue('red.500', 'red.300')

  // Effect to fetch user data if not in context cache
  useEffect(() => {
    console.log(
      `[SlackUserDisplay] Setting up for user: ${userId}, workspaceId: ${workspaceId}, fetchFromSlack: ${fetchFromSlack}`
    )
    if (!userId) return

    // For testing purposes, we can skip the loading and set a test user directly
    if (_skipLoading) {
      if (_testUser) {
        setUser(_testUser)
      }
      setIsLoading(false)
      return
    }

    // Extra safety check - if we don't have a workspaceId and no context,
    // we can't fetch the user data
    if (!workspaceId && !context) {
      console.warn(
        `SlackUserDisplay: Cannot fetch user ${userId} - no workspaceId and no context`
      )
      setHasError(true)
      setIsLoading(false)
      return
    }

    // Additional debugging logs
    console.log(
      `[SlackUserDisplay] Decision point - userId: ${userId}, workspaceId: ${workspaceId}, has context: ${!!context}`
    )

    const fetchUserData = async () => {
      // If not using context or context is not available
      if (!context && workspaceId) {
        setIsLoading(true)
        try {
          // Import the slackApiClient here to avoid circular dependencies
          const { slackApiClient } = await import('../../lib/slackApiClient')

          console.log(
            `[SlackUserDisplay] Direct fetch - workspaceId: ${workspaceId}, userId: ${userId}`
          )

          const result = await slackApiClient.getUsersByIds(
            workspaceId,
            [userId],
            true // fetchFromSlack=true
          )

          // Check if the result is an ApiError using the correct property check
          if ('status' in result && 'message' in result) {
            console.error('[SlackUserDisplay] API returned an error:', result)
            throw new Error(`API Error: ${result.message || 'Unknown error'}`)
          }

          const data = result

          if (
            data.users &&
            Array.isArray(data.users) &&
            data.users.length > 0
          ) {
            // Convert BaseSlackUser to SlackUser
            const apiUser = data.users[0]
            const userObject: SlackUser = {
              id: apiUser.id,
              slack_id: apiUser.slack_id || '',
              name: apiUser.name,
              display_name: apiUser.display_name || null,
              real_name: apiUser.real_name || null,
              profile_image_url: null, // Ensure this is present
            }
            setUser(userObject)
          } else {
            setHasError(true)
            // Call onError callback if provided
            if (onError) onError(userId)
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          setHasError(true)
          // Call onError callback if provided
          if (onError) onError(userId)
        } finally {
          setIsLoading(false)
        }
      } else if (context) {
        // Using context
        console.log(`[SlackUserDisplay] Using context for userId: ${userId}`)

        const cachedUser = context.getUser(userId)
        if (cachedUser) {
          console.log(
            `[SlackUserDisplay] Found cached user for ${userId}:`,
            cachedUser
          )
          setUser(cachedUser)
        } else if (context.isLoading(userId)) {
          console.log(
            `[SlackUserDisplay] User ${userId} is already loading in context`
          )
          setIsLoading(true)
        } else if (context.hasError(userId)) {
          console.log(
            `[SlackUserDisplay] Error state in context for user ${userId}`
          )
          setHasError(true)
          // Call onError callback if provided
          if (onError) onError(userId)
        } else {
          // This is the case where we need to fetch the user
          console.log(
            `[SlackUserDisplay] Need to fetch user ${userId} from context. Workspace ID: ${workspaceId}, fetchFromSlack: ${fetchFromSlack}`
          )
          setIsLoading(true)

          // Use the provided workspace ID or let the context use its default
          const wsId = workspaceId || undefined // Make sure it's properly typed
          console.log(
            `[SlackUserDisplay] Calling context.fetchUser for userId: ${userId}, wsId: ${wsId}`
          )
          const fetchedUser = await context.fetchUser(userId, wsId)

          if (fetchedUser) {
            console.log(
              `[SlackUserDisplay] Successfully fetched user data from context:`,
              fetchedUser
            )
            setUser(fetchedUser)
          } else {
            console.log(
              `[SlackUserDisplay] Failed to fetch user data from context for userId: ${userId}`
            )
            setHasError(true)
            // Call onError callback if provided
            if (onError) onError(userId)
          }
          setIsLoading(false)
        }
      }
    }

    fetchUserData()
  }, [
    userId,
    workspaceId,
    context,
    _skipLoading,
    _testUser,
    fetchFromSlack,
    onError,
  ])

  // Subscribe to changes in context for this user
  useEffect(() => {
    if (!context || !userId) return

    const intervalId = setInterval(() => {
      const cachedUser = context.getUser(userId)
      const userIsLoading = context.isLoading(userId)
      const userHasError = context.hasError(userId)

      if (cachedUser) {
        setUser(cachedUser)
        setIsLoading(false)
      } else if (userIsLoading) {
        setIsLoading(true)
      } else if (userHasError) {
        setHasError(true)
        setIsLoading(false)
        // Call onError callback if provided
        if (onError) onError(userId)
      }
    }, 100) // Check every 100ms

    return () => clearInterval(intervalId)
  }, [userId, context, onError])

  // Function to get the display name
  const getDisplayName = (): string => {
    if (!user) return fallback || userId || 'Unknown User'

    switch (displayFormat) {
      case 'username':
        return user.name || 'Unknown User'
      case 'real_name':
        return user.real_name || user.name || 'Unknown User'
      case 'both':
        if (user.real_name && user.name && user.real_name !== user.name) {
          return `${user.real_name} (${user.name})`
        } else {
          return user.real_name || user.name || 'Unknown User'
        }
      default:
        return (
          user.display_name || user.real_name || user.name || 'Unknown User'
        )
    }
  }

  // Handle loading state
  if (isLoading) {
    return (
      <Flex as={Component} align="center">
        {showAvatar && (
          <Box as="span" mr={2}>
            ⭐
          </Box>
        )}
        <Box as="span">Loading...</Box>
      </Flex>
    )
  }

  // Handle error state
  if (hasError) {
    // Call the onError callback if provided
    if (onError && userId) {
      onError(userId)
    }

    if (hideOnError) return null

    return (
      <Tooltip label="Error loading user data">
        <Box as={Component} color={errorColor} fontSize="sm">
          {fallback || userId || 'Unknown User'}
        </Box>
      </Tooltip>
    )
  }

  // Render with user data
  return (
    <Flex as={Component} align="center">
      {showAvatar && (
        <Avatar
          size={avatarSize}
          name={getDisplayName()}
          src={user?.profile_image_url || undefined}
          mr={2}
        />
      )}

      {isLink ? (
        <Link color="blue.500" href={`#user-${userId}`}>
          {getDisplayName()}
        </Link>
      ) : (
        <Box as="span">{getDisplayName()}</Box>
      )}
    </Flex>
  )
}

export default SlackUserDisplay
