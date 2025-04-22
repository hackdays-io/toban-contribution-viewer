import React, { useState, useCallback, useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import MessageText from './MessageText'

interface SlackUserEnhancedTextProps {
  text: string
  workspaceId: string
  resolveMentions?: boolean
}

/**
 * Component that enhances text by:
 * 1. Using MessageText to handle standard Slack formatting and mentions
 * 2. Additionally scanning for standalone user IDs (not in <@...> format) and replacing them with SlackUserDisplay
 */
const SlackUserEnhancedText: React.FC<SlackUserEnhancedTextProps> = ({
  text,
  workspaceId,
  resolveMentions = true,
}) => {
  const [processedParagraphs, setProcessedParagraphs] = useState<
    React.ReactNode[]
  >([])

  // Function to process text and identify standalone user IDs
  const processText = useCallback(() => {
    if (!text || !workspaceId) return []

    // Regular expressions for different user ID formats
    // Match standalone user IDs (without @ prefix)
    const slackIdRegex = /\b(U[A-Z0-9]{8,})\b/g
    // Match user IDs with @ prefix
    const atSlackIdRegex = /@(U[A-Z0-9]{8,})\b/g

    // Process text paragraph by paragraph
    const paragraphs = text.split('\n')

    return paragraphs.map((paragraph, pIndex) => {
      if (!paragraph.trim()) {
        return <Box key={`p-${pIndex}`} height="1em" />
      }

      // First, replace any user IDs with @ prefix already
      let enhancedText = paragraph.replace(atSlackIdRegex, (_match, userId) => {
        return `<@${userId}>`
      })

      // Then replace any standalone Slack IDs without the @ prefix
      enhancedText = enhancedText.replace(slackIdRegex, (match) => {
        return `<@${match}>`
      })

      return (
        <Box key={`p-${pIndex}`} mb={2}>
          <MessageText
            text={enhancedText}
            workspaceId={workspaceId}
            resolveMentions={resolveMentions}
            fallbackToSimpleFormat={true}
          />
        </Box>
      )
    })
  }, [text, workspaceId, resolveMentions])

  // Process the text when inputs change
  useEffect(() => {
    setProcessedParagraphs(processText())
  }, [processText])

  return <Box>{processedParagraphs}</Box>
}

export default SlackUserEnhancedText
