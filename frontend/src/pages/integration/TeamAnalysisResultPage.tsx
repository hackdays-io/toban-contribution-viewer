import React, { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
  useClipboard,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import {
  FiArrowLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiFileText,
  FiMessageSquare,
  FiShare2,
  FiUsers,
} from 'react-icons/fi'
import { Link, useParams, useNavigate } from 'react-router-dom'
import MessageText from '../../components/slack/MessageText'
import { SlackUserCacheProvider } from '../../components/slack/SlackUserContext'
import useIntegration from '../../context/useIntegration'
import integrationService, {
  ServiceResource,
} from '../../lib/integrationService'

interface AnalysisResponse {
  id: string
  channel_id: string
  channel_name: string
  start_date: string
  end_date: string
  message_count: number
  participant_count: number
  thread_count: number
  reaction_count: number
  channel_summary: string
  topic_analysis: string
  contributor_insights: string
  key_highlights: string
  model_used: string
  generated_at: string
  workspace_id?: string // Added for Slack user display support
}

interface Channel extends ServiceResource {
  type: string
  topic?: string
  purpose?: string
}

/**
 * Improved Analysis Result Page component that provides a more accessible
 * and feature-rich way to view analysis results.
 */
const TeamAnalysisResultPage: React.FC = () => {
  const { integrationId, channelId, analysisId } = useParams<{
    integrationId: string
    channelId: string
    analysisId: string
  }>()

  const navigate = useNavigate()
  const toast = useToast()
  const {
    currentResources,
    currentIntegration,
    fetchIntegration,
    fetchResources,
  } = useIntegration()

  const [channel, setChannel] = useState<Channel | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const highlightBg = useColorModeValue('purple.50', 'purple.800')

  // Create share URL for the current analysis based on URL type
  const isTeamAnalysis = window.location.pathname.includes('/team-analysis/');
  const shareUrl = isTeamAnalysis
    ? `${window.location.origin}/dashboard/integrations/${integrationId}/team-analysis/${analysisId}`
    : `${window.location.origin}/dashboard/integrations/${integrationId}/channels/${channelId}/analysis/${analysisId}`;
  const { hasCopied, onCopy } = useClipboard(shareUrl)

  useEffect(() => {
    // Different conditions for team analysis vs channel analysis
    if (isTeamAnalysis) {
      // For team analysis, we only need integrationId and analysisId
      if (integrationId && analysisId) {
        fetchData();
      }
    } else {
      // For channel analysis, we need all three IDs
      if (integrationId && channelId && analysisId) {
        fetchData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, channelId, analysisId, isTeamAnalysis])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Format datetime for display
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  /**
   * Fetch analysis data from API
   */
  const fetchData = async () => {
    try {
      setIsLoading(true)


      // Fetch integration info
      try {
        if (integrationId) {
          await fetchIntegration(integrationId)
        }
      } catch (error) {
        // Error will be handled later in the direct API call
      }

      // Check if this is a team analysis (cross-resource) result by checking the URL pattern
      const isTeamAnalysis = window.location.pathname.includes('/team-analysis/');

      // For team analysis, we need to use a different API endpoint
      if (isTeamAnalysis) {
        // Try to get integration data through context or direct API call
        let teamId;
        let directIntegration = null;

        // First try context
        if (currentIntegration) {
          teamId = currentIntegration.owner_team.id;
        } else {
          // If context doesn't have it yet, get it directly
          const integrationResult = await integrationService.getIntegration(integrationId);
          
          if (!integrationService.isApiError(integrationResult)) {
            directIntegration = integrationResult;
            teamId = directIntegration.owner_team.id;
          } else {
            // Failed to get integration data
            toast({
              title: 'Error',
              description: 'Failed to load integration data for analysis.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
            setIsLoading(false);
            return;
          }
        }
        
        // Now fetch the cross-resource report
        const reportResult = await integrationService.getCrossResourceReport(
          teamId,
          analysisId || ''
        );
          
          // Check if there was an error
          if (integrationService.isApiError(reportResult)) {
            console.error("Error fetching cross-resource report:", reportResult);
            toast({
              title: 'Error',
              description: `Failed to load team analysis: ${reportResult.message}`,
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
            setIsLoading(false);
            return;
          }
          
          
          // Extract data from the report to match our Analysis interface format
          // This is a temporary solution until we implement proper cross-resource report handling
          if (reportResult.resource_analyses && reportResult.resource_analyses.length > 0) {
            // Use the first resource analysis as a template
            const firstAnalysis = reportResult.resource_analyses[0];
            
            // Construct an analysis object using data from the report and first resource analysis
            const adaptedAnalysis: AnalysisResponse = {
              id: reportResult.id,
              channel_id: firstAnalysis.resource_id,
              channel_name: reportResult.title || "Cross-resource Report",
              start_date: reportResult.date_range_start,
              end_date: reportResult.date_range_end,
              message_count: reportResult.total_resources || 0,
              participant_count: reportResult.completed_analyses || 0,
              thread_count: reportResult.resource_analyses?.length || 0,
              reaction_count: 0,
              channel_summary: reportResult.description || "Cross-resource analysis report",
              topic_analysis: "Multiple resource analysis - see individual analyses for details",
              contributor_insights: "Multiple resource analysis - see individual analyses for details",
              key_highlights: "Multiple resource analysis - see individual analyses for details",
              model_used: firstAnalysis.model_used || "N/A",
              generated_at: reportResult.created_at || new Date().toISOString(),
              workspace_id: directIntegration ? directIntegration.id : currentIntegration.id // Use integration ID as workspace ID for display
            };
            
            setAnalysis(adaptedAnalysis);
          } else {
            toast({
              title: 'No Analyses Found',
              description: 'This team analysis report does not contain any resource analyses.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
          }
        } else {
          console.error("Cannot fetch team analysis without integration data");
          toast({
            title: 'Error',
            description: 'Failed to load team data for analysis. Please try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
        
        setIsLoading(false);
        return;
      }

      // Regular single-channel analysis flow:
      // Fetch channel from resource list
      if (integrationId && channelId) {
        await fetchResources(integrationId)
        const channelResource = currentResources.find(
          (resource) => resource.id === channelId
        )
        if (channelResource) {
          setChannel(channelResource as Channel)
        }
      }

      // Fetch the specific analysis using the integration service
      const analysisResult = await integrationService.getResourceAnalysis(
        integrationId || '',
        channelId || '',
        analysisId || ''
      )

      // Check if the result is an API error
      if (integrationService.isApiError(analysisResult)) {
        throw new Error(`Error fetching analysis: ${analysisResult.message}`)
      }

      // Validate successful load of analysis data

      // Set the analysis data, casting it to the expected type
      setAnalysis(analysisResult as unknown as AnalysisResponse)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load analysis data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle share button click
   */
  const handleShare = () => {
    onCopy()
    toast({
      title: 'Link copied',
      description: 'Analysis link copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }

  /**
   * Export analysis as text file
   */
  const handleExport = () => {
    if (!analysis) return

    const content = `
# Channel Analysis: #${analysis.channel_name}
Workspace: ${currentIntegration?.name || 'Workspace'}
Period: ${formatDate(analysis.start_date)} to ${formatDate(analysis.end_date)}
Generated: ${formatDateTime(analysis.generated_at)}

## Statistics
- Messages: ${analysis.message_count}
- Participants: ${analysis.participant_count}
- Threads: ${analysis.thread_count}
- Reactions: ${analysis.reaction_count}

## Channel Summary
${analysis.channel_summary}

## Topic Analysis
${analysis.topic_analysis}

## Contributor Insights
${analysis.contributor_insights}

## Key Highlights
${analysis.key_highlights}

---
Generated using Toban Contribution Viewer with ${analysis.model_used}
    `.trim()

    // Create downloadable file
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `channel-analysis-${analysis.channel_name}-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)

    toast({
      title: 'Export complete',
      description: 'Analysis exported as Markdown file',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }

  /**
   * Format text with message components to handle Slack formatting
   * Enhanced to handle more JSON formats and provide better error recovery
   * @deprecated This function is kept for reference but is no longer used directly
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatText = (text: string, sectionType?: string) => {
    if (!text) return null

    // SPECIAL CASE: If we're looking for a section OTHER than channel_summary,
    // first check if the channel_summary might contain all sections as JSON
    if (
      sectionType &&
      sectionType !== 'channel_summary' &&
      analysis?.channel_summary
    ) {
      try {
        // Check if channel_summary contains JSON
        const summaryText = analysis.channel_summary

        // First check for JSON in code blocks
        if (summaryText.includes('```json') && summaryText.includes('```')) {
          const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/
          const match = summaryText.match(codeBlockRegex)
          if (match && match[1]) {
            try {
              const parsed = JSON.parse(match[1].trim())
              if (sectionType in parsed) {
                return renderPlainText(
                  parsed[sectionType as keyof typeof parsed] as string
                )
              }
            } catch (e) {
              console.warn(
                'Failed to parse channel_summary code block as JSON:',
                e
              )
            }
          }
        }

        // Then check if the entire channel_summary is JSON
        if (
          summaryText.trim().startsWith('{') &&
          summaryText.trim().endsWith('}')
        ) {
          try {
            const parsed = JSON.parse(summaryText)
            if (sectionType in parsed) {
              return renderPlainText(
                parsed[sectionType as keyof typeof parsed] as string
              )
            }
          } catch (e) {
            console.warn('Failed to parse channel_summary as direct JSON:', e)
          }
        }
      } catch (error) {
        console.error('Error checking channel_summary for sections:', error)
      }
    }

    try {
      // STRATEGY 1: Handle code blocks - exact pattern match from database JSON+code block format
      if (text.includes('```json') && text.includes('```')) {
        // Extract content between code block markers using more robust regex
        const regex = /```json\s*([\s\S]*?)\s*```/g
        const matches = Array.from(text.matchAll(regex))

        for (const match of matches) {
          if (match && match[1]) {
            const jsonContent = match[1].trim()
            try {
              const parsed = JSON.parse(jsonContent)

              // If we have a specific section to render, extract it from the parsed JSON
              if (sectionType && sectionType in parsed) {
                return renderPlainText(
                  parsed[sectionType as keyof typeof parsed] as string
                )
              }

              return renderStructuredContent(parsed)
            } catch (e) {
              console.warn('Failed to parse code block content as JSON:', e)
              // Continue to next match if available
            }
          }
        }
        // Fall through to next strategy if all matches failed
      }

      // STRATEGY 2: Direct JSON parsing - for standard JSON objects
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(text)
          // If we have a specific section to render, extract it from the parsed JSON
          if (sectionType && sectionType in parsed) {
            return renderPlainText(
              parsed[sectionType as keyof typeof parsed] as string
            )
          }

          return renderStructuredContent(parsed)
        } catch (e) {
          console.warn('Failed to parse as direct JSON:', e)
          // Fall through to next strategy
        }
      }

      // STRATEGY 3: For JSON mixed with markdown or text
      const jsonIndicators = [
        '"channel_summary":',
        '"topic_analysis":',
        '"contributor_insights":',
        '"key_highlights":',
      ]
      if (jsonIndicators.some((indicator) => text.includes(indicator))) {
        // Try to extract just the JSON part
        const jsonExtractRegex = /(\{[\s\S]*\})/
        const jsonMatch = text.match(jsonExtractRegex)

        if (jsonMatch && jsonMatch[1]) {
          try {
            const extracted = jsonMatch[1].trim()
            const parsed = JSON.parse(extracted)
            // If we have a specific section to render, extract it from the parsed JSON
            if (sectionType && sectionType in parsed) {
              return renderPlainText(
                parsed[sectionType as keyof typeof parsed] as string
              )
            }

            return renderStructuredContent(parsed)
          } catch (e) {
            console.warn('Failed to parse extracted JSON:', e)
          }
        }

        // Try more aggressive reconstruction if extraction failed
        try {
          // Extract just the content we need
          const structuredContent: Record<string, string> = {}

          // Section extractors - using non-greedy pattern to avoid capturing too much
          const extractSection = (key: string): string | null => {
            const regex = new RegExp(
              `"${key}"\\s*:\\s*"([\\s\\S]*?)"(?:,|\\})`,
              'i'
            )
            const match = text.match(regex)
            return match && match[1] ? match[1] : null
          }

          // Try to extract each known section
          const sections = [
            'channel_summary',
            'topic_analysis',
            'contributor_insights',
            'key_highlights',
          ]
          let foundAnySection = false

          for (const section of sections) {
            const content = extractSection(section)
            if (content !== null) {
              structuredContent[section] = content
              foundAnySection = true
            }
          }

          if (foundAnySection) {
            console.log(
              'Manual extraction created object with keys:',
              Object.keys(structuredContent)
            )

            // If we have a specific section to render, and it was found, return just that section
            if (sectionType && sectionType in structuredContent) {
              console.log(
                `Found ${sectionType} in manually extracted content, rendering only that section`
              )
              return renderPlainText(structuredContent[sectionType])
            }

            return renderStructuredContent(structuredContent)
          }
        } catch (e) {
          console.warn('JSON section extraction failed:', e)
        }
      }

      // Special case: if sectionType is specified but we couldn't extract it from JSON,
      // try to directly render the provided text
      if (sectionType) {
        return renderPlainText(text)
      }

      // FALLBACK: If we couldn't parse as JSON, treat as regular text
      return renderPlainText(text)
    } catch (error) {
      console.error('Error in formatText:', error)
      return renderPlainText(text)
    }
  }

  /**
   * Extract content from the channel_summary field when it's in JSON format
   * @deprecated This function is kept for reference but is no longer used directly
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const extractChannelSummaryContent = (text: string): string => {
    if (!text || text.trim().length === 0) {
      return ''
    }

    // If text starts with { and contains "channel_summary", it's probably a JSON object
    if (text.trim().startsWith('{') && text.includes('"channel_summary"')) {
      try {
        // Try to parse it as JSON first
        const cleanedText = text.replace(/[^\x20-\x7E]/g, '')
        const jsonData = JSON.parse(cleanedText)

        // If it has a channel_summary field, return that
        if (jsonData.channel_summary) {
          return jsonData.channel_summary
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Try regex extraction as fallback
        const match = text.match(/"channel_summary"\s*:\s*"([^"]*)"/)
        if (match && match[1]) {
          return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
        }
      }
    }

    // Otherwise return the original text
    return text
  }

  /**
   * Render plain text with proper formatting and support for markdown-like syntax
   */
  const renderPlainText = (text: string) => {
    if (!text || text.trim().length === 0) {
      return <Text color="gray.500">No content available</Text>
    }

    // Clean up text content if it has strange characters (common in JSON parsing errors)
    let cleanedText = text

    // Check if text is just "{}" or similar
    if (/^\s*\{\s*\}\s*$/.test(cleanedText)) {
      return <Text color="gray.500">No content available</Text>
    }

    // Fix escaped newlines in the text
    cleanedText = cleanedText.replace(/\\n/g, '\n')

    // If text contains curly braces and quotes, it might be JSON-like structure
    // Try to clean it up by removing quotes and braces
    if (
      cleanedText.includes('{') &&
      cleanedText.includes('}') &&
      cleanedText.includes('"')
    ) {
      try {
        // First try to extract just the text content if it's in a "field": "value" format
        const contentMatch = cleanedText.match(/"[^"]+"\s*:\s*"([^"]*)"/)
        if (contentMatch && contentMatch[1]) {
          cleanedText = contentMatch[1].replace(/\\n/g, '\n')
        } else {
          // Remove all JSON syntax characters
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

    // First check if text might have markdown-style headers
    const hasMarkdownHeaders = /^#+\s+.+$/m.test(cleanedText)

    return (
      <Box className="formatted-text">
        {cleanedText.split('\n').map((paragraph, index) => {
          if (!paragraph.trim()) {
            return <Box key={index} height="0.7em" />
          }

          // Special handling for markdown-like headers
          if (hasMarkdownHeaders && /^(#+)\s+(.+)$/.test(paragraph)) {
            const match = paragraph.match(/^(#+)\s+(.+)$/)
            if (match) {
              const level = match[1].length
              const headerText = match[2]

              // Don't render headers that match our tab names to avoid duplication
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

              // Render other headers based on level
              const size = level === 1 ? 'lg' : level === 2 ? 'md' : 'sm'
              return (
                <Heading
                  as={`h${Math.min(level, 6)}`}
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

          // Handle bullet lists
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
                    workspaceId={analysis?.workspace_id || workspaceId || ''}
                    resolveMentions={true}
                    fallbackToSimpleFormat={true}
                  />
                </Box>
              </Box>
            )
          }

          // Regular paragraph handling
          return (
            <Box key={index} mb={2}>
              <MessageText
                text={paragraph}
                workspaceId={analysis?.workspace_id || workspaceId || ''}
                resolveMentions={true}
                fallbackToSimpleFormat={true}
              />
            </Box>
          )
        })}
      </Box>
    )
  }

  /**
   * Render structured content from parsed JSON or manually extracted object
   */
  const renderStructuredContent = (content: Record<string, unknown>) => {
    // Extract the different sections that we know should exist
    const {
      channel_summary,
      // The following sections are declared but not used directly in this function
      // as they are already being passed into the formatText function in the TabPanels
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      topic_analysis,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      contributor_insights,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      key_highlights,
      ...otherContent
    } = content

    // Function to render a single section with improved formatting
    const renderSection = (text: string | undefined, skipHeading = false) => {
      if (!text) return null

      // Check if content has markdown-style headers
      const hasMarkdownHeaders = /^#+\s+.+$/m.test(text)

      return (
        <Box>
          {!skipHeading && (
            <Box borderBottom="1px solid" borderColor="gray.200" pb={2} mb={4}>
              {/* Intentionally empty - let the tab panel header handle the section title */}
            </Box>
          )}

          {text.split('\n').map((para, pIdx) => {
            // Special handling for markdown-like headers within content
            if (hasMarkdownHeaders && /^(#+)\s+(.+)$/.test(para)) {
              const match = para.match(/^(#+)\s+(.+)$/)
              if (match) {
                const level = match[1].length
                const headerText = match[2]

                // Skip headers that match our tab names to avoid duplication
                const isTabHeader = [
                  'Summary',
                  'Topics',
                  'Contributors',
                  'Highlights',
                  'Channel Summary',
                  'Topic Analysis',
                  'Contributor Insights',
                  'Key Highlights',
                ].some((tab) =>
                  headerText.toLowerCase().includes(tab.toLowerCase())
                )

                if (isTabHeader) {
                  return <Box key={pIdx} height="0.5em" /> // Skip this header
                }

                // Render other headers based on level
                const size = level === 1 ? 'md' : 'sm'
                return (
                  <Heading
                    as={`h${Math.min(level + 2, 6)}`}
                    size={size}
                    mt={4}
                    mb={2}
                    key={pIdx}
                  >
                    {headerText}
                  </Heading>
                )
              }
            }

            return (
              <Box key={pIdx} mb={3}>
                {para.trim() ? (
                  <MessageText
                    text={para}
                    workspaceId={analysis?.workspace_id || workspaceId || ''}
                    resolveMentions={true}
                    fallbackToSimpleFormat={true}
                  />
                ) : (
                  <Box height="0.7em" />
                )}
              </Box>
            )
          })}
        </Box>
      )
    }

    // Render the main sections we expect in the JSON structure
    return (
      <Box>
        {renderSection(channel_summary, true)}

        {/* Any other content we didn't specifically handle */}
        {Object.entries(otherContent).map(([key, value]) => {
          // Skip empty values and special keys we don't want to display
          if (
            !value ||
            [
              'id',
              'channel_id',
              'channel_name',
              'model_used',
              'generated_at',
            ].includes(key)
          ) {
            return null
          }

          // Format key for display
          const formattedKey = key
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          // Check if formattedKey matches any tab name and skip if it does
          const matchesTabName = [
            'Summary',
            'Topics',
            'Contributors',
            'Highlights',
          ].some((tab) =>
            formattedKey.toLowerCase().includes(tab.toLowerCase())
          )

          if (matchesTabName) {
            return null // Skip this section to avoid duplication
          }

          return (
            <Box key={key} mt={6} p={3} bg="gray.50" borderRadius="md">
              <Heading as="h4" size="sm" mb={3} color="gray.700">
                {formattedKey}
              </Heading>
              {typeof value === 'string' ? (
                renderSection(value, true)
              ) : (
                <Box
                  fontFamily="monospace"
                  bg="white"
                  p={3}
                  borderRadius="md"
                  whiteSpace="pre-wrap"
                >
                  {JSON.stringify(value, null, 2)}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  }

  /**
   * Extract all sections from channel summary if other fields are missing
   * This is a special extraction function when the API returns only a channel_summary
   * that contains all other sections embedded in it
   */
  const extractMissingFields = () => {
    if (!analysis || !analysis.channel_summary) {
      return analysis
    }

    // Always try to extract, even if the fields exist but are empty
    const hasEmptyFields =
      !analysis.topic_analysis ||
      analysis.topic_analysis.trim() === '' ||
      !analysis.contributor_insights ||
      analysis.contributor_insights.trim() === '' ||
      !analysis.key_highlights ||
      analysis.key_highlights.trim() === ''

    if (!hasEmptyFields) {
      return analysis
    }
    const extracted = { ...analysis }
    const summary = analysis.channel_summary

    // Try to extract JSON from the summary
    let jsonContent = null

    // First try to extract from code blocks
    if (summary.includes('```json') && summary.includes('```')) {
      const regex = /```json\s*([\s\S]*?)\s*```/
      const match = summary.match(regex)

      if (match && match[1]) {
        try {
          jsonContent = JSON.parse(match[1].trim())
        } catch (e) {
          console.warn('Failed to parse code block in summary as JSON', e)
        }
      }
    }

    // Then try to parse the entire summary as JSON
    if (
      !jsonContent &&
      summary.trim().startsWith('{') &&
      summary.trim().endsWith('}')
    ) {
      try {
        // Try cleaning up the control characters first
        const cleanedSummary = summary.replace(/[^\x20-\x7E]/g, '')
        jsonContent = JSON.parse(cleanedSummary)
      } catch (e) {
        console.warn('Failed to parse entire summary as JSON', e)
      }
    }

    // Check if we found any JSON content
    if (jsonContent) {
      // Extract each missing section
      if (
        (!extracted.topic_analysis || extracted.topic_analysis.trim() === '') &&
        'topic_analysis' in jsonContent
      ) {
        extracted.topic_analysis = jsonContent.topic_analysis
      }

      if (
        (!extracted.contributor_insights ||
          extracted.contributor_insights.trim() === '') &&
        'contributor_insights' in jsonContent
      ) {
        extracted.contributor_insights = jsonContent.contributor_insights
      }

      if (
        (!extracted.key_highlights || extracted.key_highlights.trim() === '') &&
        'key_highlights' in jsonContent
      ) {
        extracted.key_highlights = jsonContent.key_highlights
      }
    }

    // Try regex extraction as a fallback

    const extractSection = (key: string): string | null => {
      // Use a more lenient regex to handle various JSON formats
      // This handles both "key": "value" format and "key":"value" format
      const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?:,|\\})`, 'i')
      const match = summary.match(regex)

      if (match && match[1]) {
        // Clean up escaped quotes in the extracted text
        return match[1].replace(/\\"/g, '"')
      }

      // Try alternative regex without quotes around the value (e.g. "key": value)
      const altRegex = new RegExp(`"${key}"\\s*:\\s*([^,"{}]+)(?:,|\\})`, 'i')
      const altMatch = summary.match(altRegex)

      return altMatch && altMatch[1] ? altMatch[1].trim() : null
    }

    // Extract each missing section
    if (!extracted.topic_analysis || extracted.topic_analysis.trim() === '') {
      const content = extractSection('topic_analysis')
      if (content) {
        extracted.topic_analysis = content
      }
    }

    if (
      !extracted.contributor_insights ||
      extracted.contributor_insights.trim() === ''
    ) {
      const content = extractSection('contributor_insights')
      if (content) {
        extracted.contributor_insights = content
      }
    }

    if (!extracted.key_highlights || extracted.key_highlights.trim() === '') {
      const content = extractSection('key_highlights')
      if (content) {
        extracted.key_highlights = content
      }
    }

    return extracted
  }

  // Try to get the workspace ID from different sources
  const workspaceId = analysis?.workspace_id || currentIntegration?.id

  // Try to extract missing sections if needed
  let enrichedAnalysis = analysis ? extractMissingFields() : null

  // Directly extract content from channel_summary to appropriate tab fields
  if (enrichedAnalysis) {
    const fixedAnalysis = { ...enrichedAnalysis }

    if (analysis && analysis.channel_summary) {
      try {
        // Try to parse the channel_summary as JSON
        const parsedJson = JSON.parse(analysis.channel_summary)

        // Use the JSON values directly
        fixedAnalysis.fixedChannelSummary = parsedJson.channel_summary || ''
        fixedAnalysis.fixedTopicAnalysis = parsedJson.topic_analysis || ''
        fixedAnalysis.fixedContributorInsights =
          parsedJson.contributor_insights || ''
        fixedAnalysis.fixedKeyHighlights = parsedJson.key_highlights || ''

        enrichedAnalysis = fixedAnalysis
        return enrichedAnalysis
      } catch (e) {
        console.warn('Failed to parse channel_summary as JSON:', e)
      }
    }

    // If the direct JSON parsing approach didn't work, fall back to regex

    // Define regex patterns for each section
    const extractSectionContent = (
      content: string,
      sectionName: string
    ): string => {
      const regex = new RegExp(
        `"${sectionName}"\\s*:\\s*"([\\s\\S]*?)(?:"\\s*,|"\\s*})`,
        'i'
      )
      const match = content.match(regex)
      if (match && match[1]) {
        return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
      }
      return ''
    }

    // Apply to each section
    if (analysis && analysis.channel_summary) {
      const summaryContent = analysis.channel_summary

      // Extract each section directly from the JSON string
      fixedAnalysis.fixedChannelSummary = extractSectionContent(
        summaryContent,
        'channel_summary'
      )
      fixedAnalysis.fixedTopicAnalysis = extractSectionContent(
        summaryContent,
        'topic_analysis'
      )
      fixedAnalysis.fixedContributorInsights = extractSectionContent(
        summaryContent,
        'contributor_insights'
      )
      fixedAnalysis.fixedKeyHighlights = extractSectionContent(
        summaryContent,
        'key_highlights'
      )
    }

    enrichedAnalysis = fixedAnalysis
  }

  // Don't render slack components if no workspace ID is available
  if (!workspaceId && !isLoading) {
    return (
      <Box p={4}>
        {/* Render the same content without the SlackUserCacheProvider */}
        <Flex
          justifyContent="center"
          alignItems="center"
          direction="column"
          py={8}
        >
          <Icon as={FiFileText} boxSize={12} color="gray.400" mb={4} />
          <Heading as="h2" size="lg" mb={4}>
            Integration Data Unavailable
          </Heading>
          <Text mb={6}>
            Unable to load Slack workspace data for this analysis.
          </Text>
          <Button as={Link} to="/dashboard/integrations" colorScheme="purple">
            Return to Integrations
          </Button>
        </Flex>
      </Box>
    )
  }

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <Flex justify="center" align="center" height="50vh" width="100%">
        <VStack spacing={6}>
          <Spinner size="xl" thickness="4px" color="purple.500" />
          <Text>Loading analysis results...</Text>
        </VStack>
      </Flex>
    )
  }

  /**
   * Render error state if no analysis found
   */
  if (!analysis) {
    return (
      <Box textAlign="center" p={8}>
        <Icon as={FiFileText} boxSize={12} color="gray.400" mb={4} />
        <Heading as="h2" size="lg" mb={4}>
          Analysis Not Found
        </Heading>
        <Text mb={6}>
          The requested analysis could not be found or has been deleted.
        </Text>
        <Button
          as={Link}
          to={`/dashboard/integrations/${integrationId}/channels/${channelId}/history`}
          colorScheme="purple"
        >
          View All Analyses
        </Button>
      </Box>
    )
  }

  // Get channel name, first trying channel object, then analysis data
  const channelName = channel?.name
    ? channel.name.startsWith('#')
      ? channel.name
      : `#${channel.name}`
    : analysis?.channel_name
      ? analysis.channel_name.startsWith('#')
        ? analysis.channel_name
        : `#${analysis.channel_name}`
      : '#channel'

  // EMERGENCY DIRECT FIX: Extract channel summary text from the raw channel_summary field
  let fixedChannelSummary = ''
  if (analysis?.channel_summary) {
    // Try to find the channel_summary field inside the JSON
    const match = analysis.channel_summary.match(
      /"channel_summary"\s*:\s*"([^"]*)"/
    )
    if (match && match[1]) {
      console.log('Extracted channel_summary directly')
      fixedChannelSummary = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    } else {
      // Just use the raw channel_summary
      fixedChannelSummary = analysis.channel_summary
    }
  }

  // Add CSS style to better handle JSON content formatting
  const customStyles = `
    /* Hide duplicate headings in content */
    .analysis-content h1, 
    .analysis-content h2,
    .analysis-content h3 {
      display: none;
    }
    
    /* Better format paragraph content */
    .analysis-content p {
      margin-bottom: 0.75rem;
    }
    
    /* Enhance list formatting */
    .analysis-content ul, 
    .analysis-content ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }
    
    /* Improve nested content rendering */
    .formatted-text ul, 
    .formatted-text ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }
    
    /* Special formatting for user mentions in analysis text */
    .analysis-content [class*="mention"] {
      color: #6B46C1;
      font-weight: 500;
    }
  `

  return (
    <SlackUserCacheProvider
      workspaceId={analysis?.workspace_id || workspaceId || ''}
    >
      {/* Apply custom CSS to hide duplicate headings */}
      <style>{customStyles}</style>
      <Box width="100%">
        {/* Breadcrumb navigation */}
        <Breadcrumb
          spacing="8px"
          separator={<Icon as={FiChevronRight} color="gray.500" />}
          mb={4}
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/dashboard/analytics">
              Analytics
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink
              as={Link}
              to={`/dashboard/integrations/${integrationId}`}
            >
              {currentIntegration?.name || 'Integration'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink
              as={Link}
              to={`/dashboard/integrations/${integrationId}/channels/${channelId}/history`}
            >
              {channelName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>Analysis</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Header with actions */}
        <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={4} mb={6}>
          <GridItem>
            <Flex direction="column">
              <HStack mb={1}>
                <Icon as={FiMessageSquare} color="purple.500" />
                <Heading as="h1" size="lg">
                  {channelName} Analysis
                </Heading>
                <Badge colorScheme="purple" fontSize="sm">
                  {formatDate(analysis.start_date)} -{' '}
                  {formatDate(analysis.end_date)}
                </Badge>
              </HStack>
              <Text color="gray.600">
                {currentIntegration?.name || 'Workspace'} • Generated on{' '}
                {formatDateTime(analysis.generated_at)}
              </Text>
            </Flex>
          </GridItem>

          <GridItem>
            <Flex
              justify={{ base: 'flex-start', md: 'flex-end' }}
              mt={{ base: 2, md: 0 }}
            >
              <HStack spacing={2}>
                <Button
                  leftIcon={<Icon as={FiArrowLeft} />}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/dashboard/integrations/${integrationId}/channels/${channelId}/analyze`
                    )
                  }
                >
                  Back to Analysis
                </Button>
                <Tooltip label="Copy share link" hasArrow>
                  <IconButton
                    aria-label="Share analysis"
                    icon={<Icon as={FiShare2} />}
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    colorScheme={hasCopied ? 'green' : 'gray'}
                  />
                </Tooltip>
                <Tooltip label="Export as file" hasArrow>
                  <IconButton
                    aria-label="Export analysis"
                    icon={<Icon as={FiDownload} />}
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                  />
                </Tooltip>
              </HStack>
            </Flex>
          </GridItem>
        </Grid>

        {/* Stats overview */}
        <Card variant="outline" mb={6}>
          <CardBody>
            <SimpleGrid
              columns={{ base: 2, md: 4 }}
              spacing={{ base: 4, md: 8 }}
            >
              <Stat>
                <StatLabel>Messages</StatLabel>
                <StatNumber>
                  {analysis.message_count.toLocaleString()}
                </StatNumber>
                <StatHelpText>Total messages analyzed</StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Participants</StatLabel>
                <StatNumber>{analysis.participant_count}</StatNumber>
                <StatHelpText>Active contributors</StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Threads</StatLabel>
                <StatNumber>{analysis.thread_count}</StatNumber>
                <StatHelpText>Discussion threads</StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Reactions</StatLabel>
                <StatNumber>{analysis.reaction_count}</StatNumber>
                <StatHelpText>Emoji reactions</StatHelpText>
              </Stat>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Main content tabs */}
        <Tabs
          colorScheme="purple"
          variant="enclosed-colored"
          index={activeTab}
          onChange={setActiveTab}
          isLazy
        >
          <TabList>
            <Tab>Summary</Tab>
            <Tab>Topics</Tab>
            <Tab>Contributors</Tab>
            <Tab>Highlights</Tab>
          </TabList>

          <TabPanels>
            {/* Summary Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card
                variant="outline"
                height="100%"
                bg={highlightBg}
                boxShadow="sm"
              >
                <CardHeader pb={1}>
                  <Heading size="md" color="purple.700">
                    Channel Summary
                  </Heading>
                </CardHeader>
                <CardBody pt={2}>
                  <Box
                    className="analysis-content"
                    sx={{
                      // Hide duplicate markdown headers that match our tab title
                      'h1:first-of-type:contains("Channel Summary"), h2:first-of-type:contains("Channel Summary"), h3:first-of-type:contains("Summary")':
                        {
                          display: 'none',
                        },
                    }}
                  >
                    {renderPlainText(
                      enrichedAnalysis.fixedChannelSummary ||
                        fixedChannelSummary
                    )}
                  </Box>
                </CardBody>
              </Card>
            </TabPanel>

            {/* Topics Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card
                variant="outline"
                height="100%"
                bg={highlightBg}
                boxShadow="sm"
              >
                <CardHeader pb={1}>
                  <Heading size="md" color="purple.700">
                    Topic Analysis
                  </Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {/* Check if we actually have topic_analysis data */}
                  {enrichedAnalysis?.fixedTopicAnalysis ||
                  enrichedAnalysis?.topic_analysis ? (
                    <Box
                      className="analysis-content"
                      sx={{
                        // Hide duplicate markdown headers that match our tab title
                        'h1:first-of-type:contains("Topic Analysis"), h2:first-of-type:contains("Topic Analysis"), h3:first-of-type:contains("Topics")':
                          {
                            display: 'none',
                          },
                      }}
                    >
                      {renderPlainText(
                        (
                          enrichedAnalysis.fixedTopicAnalysis ||
                          enrichedAnalysis.topic_analysis
                        ).replace(/(\d+\.\s)/g, '\n$1')
                      )}
                    </Box>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No topic analysis data available
                    </Text>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            {/* Contributors Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card
                variant="outline"
                height="100%"
                bg={highlightBg}
                boxShadow="sm"
              >
                <CardHeader pb={1}>
                  <Heading size="md" color="purple.700">
                    Contributor Insights
                  </Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {/* Check if we actually have contributor_insights data */}
                  {enrichedAnalysis?.fixedContributorInsights ||
                  enrichedAnalysis?.contributor_insights ? (
                    <Box
                      className="analysis-content"
                      sx={{
                        // Hide duplicate markdown headers that match our tab title
                        'h1:first-of-type:contains("Contributor Insights"), h2:first-of-type:contains("Contributor"), h3:first-of-type:contains("Contributors")':
                          {
                            display: 'none',
                          },
                      }}
                    >
                      {renderPlainText(
                        (
                          enrichedAnalysis.fixedContributorInsights ||
                          enrichedAnalysis.contributor_insights
                        ).replace(/(\d+\.\s)/g, '\n$1')
                      )}
                    </Box>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No contributor insights data available
                    </Text>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            {/* Highlights Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card
                variant="outline"
                height="100%"
                bg={highlightBg}
                boxShadow="sm"
              >
                <CardHeader pb={1}>
                  <Heading size="md" color="purple.700">
                    Key Highlights
                  </Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {/* Check if we actually have key_highlights data */}
                  {enrichedAnalysis?.fixedKeyHighlights ||
                  enrichedAnalysis?.key_highlights ? (
                    <Box
                      className="analysis-content"
                      sx={{
                        // Hide duplicate markdown headers that match our tab title
                        'h1:first-of-type:contains("Key Highlights"), h2:first-of-type:contains("Highlight"), h3:first-of-type:contains("Highlight")':
                          {
                            display: 'none',
                          },
                      }}
                    >
                      {renderPlainText(
                        (
                          enrichedAnalysis.fixedKeyHighlights ||
                          enrichedAnalysis.key_highlights
                        ).replace(/(\d+\.\s)/g, '\n$1')
                      )}
                    </Box>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No key highlights data available
                    </Text>
                  )}
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Footer with metadata */}
        <Box mt={4} p={3} borderRadius="md" bg="gray.50">
          <HStack justify="space-between" wrap="wrap" spacing={4}>
            <VStack align="start" spacing={1}>
              <HStack>
                <Icon as={FiClock} size="sm" color="gray.500" />
                <Text fontSize="sm" color="gray.600">
                  Analysis period: {formatDate(analysis.start_date)} to{' '}
                  {formatDate(analysis.end_date)}
                </Text>
              </HStack>
              <HStack>
                <Icon as={FiUsers} size="sm" color="gray.500" />
                <Text fontSize="sm" color="gray.600">
                  Analysis includes {analysis.message_count} messages from{' '}
                  {analysis.participant_count} participants
                </Text>
              </HStack>
            </VStack>

            <Text fontSize="sm" color="gray.500">
              Analyzed with{' '}
              {analysis.model_used.split('/').pop() || analysis.model_used}
            </Text>
          </HStack>
        </Box>

        {/* Action buttons for navigation */}
        <Flex justifyContent="space-between" mt={6}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            onClick={() =>
              navigate(
                `/dashboard/integrations/${integrationId}/channels/${channelId}/analyze`
              )
            }
            variant="outline"
            colorScheme="purple"
          >
            Back to Analysis
          </Button>

          <Button
            leftIcon={<Icon as={FiClock} />}
            onClick={() =>
              navigate(
                `/dashboard/integrations/${integrationId}/channels/${channelId}/history`
              )
            }
            variant="outline"
          >
            View Analysis History
          </Button>
        </Flex>
      </Box>
    </SlackUserCacheProvider>
  )
}

export default TeamAnalysisResultPage
