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
  Divider,
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

  // Create share URL for the current analysis
  const shareUrl = `${window.location.origin}/dashboard/integrations/${integrationId}/channels/${channelId}/analysis/${analysisId}`
  const { hasCopied, onCopy } = useClipboard(shareUrl)

  useEffect(() => {
    if (integrationId && channelId && analysisId) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, channelId, analysisId])

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
      if (integrationId) {
        await fetchIntegration(integrationId)
      }

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
   */
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <Box key={index} mb={2}>
        {paragraph.trim() ? (
          <MessageText
            text={paragraph}
            workspaceId={analysis?.workspace_id || workspaceId || ''}
            resolveMentions={true}
            fallbackToSimpleFormat={true}
          />
        ) : (
          <Box height="1em" />
        )}
      </Box>
    ))
  }

  // Try to get the workspace ID from different sources
  const workspaceId = analysis?.workspace_id || currentIntegration?.workspace_id

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

  return (
    <SlackUserCacheProvider
      workspaceId={analysis?.workspace_id || workspaceId || ''}
    >
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
              <Card variant="outline" height="100%" bg={highlightBg}>
                <CardHeader pb={0}>
                  <Heading size="md">Channel Summary</Heading>
                </CardHeader>
                <CardBody>{formatText(analysis.channel_summary)}</CardBody>
              </Card>
            </TabPanel>

            {/* Topics Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card variant="outline" height="100%" bg={highlightBg}>
                <CardHeader pb={0}>
                  <Heading size="md">Topic Analysis</Heading>
                </CardHeader>
                <CardBody>{formatText(analysis.topic_analysis)}</CardBody>
              </Card>
            </TabPanel>

            {/* Contributors Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card variant="outline" height="100%" bg={highlightBg}>
                <CardHeader pb={0}>
                  <Heading size="md">Contributor Insights</Heading>
                </CardHeader>
                <CardBody>{formatText(analysis.contributor_insights)}</CardBody>
              </Card>
            </TabPanel>

            {/* Highlights Tab */}
            <TabPanel px={{ base: 2, md: 4 }} py={4}>
              <Card variant="outline" height="100%" bg={highlightBg}>
                <CardHeader pb={0}>
                  <Heading size="md">Key Highlights</Heading>
                </CardHeader>
                <CardBody>{formatText(analysis.key_highlights)}</CardBody>
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
