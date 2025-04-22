import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import SlackUserDisplay from './SlackUserDisplay'

interface SlackUserEnhancedTextProps {
  text: string
  workspaceId: string
}

/**
 * Component that enhances text by:
 * 1. Properly formatting Slack user IDs in analysis text
 * 2. Processing text paragraph by paragraph for better layout
 * 3. Handling both <@U12345> format and direct U12345 mentions
 */
const SlackUserEnhancedText: React.FC<SlackUserEnhancedTextProps> = ({
  text,
  workspaceId,
}) => {
  // Regex to find both <@U12345> format and standalone U12345 formats
  const userIdRegex = /(?:<@(U[A-Z0-9]+)>)|(?:\b(U[A-Z0-9]{8,})\b)/g

  // Process the text to replace user IDs
  const processText = (paragraph: string) => {
    if (!paragraph.trim()) return null

    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    // Reset regex for each use
    userIdRegex.lastIndex = 0

    while ((match = userIdRegex.exec(paragraph)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(paragraph.substring(lastIndex, match.index))
      }

      // Get the user ID (either from <@U12345> or direct U12345 format)
      const userId = match[1] || match[2]

      // Add the user display component
      parts.push(
        <Box as="span" display="inline" key={`user-${match.index}`}>
          @
          <SlackUserDisplay
            userId={userId}
            workspaceId={workspaceId}
            displayFormat="username"
            asComponent="span"
            fallback={userId} 
            hideOnError={false}
          />
        </Box>
      )

      // Update the last index
      lastIndex = match.index + match[0].length
    }

    // Add any remaining text
    if (lastIndex < paragraph.length) {
      parts.push(paragraph.substring(lastIndex))
    }

    // If no user IDs were found, just return the original paragraph
    if (parts.length === 0) {
      return <Text>{paragraph}</Text>
    }

    return <Text>{parts}</Text>
  }

  return (
    <Box>
      {text.split('\n').map((paragraph, index) => {
        if (!paragraph.trim()) {
          return <Box key={`p-${index}`} height="1em" />
        }
        
        return (
          <Box key={`p-${index}`} mb={2}>
            {processText(paragraph)}
          </Box>
        )
      })}
    </Box>
  )
}

export default SlackUserEnhancedText