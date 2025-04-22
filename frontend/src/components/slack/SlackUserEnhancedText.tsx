import React from 'react'
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
 * 2. Processing text paragraph by paragraph for better layout
 */
const SlackUserEnhancedText: React.FC<SlackUserEnhancedTextProps> = ({
  text,
  workspaceId,
  resolveMentions = true,
}) => {
  // Just pass directly to MessageText which already handles user mentions
  // This approach correctly handles mentions and reduces opportunity for errors
  return (
    <Box>
      {text.split('\n').map((paragraph, index) => {
        if (!paragraph.trim()) {
          return <Box key={`p-${index}`} height="1em" />
        }
        
        return (
          <Box key={`p-${index}`} mb={2}>
            <MessageText
              text={paragraph}
              workspaceId={workspaceId}
              resolveMentions={resolveMentions}
              fallbackToSimpleFormat={true}
            />
          </Box>
        )
      })}
    </Box>
  )
}

export default SlackUserEnhancedText