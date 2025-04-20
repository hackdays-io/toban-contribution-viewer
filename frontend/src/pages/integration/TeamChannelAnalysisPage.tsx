import React, { useEffect, useState } from 'react'
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  Heading,
  Icon,
  Spinner,
  Text,
  useToast,
  Card,
  CardHeader,
  CardBody,
  FormControl,
  FormLabel,
  Input,
  HStack,
  VStack,
  Divider,
  SimpleGrid,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Switch,
  FormHelperText,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import { FiChevronRight, FiArrowLeft, FiRefreshCw } from 'react-icons/fi'
import { Link, useParams, useNavigate } from 'react-router-dom'
import env from '../../config/env'
import { SlackUserCacheProvider } from '../../components/slack/SlackUserContext'
import MessageText from '../../components/slack/MessageText'
import useIntegration from '../../context/useIntegration'
import integrationService, { IntegrationType, ServiceResource, ResourceType } from '../../lib/integrationService'
import slackApiClient, { SlackAnalysisResult } from '../../lib/slackApiClient'

// Use the SlackAnalysisResult interface directly from slackApiClient.ts
type AnalysisResponse = SlackAnalysisResult

interface Channel extends ServiceResource {
  type: string
  topic?: string
  purpose?: string
  workspace_uuid?: string
  channel_uuid?: string
}

/**
 * Page component for analyzing a channel from a team integration and displaying results.
 */
const TeamChannelAnalysisPage: React.FC = () => {
  const { integrationId, channelId } = useParams<{
    integrationId: string
    channelId: string
  }>()
  const [channel, setChannel] = useState<Channel | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isChannelLoading, setIsChannelLoading] = useState(true)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [includeThreads, setIncludeThreads] = useState(true)
  const [includeReactions, setIncludeReactions] = useState(true)
  const toast = useToast()
  const navigate = useNavigate()

  const {
    currentResources,
    currentIntegration,
    fetchIntegration,
    fetchResources,
  } = useIntegration()

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Format date for input fields
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    setStartDate(formatDateForInput(start))
    setEndDate(formatDateForInput(end))
  }, [])

  // Fetch integration first to ensure it's loaded
  useEffect(() => {
    if (integrationId) {
      console.log('Loading integration:', integrationId)
      fetchIntegration(integrationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId])
  
  // Once integration is loaded, fetch channel info
  useEffect(() => {
    if (integrationId && channelId && currentIntegration) {
      console.log('Integration loaded, fetching channel:', currentIntegration.id)
      // Only fetch if we don't already have the channel
      if (!channel) {
        fetchIntegrationAndChannel()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, channelId, currentIntegration])

  /**
   * Fetch channel information only - integration must already be loaded.
   */
  const fetchIntegrationAndChannel = async () => {
    try {
      setIsChannelLoading(true)
      
      // Verify we have the integration and channel IDs
      if (!currentIntegration) {
        console.log('Integration not loaded yet - skipping channel fetch')
        return // Just return and wait for the next render when integration is loaded
      }
      
      if (!channelId) {
        console.error('Missing channel ID')
        return
      }
      
      console.log('Fetching channel data using integration:', currentIntegration.id)
      
      // Get channel via the integration service
      const channelData = await integrationService.getResource(integrationId || '', channelId)
      
      // Check if the result is an API error
      if (integrationService.isApiError(channelData)) {
        throw new Error(`Failed to fetch channel: ${channelData.message}`)
      }
      
      console.log('Channel data retrieved successfully:', channelData.name)
      
      // Create enriched channel data with proper IDs for the API
      const enrichedChannel: Channel = {
        ...channelData,
        // Store the database UUIDs for API calls
        workspace_uuid: currentIntegration.id, // Database UUID for the workspace
        channel_uuid: channelData.id,          // Database UUID for the channel
        external_id: currentIntegration.workspace_id || '', // Slack workspace ID
        external_resource_id: channelData.external_id,      // Slack channel ID
        type: (channelData.metadata?.type || channelData.metadata?.is_private) ? 
              (channelData.metadata?.is_private ? 'private' : 'public') : 
              'public',
        topic: channelData.metadata?.topic || '',
        purpose: channelData.metadata?.purpose || ''
      }
      
      setChannel(enrichedChannel)
    } catch (error) {
      console.error('Error fetching channel:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load channel information',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsChannelLoading(false)
    }
  }

  /**
   * Run channel analysis with current settings.
   */
  const runAnalysis = async () => {
    if (!integrationId || !channelId) {
      toast({
        title: 'Error',
        description: 'Missing integration or channel ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      setIsLoading(true)
      setAnalysis(null)

      // Format date parameters
      const startDateParam = startDate ? new Date(startDate).toISOString() : ''
      const endDateParam = endDate ? new Date(endDate).toISOString() : ''

      // Verify we have channel data with UUIDs
      if (!channel || !channel.workspace_uuid || !channel.channel_uuid) {
        throw new Error('Channel data with database UUIDs is required')
      }

      // Use the slack API client to run analysis
      const result = await slackApiClient.analyzeChannel(
        channel.workspace_uuid,  // Database UUID for workspace
        channel.channel_uuid,    // Database UUID for channel
        'contribution',         // analysis_type
        {
          start_date: startDateParam,
          end_date: endDateParam,
          include_threads: includeThreads,
          include_reactions: includeReactions
        }
      )
      
      // Check if the result is an error
      if (slackApiClient.isApiError(result)) {
        throw new Error(`Analysis request failed: ${result.message}`)
      }

      // Set the analysis result
      setAnalysis(result)

      toast({
        title: 'Analysis Complete',
        description: 'Channel analysis has been completed successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      // Navigate to the analysis result page
      if (result.analysis_id) {
        navigate(
          `/dashboard/integrations/${integrationId}/channels/${channelId}/analysis/${result.analysis_id}`
        )
      }
    } catch (error) {
      console.error('Error during analysis:', error)
      toast({
        title: 'Analysis Failed',
        description:
          error instanceof Error ? error.message : 'Failed to analyze channel',
        status: 'error',
        duration: 7000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Format text with paragraphs and process Slack mentions.
   */
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <Box key={index} mb={2}>
        {paragraph.trim() ? (
          <MessageText
            text={paragraph}
            workspaceId={channel?.external_id || ''}
            resolveMentions={true}
            fallbackToSimpleFormat={true}
          />
        ) : (
          <Box height="1em" />
        )}
      </Box>
    ))
  }

  /**
   * Render analysis parameters form.
   */
  const renderAnalysisForm = () => {
    return (
      <Card mb={6}>
        <CardHeader>
          <Heading size="md">Analysis Parameters</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Flex justify="flex-end">
              <Button
                as={Link}
                to={`/dashboard/integrations/${integrationId}/channels/${channelId}/history`}
                size="sm"
                colorScheme="blue"
                variant="outline"
              >
                View Analysis History
              </Button>
            </Flex>
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Start Date</FormLabel>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>End Date</FormLabel>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FormControl>
            </HStack>

            <HStack spacing={6}>
              <FormControl display="flex" alignItems="center">
                <Switch
                  id="include-threads"
                  isChecked={includeThreads}
                  onChange={(e) => setIncludeThreads(e.target.checked)}
                  colorScheme="purple"
                  mr={2}
                />
                <FormLabel htmlFor="include-threads" mb={0}>
                  Include Thread Replies
                </FormLabel>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <Switch
                  id="include-reactions"
                  isChecked={includeReactions}
                  onChange={(e) => setIncludeReactions(e.target.checked)}
                  colorScheme="purple"
                  mr={2}
                />
                <FormLabel htmlFor="include-reactions" mb={0}>
                  Include Reactions
                </FormLabel>
              </FormControl>
            </HStack>

            <FormControl>
              <FormHelperText>
                Select a date range and options for analysis. A larger date
                range will take longer to analyze.
              </FormHelperText>
            </FormControl>

            <Divider />

            <Button
              leftIcon={<Icon as={FiRefreshCw} />}
              colorScheme="purple"
              onClick={runAnalysis}
              isLoading={isLoading}
              loadingText="Analyzing..."
            >
              Run Analysis
            </Button>
          </VStack>
        </CardBody>
      </Card>
    )
  }

  /**
   * Render analysis results.
   */
  const renderAnalysisResults = () => {
    if (!analysis) return null

    return (
      <Box mt={8}>
        <Heading as="h2" size="lg" mb={4}>
          Analysis Results
        </Heading>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
          <Stat>
            <StatLabel>Messages</StatLabel>
            <StatNumber>{analysis.stats.message_count}</StatNumber>
            <StatHelpText>Total messages analyzed</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Participants</StatLabel>
            <StatNumber>{analysis.stats.participant_count}</StatNumber>
            <StatHelpText>Unique contributors</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Threads</StatLabel>
            <StatNumber>{analysis.stats.thread_count}</StatNumber>
            <StatHelpText>Conversation threads</StatHelpText>
          </Stat>

          <Stat>
            <StatLabel>Reactions</StatLabel>
            <StatNumber>{analysis.stats.reaction_count}</StatNumber>
            <StatHelpText>Total emoji reactions</StatHelpText>
          </Stat>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Card>
            <CardHeader>
              <Heading size="md">Channel Summary</Heading>
            </CardHeader>
            <CardBody>{formatText(analysis.channel_summary)}</CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Heading size="md">Topic Analysis</Heading>
            </CardHeader>
            <CardBody>{formatText(analysis.topic_analysis)}</CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Heading size="md">Contributor Insights</Heading>
            </CardHeader>
            <CardBody>{formatText(analysis.contributor_insights)}</CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Heading size="md">Key Highlights</Heading>
            </CardHeader>
            <CardBody>{formatText(analysis.key_highlights)}</CardBody>
          </Card>
        </SimpleGrid>

        <Box mt={4} p={3} borderRadius="md" bg="gray.50">
          <HStack spacing={2}>
            <Text fontWeight="bold" fontSize="sm">
              Analysis period:
            </Text>
            <Text fontSize="sm">
              {formatDate(analysis.period.start)} to{' '}
              {formatDate(analysis.period.end)}
            </Text>
          </HStack>

          <HStack spacing={2}>
            <Text fontWeight="bold" fontSize="sm">
              Model:
            </Text>
            <Text fontSize="sm">{analysis.model_used}</Text>
          </HStack>

          <HStack spacing={2}>
            <Text fontWeight="bold" fontSize="sm">
              Generated:
            </Text>
            <Text fontSize="sm">
              {new Date(analysis.generated_at).toLocaleString()}
            </Text>
          </HStack>
        </Box>
      </Box>
    )
  }

  if (!integrationId || !currentIntegration) {
    return (
      <Box textAlign="center" p={8}>
        <Heading size="md">Integration not found</Heading>
        <Button mt={4} as={Link} to="/dashboard/integrations">
          Back to Integrations
        </Button>
      </Box>
    )
  }

  // Show incompatible integration type
  if (currentIntegration.service_type !== IntegrationType.SLACK) {
    return (
      <Box>
        <Button
          leftIcon={<FiArrowLeft />}
          onClick={() => navigate(`/dashboard/integrations/${integrationId}`)}
          mb={4}
          variant="outline"
        >
          Back to Integration
        </Button>

        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Unsupported integration type</AlertTitle>
          <AlertDescription>
            Channel analysis is currently only available for Slack integrations.
          </AlertDescription>
        </Alert>
      </Box>
    )
  }

  return (
    <SlackUserCacheProvider workspaceId={channel?.external_id || ''}>
      <Box p={4}>
        {/* Breadcrumb navigation */}
        <Breadcrumb
          spacing="8px"
          separator={<Icon as={FiChevronRight} color="gray.500" />}
          mb={6}
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/dashboard">
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/dashboard/integrations">
              Integrations
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink
              as={Link}
              to={`/dashboard/integrations/${integrationId}`}
            >
              {currentIntegration.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink
              as={Link}
              to={`/dashboard/integrations/${integrationId}/channels`}
            >
              Channels
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>Channel Analysis</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Back button */}
        <Button
          leftIcon={<Icon as={FiArrowLeft} />}
          mb={6}
          onClick={() =>
            navigate(`/dashboard/integrations/${integrationId}/channels`)
          }
          variant="outline"
          colorScheme="purple"
        >
          Back to Channels
        </Button>

        {isChannelLoading ? (
          <Flex height="200px" justify="center" align="center">
            <Spinner size="xl" color="purple.500" thickness="4px" />
          </Flex>
        ) : (
          <>
            <Box mb={6}>
              <Heading as="h1" size="xl">
                Channel Analysis
              </Heading>
              <HStack mt={2} spacing={2}>
                <Text fontWeight="bold">{currentIntegration.name}</Text>
                <Text>&gt;</Text>
                <Text>#{channel?.name}</Text>
                <Badge
                  colorScheme={channel?.type === 'public' ? 'green' : 'orange'}
                >
                  {channel?.type}
                </Badge>
              </HStack>
              {channel?.topic && (
                <Text color="gray.600" mt={1}>
                  Topic: {channel.topic}
                </Text>
              )}
            </Box>

            {/* Analysis form */}
            {renderAnalysisForm()}

            {/* Loading state */}
            {isLoading && (
              <Flex justify="center" align="center" my={10} direction="column">
                <Spinner size="xl" color="purple.500" thickness="4px" mb={4} />
                <Text>
                  Analyzing channel messages... This may take a minute.
                </Text>
              </Flex>
            )}

            {/* Analysis results */}
            {analysis && renderAnalysisResults()}
          </>
        )}
      </Box>
    </SlackUserCacheProvider>
  )
}

export default TeamChannelAnalysisPage
