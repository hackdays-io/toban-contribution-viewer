/**
 * Utility functions for rendering text content
 */
import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'
import MessageText from '../components/slack/MessageText'

/**
 * Check if a string is obviously not in JSON format
 * @param str The string to check
 * @returns True if the string is obviously not JSON
 */
export const isObviouslyNotJson = (str: string): boolean => {
  return !str.includes('{') && !str.includes('"') && !str.includes(':')
}

/**
 * Extract content for a specific section from markdown-formatted text
 * @param text The markdown text to extract from
 * @param sectionName The name of the section to extract
 * @returns The extracted section content
 */
export const extractSectionContent = (text: string, sectionName: string): string => {
  const regex = new RegExp(
    `#+\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=#+\\s*|$)`,
    'i'
  )
  const match = text.match(regex)
  return match ? match[1].trim() : ''
}

/**
 * Render plain text with proper formatting and support for markdown-like syntax
 * @param text The text to render
 * @param workspaceUuid The workspace UUID for resolving mentions
 * @returns Rendered React elements
 */
export const renderPlainText = (
  text: string | unknown,
  workspaceUuid: string | undefined
): React.ReactNode => {
  const textStr = typeof text === 'string' ? text : String(text || '')
  if (!textStr || textStr.trim().length === 0) {
    return <Text color="gray.500">No content available</Text>
  }

  let cleanedText = textStr

  if (/^\s*\{\s*\}\s*$/.test(cleanedText)) {
    return <Text color="gray.500">No content available</Text>
  }

  cleanedText = cleanedText.replace(/\\n/g, '\n')

  const isLikelyPlainText =
    /^[A-Za-z]/.test(cleanedText.trim()) &&
    !cleanedText.includes('```json') &&
    !(cleanedText.trim().startsWith('{') && cleanedText.trim().endsWith('}'))

  if (isLikelyPlainText) {
    return (
      <Box className="formatted-text">
        {cleanedText.split('\n').map((paragraph, index) => (
          <Box key={index} mb={2}>
            {paragraph.trim() ? (
              <MessageText
                text={paragraph}
                resolveMentions={true}
                fallbackToSimpleFormat={true}
                workspaceUuid={workspaceUuid ?? ''}
              />
            ) : (
              <Box height="0.7em" />
            )}
          </Box>
        ))}
      </Box>
    )
  }

  if (
    cleanedText.includes('{') &&
    cleanedText.includes('}') &&
    cleanedText.includes('"')
  ) {
    try {
      const contentMatch = cleanedText.match(/"[^"]+"\s*:\s*"([^"]*)"/)
      if (contentMatch && contentMatch[1]) {
        cleanedText = contentMatch[1].replace(/\\n/g, '\n')
      } else {
        cleanedText = cleanedText
          .replace(/[{}"]/g, '') // Remove braces and quotes
          .replace(/[\w_]+\s*:/g, '') // Remove field names
          .replace(/,\s*/g, '\n') // Replace commas with newlines
          .trim()
      }
    } catch (e) {
      console.warn('Error cleaning text content:', e)
    }
  }

  const hasMarkdownHeaders = /^#+\s+.+$/m.test(cleanedText)

  return (
    <Box className="formatted-text">
      {cleanedText.split('\n').map((paragraph, index) => {
        if (!paragraph.trim()) {
          return <Box key={index} height="0.7em" />
        }

        if (hasMarkdownHeaders && /^(#+)\s+(.+)$/.test(paragraph)) {
          const match = paragraph.match(/^(#+)\s+(.+)$/)
          if (match) {
            const level = match[1].length
            const headerText = match[2]

            const isTabHeader = [
              'Summary',
              'Topics',
              'Contributors',
              'Highlights',
            ].some((tab) =>
              headerText.toLowerCase().includes(tab.toLowerCase())
            )

            if (isTabHeader) {
              return <Box key={index} height="0.5em" /> // Skip this header
            }

            const size = level === 1 ? 'lg' : level === 2 ? 'md' : 'sm'
            return (
              <Heading
                as={`h${Math.min(level, 6)}` as React.ElementType}
                size={size}
                mt={4}
                mb={2}
                key={index}
              >
                {headerText}
              </Heading>
            )
          }
        }

        if (
          paragraph.trim().startsWith('- ') ||
          paragraph.trim().startsWith('* ')
        ) {
          return (
            <Box key={index} mb={2} pl={4} display="flex">
              <Box as="span" mr={2}>
                •
              </Box>
              <Box flex="1">
                <MessageText
                  text={paragraph.trim().substring(2)}
                  resolveMentions={true}
                  fallbackToSimpleFormat={true}
                  workspaceUuid={workspaceUuid ?? ''}
                />
              </Box>
            </Box>
          )
        }

        return (
          <Box key={index} mb={2}>
            <MessageText
              text={paragraph}
              resolveMentions={true}
              fallbackToSimpleFormat={true}
              workspaceUuid={workspaceUuid ?? ''}
            />
          </Box>
        )
      })}
    </Box>
  )
}
