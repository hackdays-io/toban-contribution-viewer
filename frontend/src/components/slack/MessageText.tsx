import React, { useState, useCallback } from 'react'
import { Box } from '@chakra-ui/react'
import SlackUserDisplay from './SlackUserDisplay'
import { SlackUserCacheProvider } from './SlackUserContext'
interface MessageTextProps {
  text: string
  workspaceId: string // Required to fetch user data
  resolveMentions?: boolean // Whether to resolve user mentions with SlackUserDisplay
  fallbackToSimpleFormat?: boolean // When true, falls back to simple @ID format on error
  resourceAnalysisId?: string // Optional: ChannelAnalysis ID to use as fallback when workspaceId is empty
}

/**
 * Component that formats Slack message text:
 * - Replaces newlines with line breaks
 * - Replaces user mentions like <@U12345> with user names using SlackUserDisplay
 * - Falls back to showing @U12345 if resolveMentions is false
 */
const MessageText: React.FC<MessageTextProps> = ({
  text,
  workspaceId,
  resolveMentions = true,
  fallbackToSimpleFormat = true,
  resourceAnalysisId,
}) => {
  // Track which user IDs had errors during resolution
  const [errorUserIds, setErrorUserIds] = useState<Set<string>>(new Set())

  // Callback for handling user display errors
  const handleUserError = useCallback(
    (userId: string) => {
      if (fallbackToSimpleFormat) {
        setErrorUserIds((prev) => new Set([...prev, userId]))
      }
    },
    [fallbackToSimpleFormat]
  )
  if (!text) return null

  // Regular expression to find Slack user mentions in the format <@U12345>, <@U12345>:, or when the text already contains @U12345
  // This handles multiple formats commonly found in analysis text
  // Include underscore in the pattern to handle user IDs like ERROR_USER
  const mentionRegex = /(?:<@|@)([A-Z0-9_]+)>?:?/g

  // Extract all unique user mentions from the text
  const userMentions: string[] = []
  let match

  // Debug output to help diagnose issues with user mentions
  console.log(
    '[MessageText] Processing text:',
    text.substring(0, 100) + (text.length > 100 ? '...' : '')
  )
  console.log('[MessageText] Using workspaceId:', workspaceId)

  while ((match = mentionRegex.exec(text)) !== null) {
    if (!userMentions.includes(match[1])) {
      userMentions.push(match[1])
      console.log(
        '[MessageText] Found user mention:',
        match[1],
        'at position',
        match.index,
        'original format:',
        match[0]
      )
    }
  }

  // Reset regex index
  mentionRegex.lastIndex = 0

  // If we're not resolving mentions, just replace with @userId format
  if (!resolveMentions) {
    const formattedText = text
      // Replace all mention formats with @userId
      .replace(mentionRegex, (match, userId) => {
        // If it's already in @userId format, don't modify it
        if (match.startsWith('@') && !match.includes('>')) {
          return match
        }
        // Otherwise, format properly and preserve any trailing colon
        return '@' + userId + (match.endsWith(':') ? ':' : '')
      })
      // Replace newlines with <br /> elements
      .split('\n')
      .map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ))

    return <Box textAlign="left">{formattedText}</Box>
  }

  // Split text into segments - text and mentions
  const segments: React.ReactNode[] = []
  let lastIndex = 0

  // Reset regex index again
  mentionRegex.lastIndex = 0

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      const textSegment = text
        .substring(lastIndex, match.index)
        .split('\n')
        .map((line, i) => (
          <React.Fragment key={`text-${lastIndex}-${i}`}>
            {i > 0 && <br />}
            {line}
          </React.Fragment>
        ))
      segments.push(textSegment)
    }

    // Get the user ID from the match
    const userId = match[1]

    // Check if the match ended with a colon that we need to preserve
    const hasColon = match[0].endsWith(':')

    // Check if this was already in @userId format (not wrapped in <>)
    const wasSimpleFormat = match[0].startsWith('@') && !match[0].includes('>')

    // Check if this user ID previously had an error
    if (errorUserIds.has(userId)) {
      // Just use simple formatting for this user ID
      segments.push(
        <Box
          as="span"
          key={`mention-${match.index}`}
          display="inline"
          color="blue.500"
        >
          {/* Don't add @ prefix if it was already in @userId format */}
          {!wasSimpleFormat ? '@' : ''}
          {userId}
          {hasColon ? ':' : ''}
        </Box>
      )
    } else {
      // Attempt to display user with SlackUserDisplay
      segments.push(
        <Box
          as="span"
          key={`mention-${match.index}`}
          display="inline-flex"
          alignItems="center"
          verticalAlign="middle"
          color="blue.500"
        >
          {/* Don't add @ prefix if it was already in @userId format */}
          {!wasSimpleFormat && '@'}
          <SlackUserCacheProvider
            workspaceId={workspaceId}
          >
            <SlackUserDisplay
              userId={userId}
              workspaceId={workspaceId}
              displayFormat="username"
              fetchFromSlack={true} // Always try to fetch from Slack if user not in DB
              asComponent="span"
              fallback={userId} // Use the user ID as fallback if user data can't be fetched
              hideOnError={false} // Always show something, even on error
              onError={() => handleUserError(userId)} // Handle errors
            />
          </SlackUserCacheProvider>
          {/* Log that we're trying to display a user */}
          {/* Log attempt to display user */}
          {(() => {
            console.log(
              `[MessageText] Attempting to display user ${userId} from workspace ${workspaceId}`
            )
            return null
          })()}
          {hasColon ? ':' : ''}
        </Box>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after the last mention
  if (lastIndex < text.length) {
    const textSegment = text
      .substring(lastIndex)
      .split('\n')
      .map((line, i) => (
        <React.Fragment key={`text-${lastIndex}-${i}`}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ))
    segments.push(textSegment)
  }

  // We don't need to wrap with SlackUserCacheProvider here since
  // the parent components (ThreadView and MessageList) already provide it
  return <Box textAlign="left">{segments}</Box>
}

export default MessageText
