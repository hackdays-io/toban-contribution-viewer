import React, { useState } from 'react'
import {
  Badge,
  Box,
  Button,
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
  FiClock,
  FiDownload,
  FiFileText,
  FiShare2,
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../../components/common/ErrorBoundary'
import { useAnalysisData } from '../../hooks'
import { extractSectionContent, isObviouslyNotJson } from '../../utils/textRenderer'
import { SummaryTab, TopicsTab, ContributorsTab, HighlightsTab } from '../../components/analysis/TabContent'


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

  const safeCustomStyles = customStyles || {
    backButton: {
      mb: 4,
      size: 'sm',
      variant: 'outline',
    },
  }

  if (isLoading || !analysis) {
    return (
      <Box p={5}>
        <ErrorBoundary>
          <Button
            onClick={() => navigate(-1)}
            sx={safeCustomStyles.backButton}
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
        </ErrorBoundary>
      </Box>
    )
  }

  const renderActionButtons = () => {
    if (!analysis) return null

    return (
      <ErrorBoundary
        fallback={
          <Box p={2} borderWidth="1px" borderRadius="md" bg="red.50">
            <Text fontSize="sm">Error rendering action buttons</Text>
          </Box>
        }
      >
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

          {typeof isRefreshing === 'boolean' &&
            isRefreshing === true &&
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
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <Box>

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
            {renderActionButtons()}
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
              <SummaryTab
                analysis={analysis}
                channel={channel}
                processedAnalysis={processedAnalysis}
                reportResult={reportResult}
                isTeamAnalysis={isTeamAnalysis}
                customStyles={customStyles}
                workspaceUuid={channel?.metadata?.workspace_uuid as string}
              />
            </TabPanel>

            {/* Topics Tab */}
            <TabPanel sx={customStyles.tabPanel}>
              <TopicsTab
                analysis={analysis}
                channel={channel}
                processedAnalysis={processedAnalysis}
                reportResult={reportResult}
                isTeamAnalysis={isTeamAnalysis}
                customStyles={customStyles}
                workspaceUuid={channel?.metadata?.workspace_uuid as string}
              />
            </TabPanel>

            {/* Contributors Tab */}
            <TabPanel sx={customStyles.tabPanel}>
              <ContributorsTab
                analysis={analysis}
                channel={channel}
                processedAnalysis={processedAnalysis}
                reportResult={reportResult}
                isTeamAnalysis={isTeamAnalysis}
                customStyles={customStyles}
                workspaceUuid={channel?.metadata?.workspace_uuid as string}
              />
            </TabPanel>

            {/* Highlights Tab */}
            <TabPanel sx={customStyles.tabPanel}>
              <HighlightsTab
                analysis={analysis}
                channel={channel}
                processedAnalysis={processedAnalysis}
                reportResult={reportResult}
                isTeamAnalysis={isTeamAnalysis}
                customStyles={customStyles}
                workspaceUuid={channel?.metadata?.workspace_uuid as string}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Footer section with metadata */}
        <Box mt={8} mb={4} fontSize="sm" color="gray.500">
          <ErrorBoundary>
            <Grid
              templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
              gap={4}
            >
              <GridItem>
                <HStack>
                  <Icon as={FiClock} />
                  <Text>
                    Generated on{' '}
                    {typeof formatDateTime === 'function' &&
                    analysis?.generated_at
                      ? formatDateTime(
                          typeof analysis.generated_at === 'string'
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
          </ErrorBoundary>
        </Box>
      </Box>
    </ErrorBoundary>
  )
}

export default TeamAnalysisResultPage
