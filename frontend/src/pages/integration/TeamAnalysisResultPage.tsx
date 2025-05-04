import React, { useState, FC } from 'react'
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
  Center,
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
  useClipboard,
  useColorModeValue,
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  FiArrowLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiFileText,
  FiShare2,
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import MessageText from '../../components/slack/MessageText'
import { useAnalysisData } from '../../hooks'
import { ServiceResource } from '../../lib/integrationService'

interface ChannelAnalysisListProps {
  title: string
  reportResult: Record<string, unknown> | null
  currentResources: ServiceResource[]
  integrationId: string
  filterFn?: (analysis: Record<string, unknown>) => boolean
  contentField: string
  emptyMessage?: string
  workspaceUuid?: string
}

/**
 * A reusable component for displaying individual channel analyses in the team analysis view
 */
const ChannelAnalysisList: FC<ChannelAnalysisListProps> = ({
  title,
  reportResult,
  currentResources,
  integrationId,
  filterFn = () => true,
  contentField,
  emptyMessage = 'No information available.',
}) => {
  const navigate = useNavigate()
  const renderPlainText = (
    text: string | unknown,
    workspaceUuid: string | undefined
  ) => {
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
                  workspaceUuid={workspaceUuid ?? ''}
                  resolveMentions={true}
                  fallbackToSimpleFormat={true}
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
                    workspaceUuid={workspaceUuid ?? ''}
                    resolveMentions={true}
                    fallbackToSimpleFormat={true}
                  />
                </Box>
              </Box>
            )
          }

          return (
            <Box key={index} mb={2}>
              <MessageText
                text={paragraph}
                workspaceUuid={workspaceUuid ?? ''}
                resolveMentions={true}
                fallbackToSimpleFormat={true}
              />
            </Box>
          )
        })}
      </Box>
    )
  }

  const filteredAnalyses =
    reportResult?.resource_analyses &&
    Array.isArray(reportResult.resource_analyses)
      ? reportResult.resource_analyses.filter(filterFn)
      : []

  if (
    !reportResult ||
    !reportResult.resource_analyses ||
    !Array.isArray(reportResult.resource_analyses) ||
    reportResult.resource_analyses.length === 0
  ) {
    return null
  }

  return (
    <>
      <Heading size="md" mb={3} mt={6}>
        {title}
      </Heading>
      {filteredAnalyses.length > 0 ? (
        filteredAnalyses.map((channelAnalysis) => (
          <Card
            key={channelAnalysis.id}
            variant="outline"
            mb={4}
            boxShadow="sm"
          >
            <CardHeader pb={1}>
              <Flex justify="space-between" align="center">
                <Heading size="sm" color="purple.600">
                  {/* Try to get channel name from different sources with fallbacks */}
                  {channelAnalysis.results?.channel_name ||
                    channelAnalysis.channel_name ||
                    channelAnalysis.resource_name ||
                    currentResources.find(
                      (r) => r.id === channelAnalysis.resource_id
                    )?.name ||
                    `Channel ${channelAnalysis.resource_id.substring(0, 8)}...`}
                </Heading>
                <Badge
                  colorScheme={
                    channelAnalysis.status === 'COMPLETED'
                      ? 'green'
                      : channelAnalysis.status === 'FAILED'
                        ? 'red'
                        : 'yellow'
                  }
                >
                  {channelAnalysis.status === 'PENDING' ? (
                    <HStack spacing={1}>
                      <Text>PENDING</Text>
                      <Spinner size="xs" />
                    </HStack>
                  ) : (
                    channelAnalysis.status
                  )}
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody pt={2}>
              {channelAnalysis[contentField] ? (
                <Box className="analysis-content">
                  {/* Extract channel-specific integration_id if available */}
                  {renderPlainText(
                    typeof channelAnalysis[contentField] === 'string'
                      ? channelAnalysis[contentField].replace(
                          /(\d+\.\s)/g,
                          '\n$1'
                        )
                      : 'No content available',
                    channelAnalysis.workspace_uuid
                  )}
                </Box>
              ) : (
                <Text fontSize="sm" color="gray.500">
                  {emptyMessage}
                </Text>
              )}
              {channelAnalysis.status === 'COMPLETED' && (
                <Button
                  size="sm"
                  colorScheme="purple"
                  variant="outline"
                  mt={3}
                  onClick={() => {
                    const resourceId = String(channelAnalysis.resource_id)
                    const analysisId = String(channelAnalysis.id)
                    console.log('Channel analysis debug:', {
                      resourceId,
                      analysisId,
                    })

                    navigate(
                      `/dashboard/integrations/${integrationId}/channels/${resourceId}/analysis/${analysisId}`
                    )
                  }}
                >
                  View Full Analysis
                </Button>
              )}
            </CardBody>
          </Card>
        ))
      ) : (
        <Text fontSize="sm" color="gray.500" mt={4}>
          No completed channel analyses with {contentField.replace(/_/g, ' ')}{' '}
          information available.
        </Text>
      )}
    </>
  )
}

/**
 * Improved Analysis Result Page component that provides a more accessible
 * and feature-rich way to view analysis results.
 */
const TeamAnalysisResultPage: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()

  const {
    analysis,
    channel,
    isLoading,
    reportResult,
    pendingAnalyses,
    isRefreshing,
    isTeamAnalysis,
    // isTeamCentricUrl, // Unused
    shareUrl,
    formatDate,
    formatDateTime,
    setIsRefreshing,
    // fetchData, // Unused
    checkReportStatus,
  } = useAnalysisData()

  const [activeTab, setActiveTab] = useState(0)
  // const highlightBg = useColorModeValue('purple.50', 'purple.800') // Unused

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const breadcrumbColor = useColorModeValue('gray.600', 'gray.400')

  const { hasCopied, onCopy } = useClipboard(shareUrl)

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

    const channelName =
      typeof analysis.channel_name === 'string'
        ? analysis.channel_name
        : 'Channel'

    const workspaceType = analysis.team_id
      ? 'Team Analysis'
      : 'Channel Analysis'

    const startDate =
      typeof analysis.start_date === 'string'
        ? formatDate(analysis.start_date)
        : 'Unknown'

    const endDate =
      typeof analysis.end_date === 'string'
        ? formatDate(analysis.end_date)
        : 'Unknown'

    const generatedAt =
      typeof analysis.generated_at === 'string'
        ? formatDateTime(analysis.generated_at)
        : 'Unknown'

    const messageCount =
      typeof analysis.message_count === 'number' ? analysis.message_count : 0

    const participantCount =
      typeof analysis.participant_count === 'number'
        ? analysis.participant_count
        : 0

    const threadCount =
      typeof analysis.thread_count === 'number' ? analysis.thread_count : 0

    const reactionCount =
      typeof analysis.reaction_count === 'number' ? analysis.reaction_count : 0

    const channelSummary =
      typeof analysis.channel_summary === 'string'
        ? analysis.channel_summary
        : 'No summary available'

    const topicAnalysis =
      typeof analysis.topic_analysis === 'string'
        ? analysis.topic_analysis
        : 'No topic analysis available'

    const contributorInsights =
      typeof analysis.contributor_insights === 'string'
        ? analysis.contributor_insights
        : 'No contributor insights available'

    const keyHighlights =
      typeof analysis.key_highlights === 'string'
        ? analysis.key_highlights
        : 'No highlights available'

    const modelUsed =
      typeof analysis.model_used === 'string' ? analysis.model_used : 'AI'

    const content = `
# Channel Analysis: #${channelName}
Workspace: ${workspaceType}
Period: ${startDate} to ${endDate}
Generated: ${generatedAt}

## Statistics
- Messages: ${messageCount}
- Participants: ${participantCount}
- Threads: ${threadCount}
- Reactions: ${reactionCount}

## Channel Summary
${channelSummary}

## Topic Analysis
${topicAnalysis}

## Contributor Insights
${contributorInsights}

## Key Highlights
${keyHighlights}

---
Generated using Toban Contribution Viewer with ${modelUsed}
    `.trim()

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
   * Render plain text with proper formatting and support for markdown-like syntax
   */
  const renderPlainText = (text: string | unknown, workspace_uuid: string) => {
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
      console.log('Content appears to be plain text, rendering directly')
      return (
        <Box className="formatted-text">
          {cleanedText.split('\n').map((paragraph, index) => (
            <Box key={index} mb={2}>
              {paragraph.trim() ? (
                <MessageText
                  text={paragraph}
                  resolveMentions={true}
                  fallbackToSimpleFormat={true}
                  workspaceUuid={workspace_uuid ?? ''}
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
                    workspaceUuid={workspace_uuid ?? ''}
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
                workspaceUuid={workspace_uuid ?? ''}
              />
            </Box>
          )
        })}
      </Box>
    )
  }

  const isObviouslyNotJson = (str: string) => {
    return !str.includes('{') && !str.includes('"') && !str.includes(':')
  }

  const fixedAnalysis = analysis
    ? {
        ...analysis,
        fixedTopicAnalysis: isObviouslyNotJson(analysis.topic_analysis)
          ? analysis.topic_analysis
          : analysis.fixedTopicAnalysis || analysis.topic_analysis,
        fixedContributorInsights: isObviouslyNotJson(
          analysis.contributor_insights
        )
          ? analysis.contributor_insights
          : analysis.fixedContributorInsights || analysis.contributor_insights,
        fixedKeyHighlights: isObviouslyNotJson(analysis.key_highlights)
          ? analysis.key_highlights
          : analysis.fixedKeyHighlights || analysis.key_highlights,
      }
    : null

  if (
    isTeamAnalysis &&
    reportResult &&
    reportResult.resource_analyses &&
    Array.isArray(reportResult.resource_analyses) &&
    fixedAnalysis
  ) {
    fixedAnalysis.fixedContributorInsights =
      fixedAnalysis.fixedContributorInsights ||
      fixedAnalysis.contributor_insights
  }

  const extractSectionContent = (text: string, sectionName: string) => {
    const regex = new RegExp(
      `#+\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=#+\\s*|$)`,
      'i'
    )
    const match = text.match(regex)
    return match ? match[1].trim() : ''
  }

  if (analysis && fixedAnalysis) {
    if (
      analysis.channel_summary &&
      analysis.channel_summary.includes('# Summary') &&
      analysis.channel_summary.includes('# Topics')
    ) {
      fixedAnalysis.fixedChannelSummary = extractSectionContent(
        analysis.channel_summary,
        'Summary'
      )
      fixedAnalysis.fixedTopicAnalysis = extractSectionContent(
        analysis.channel_summary,
        'Topics'
      )
      fixedAnalysis.fixedContributorInsights = extractSectionContent(
        analysis.channel_summary,
        'Contributors'
      )
      fixedAnalysis.fixedKeyHighlights = extractSectionContent(
        analysis.channel_summary,
        'Highlights'
      )
    }
  }

  if (isLoading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" color="purple.500" mb={4} />
        <Heading size="md">Loading analysis...</Heading>
        <Text mt={2} color="gray.600">
          Please wait while we fetch the data
        </Text>
      </Box>
    )
  }

  if (!analysis) {
    return (
      <Box p={8} textAlign="center">
        <Heading size="md" mb={4}>
          Analysis not found
        </Heading>
        <Text mb={4}>
          The requested analysis could not be found or has been deleted.
        </Text>
        <Button as={Link} to="/dashboard" colorScheme="purple">
          Return to Dashboard
        </Button>
      </Box>
    )
  }

  const channelName = analysis?.channel_name
    ? typeof analysis.channel_name === 'string' &&
      analysis.channel_name.startsWith('#')
      ? analysis.channel_name
      : `#${analysis.channel_name}`
    : 'Channel'

  const match = channelName.match(/Team Analysis/i)
  const isTeamAnalysisTitle = Boolean(match)

  const customStyles = {
    statCard: {
      bg: cardBg,
      borderRadius: 'lg',
      boxShadow: 'sm',
      p: 4,
      textAlign: 'center' as const,
      borderWidth: '1px',
      borderColor: borderColor,
    },
    tabPanel: {
      pt: 6,
      px: { base: 2, md: 4 },
      pb: 8,
    },
    breadcrumb: {
      mb: 4,
      fontSize: 'sm',
      color: breadcrumbColor,
    },
    backButton: {
      mb: 4,
      size: 'sm',
      leftIcon: <FiArrowLeft />,
      variant: 'outline',
    },
    headerSection: {
      mb: 6,
    },
  }

  type AnalysisData = {
    fixedTopicAnalysis?: string
    fixedContributorInsights?: string
    fixedKeyHighlights?: string
    fixedChannelSummary?: string
    channel_summary?: string
    topic_analysis?: string
    contributor_insights?: string
    key_highlights?: string
    [key: string]: unknown
  }

  function extractMissingFields(analysis: AnalysisData) {
    const hasEmptyFields =
      !analysis.fixedTopicAnalysis ||
      analysis.fixedTopicAnalysis.trim() === '' ||
      !analysis.fixedContributorInsights ||
      analysis.fixedContributorInsights.trim() === '' ||
      !analysis.fixedKeyHighlights ||
      analysis.fixedKeyHighlights.trim() === ''

    if (!hasEmptyFields) return analysis

    if (!analysis.channel_summary || analysis.channel_summary.trim() === '')
      return analysis

    const isLikelyPlainText =
      /^[A-Za-z]/.test(analysis.channel_summary.trim()) &&
      !analysis.channel_summary.includes('```json') &&
      !(
        analysis.channel_summary.trim().startsWith('{') &&
        analysis.channel_summary.trim().endsWith('}')
      )

    if (isLikelyPlainText) {
      const extracted = { ...analysis }

      if (
        !extracted.fixedTopicAnalysis ||
        extracted.fixedTopicAnalysis.trim() === ''
      ) {
        extracted.fixedTopicAnalysis = extractSectionContent(
          analysis.channel_summary,
          'Topics'
        )
      }

      if (
        !extracted.fixedContributorInsights ||
        extracted.fixedContributorInsights.trim() === ''
      ) {
        extracted.fixedContributorInsights = extractSectionContent(
          analysis.channel_summary,
          'Contributors'
        )
      }

      if (
        !extracted.fixedKeyHighlights ||
        extracted.fixedKeyHighlights.trim() === ''
      ) {
        extracted.fixedKeyHighlights = extractSectionContent(
          analysis.channel_summary,
          'Highlights'
        )
      }

      return extracted
    }

    return analysis
  }

  const processedAnalysis = fixedAnalysis
    ? extractMissingFields(fixedAnalysis)
    : null

  if (!customStyles || !customStyles.backButton) {
    console.error('customStyles or backButton style is undefined')
  }

  if (isLoading || !analysis) {
    return (
      <Box p={5}>
        <Button
          onClick={() => navigate(-1)}
          sx={customStyles?.backButton || { mb: 4 }}
          mb={4}
        >
          Back
        </Button>
        <Center h="50vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="purple.500" />
            <Text>Loading analysis data...</Text>
          </VStack>
        </Center>
      </Box>
    )
  }

  return (
    <Box>
      {/* Breadcrumb navigation */}
      <Breadcrumb
        separator={<FiChevronRight color="gray.500" />}
        sx={customStyles.breadcrumb}
      >
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>

        {isTeamAnalysis ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} to="/dashboard/teams">
                Teams
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink
                as={Link}
                to={`/dashboard/teams/${analysis?.team_id || ''}`}
              >
                {analysis?.team_id ? 'Team' : 'Team Analysis'}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink
                as={Link}
                to={`/dashboard/teams/${analysis?.team_id || ''}/reports/history`}
              >
                Reports
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink>Analysis</BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} to="/dashboard/integrations">
                Integrations
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink
                as={Link}
                to={`/dashboard/integrations/${analysis?.channel_id?.split(':')[0] || ''}`}
              >
                {channel?.name || 'Workspace'}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink
                as={Link}
                to={`/dashboard/integrations/${analysis?.channel_id?.split(':')[0] || ''}/channels`}
              >
                Channels
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink
                as={Link}
                to={`/dashboard/integrations/${analysis?.channel_id?.split(':')[0] || ''}/channels/${analysis?.channel_id || ''}`}
              >
                {channelName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink>Analysis</BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}
      </Breadcrumb>

      {/* Back button */}
      <Button
        onClick={() => navigate(-1)}
        sx={customStyles?.backButton || { mb: 4 }}
      >
        Back
      </Button>

      {/* Header section with title and actions */}
      <Box sx={customStyles.headerSection}>
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          mb={4}
          gap={4}
        >
          <Box>
            <Heading size="lg" mb={1}>
              {isTeamAnalysisTitle
                ? 'Team Analysis'
                : `Channel Analysis: ${channelName}`}
            </Heading>
            <Text color="gray.600">
              {formatDate(analysis?.start_date || '')} to{' '}
              {formatDate(analysis?.end_date || '')}
            </Text>
          </Box>

          {/* Action buttons */}
          <HStack spacing={2}>
            {typeof pendingAnalyses === 'number' && pendingAnalyses > 0 && (
              <Badge colorScheme="yellow" p={2} borderRadius="md">
                <HStack spacing={2}>
                  <Spinner size="xs" />
                  <Text>
                    {pendingAnalyses} pending{' '}
                    {pendingAnalyses === 1 ? 'analysis' : 'analyses'}
                  </Text>
                </HStack>
              </Badge>
            )}

            {/* Only render buttons if analysis data is available */}
            {analysis && (
              <>
                <Tooltip label="Share analysis">
                  <IconButton
                    aria-label="Share analysis"
                    icon={<FiShare2 />}
                    onClick={handleShare}
                    colorScheme={hasCopied ? 'green' : 'gray'}
                    isDisabled={!shareUrl}
                  />
                </Tooltip>

                <Tooltip label="Export as text">
                  <IconButton
                    aria-label="Export analysis"
                    icon={<FiDownload />}
                    onClick={handleExport}
                    isDisabled={!analysis}
                  />
                </Tooltip>
              </>
            )}

            {typeof isRefreshing === 'boolean' &&
              isRefreshing &&
              typeof setIsRefreshing === 'function' && (
                <Button
                  leftIcon={<FiClock />}
                  onClick={() => {
                    setIsRefreshing(false)
                    if (typeof checkReportStatus === 'function') {
                      checkReportStatus()
                    }
                  }}
                  size="sm"
                  colorScheme="purple"
                  variant="outline"
                >
                  Refresh Status
                </Button>
              )}
          </HStack>
        </Flex>

        {/* Statistics section */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
          <Stat
            sx={
              customStyles?.statCard || {
                p: 4,
                borderRadius: 'md',
                boxShadow: 'sm',
              }
            }
          >
            <StatLabel>Messages</StatLabel>
            <StatNumber>
              {typeof analysis?.message_count === 'number'
                ? analysis.message_count.toLocaleString()
                : '0'}
            </StatNumber>
            <StatHelpText>Total messages analyzed</StatHelpText>
          </Stat>

          <Stat
            sx={
              customStyles?.statCard || {
                p: 4,
                borderRadius: 'md',
                boxShadow: 'sm',
              }
            }
          >
            <StatLabel>Participants</StatLabel>
            <StatNumber>
              {typeof analysis?.participant_count === 'number'
                ? analysis.participant_count.toLocaleString()
                : '0'}
            </StatNumber>
            <StatHelpText>Unique contributors</StatHelpText>
          </Stat>

          <Stat
            sx={
              customStyles?.statCard || {
                p: 4,
                borderRadius: 'md',
                boxShadow: 'sm',
              }
            }
          >
            <StatLabel>Threads</StatLabel>
            <StatNumber>
              {typeof analysis?.thread_count === 'number'
                ? analysis.thread_count.toLocaleString()
                : '0'}
            </StatNumber>
            <StatHelpText>Conversation threads</StatHelpText>
          </Stat>

          <Stat
            sx={
              customStyles?.statCard || {
                p: 4,
                borderRadius: 'md',
                boxShadow: 'sm',
              }
            }
          >
            <StatLabel>Reactions</StatLabel>
            <StatNumber>
              {typeof analysis?.reaction_count === 'number'
                ? analysis.reaction_count.toLocaleString()
                : '0'}
            </StatNumber>
            <StatHelpText>Total emoji reactions</StatHelpText>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Main content tabs */}
      <Tabs
        colorScheme="purple"
        variant="enclosed"
        onChange={setActiveTab}
        defaultIndex={activeTab}
      >
        <TabList>
          <Tab>Summary</Tab>
          <Tab>Topics</Tab>
          <Tab>Contributors</Tab>
          <Tab>Highlights</Tab>
        </TabList>

        <TabPanels>
          {/* Summary Tab */}
          <TabPanel sx={customStyles.tabPanel}>
            <Card variant="outline">
              <CardBody>
                {processedAnalysis?.fixedChannelSummary
                  ? renderPlainText(
                      processedAnalysis.fixedChannelSummary,
                      String(channel?.metadata?.workspace_uuid || '')
                    )
                  : renderPlainText(
                      analysis?.channel_summary || 'No summary available',
                      String(channel?.metadata?.workspace_uuid || '')
                    )}
              </CardBody>
            </Card>

            {/* For team analysis, show individual channel summaries */}
            {isTeamAnalysis && reportResult && (
              <ChannelAnalysisList
                title="Channel Summaries"
                reportResult={reportResult}
                currentResources={[]}
                integrationId=""
                contentField="channel_summary"
                emptyMessage="No channel summaries available."
              />
            )}
          </TabPanel>

          {/* Topics Tab */}
          <TabPanel sx={customStyles.tabPanel}>
            <Card variant="outline">
              <CardBody>
                {processedAnalysis?.fixedTopicAnalysis
                  ? renderPlainText(
                      processedAnalysis.fixedTopicAnalysis,
                      String(channel?.metadata?.workspace_uuid || '')
                    )
                  : renderPlainText(
                      analysis?.topic_analysis || 'No topic analysis available',
                      String(channel?.metadata?.workspace_uuid || '')
                    )}
              </CardBody>
            </Card>

            {/* For team analysis, show individual channel topic analyses */}
            {isTeamAnalysis && reportResult && (
              <ChannelAnalysisList
                title="Channel Topic Analyses"
                reportResult={reportResult}
                currentResources={[]}
                integrationId=""
                contentField="topic_analysis"
                emptyMessage="No topic analyses available for individual channels."
              />
            )}
          </TabPanel>

          {/* Contributors Tab */}
          <TabPanel sx={customStyles.tabPanel}>
            <Card variant="outline">
              <CardBody>
                {processedAnalysis?.fixedContributorInsights
                  ? renderPlainText(
                      processedAnalysis.fixedContributorInsights,
                      String(channel?.metadata?.workspace_uuid || '')
                    )
                  : renderPlainText(
                      analysis?.contributor_insights ||
                        'No contributor insights available',
                      String(channel?.metadata?.workspace_uuid || '')
                    )}
              </CardBody>
            </Card>

            {/* For team analysis, show individual channel contributor insights */}
            {isTeamAnalysis && reportResult && (
              <ChannelAnalysisList
                title="Channel Contributor Insights"
                reportResult={reportResult}
                currentResources={[]}
                integrationId=""
                contentField="contributor_insights"
                emptyMessage="No contributor insights available for individual channels."
              />
            )}
          </TabPanel>

          {/* Highlights Tab */}
          <TabPanel sx={customStyles.tabPanel}>
            <Card variant="outline">
              <CardBody>
                {processedAnalysis?.fixedKeyHighlights
                  ? renderPlainText(
                      processedAnalysis.fixedKeyHighlights,
                      String(channel?.metadata?.workspace_uuid || '')
                    )
                  : renderPlainText(
                      analysis?.key_highlights || 'No highlights available',
                      String(channel?.metadata?.workspace_uuid || '')
                    )}
              </CardBody>
            </Card>

            {/* For team analysis, show individual channel highlights */}
            {isTeamAnalysis && reportResult && (
              <ChannelAnalysisList
                title="Channel Highlights"
                reportResult={reportResult}
                currentResources={[]}
                integrationId=""
                contentField="key_highlights"
                emptyMessage="No highlights available for individual channels."
              />
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Footer section with metadata */}
      <Box mt={8} mb={4} fontSize="sm" color="gray.500">
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
          <GridItem>
            <HStack>
              <Icon as={FiClock} />
              <Text>
                Generated on{' '}
                {typeof formatDateTime === 'function'
                  ? formatDateTime(
                      typeof analysis?.generated_at === 'string'
                        ? analysis.generated_at
                        : ''
                    )
                  : 'Unknown date'}
              </Text>
            </HStack>
          </GridItem>
          <GridItem>
            <HStack>
              <Icon as={FiFileText} />
              <Text>
                Model:{' '}
                {typeof analysis?.model_used === 'string'
                  ? analysis.model_used
                  : 'Unknown'}
              </Text>
            </HStack>
          </GridItem>
        </Grid>
      </Box>
    </Box>
  )
}

export default TeamAnalysisResultPage
