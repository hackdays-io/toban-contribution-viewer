import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Switch,
  Text,
  useColorModeValue,
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  FiArrowRight,
  FiBarChart2,
  FiCalendar,
  FiChevronRight,
  FiFileText,
  FiMessageSquare,
  FiSearch,
  FiSlack,
  FiUsers,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import useAuth from '../../context/useAuth'
import useIntegration from '../../context/useIntegration'
import integrationService, {
  ServiceResource,
  AnalysisOptions,
} from '../../lib/integrationService'
import { SlackAnalysisResult } from '../../lib/slackApiClient'
import env from '../../config/env'

interface ChannelResource extends ServiceResource {
  type?: string
  is_private?: boolean
  member_count?: number
  metadata?: {
    [key: string]: unknown
  }
}

/**
 * CreateAnalysisPage component allows users to create a new analysis
 * by selecting date range and channels to analyze.
 */
const CreateAnalysisPage: React.FC = () => {
  const toast = useToast()
  const { teamContext } = useAuth()
  const { integrations, fetchIntegrations } = useIntegration()

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isSelectedChannelsLoading, setIsSelectedChannelsLoading] =
    useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIntegration, setSelectedIntegration] = useState<string>('')
  const [resources, setResources] = useState<ChannelResource[]>([])
  const [allChannelResources, setAllChannelResources] = useState<
    ChannelResource[]
  >([])
  const [selectedForAnalysisChannels, setSelectedForAnalysisChannels] =
    useState<ChannelResource[]>([])
  const [showAllChannels, setShowAllChannels] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  // Removed unused state
  const [analysis, setAnalysis] = useState<SlackAnalysisResult | null>(null)
  const [analysisCompleted, setAnalysisCompleted] = useState(false)

  // Analysis parameters
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [includeThreads, setIncludeThreads] = useState(true)
  const [includeReactions, setIncludeReactions] = useState(true)

  // Styles
  const bgHover = useColorModeValue('purple.50', 'purple.900')
  const borderColorHover = useColorModeValue('purple.300', 'purple.700')
  const selectedBg = useColorModeValue('purple.100', 'purple.800')

  // Style colors for loading state

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    setStartDate(formatDateForInput(start))
    setEndDate(formatDateForInput(end))
  }, [])

  // Load available integrations on page load
  useEffect(() => {
    void fetchIntegrations(teamContext?.currentTeamId || '')
  }, [fetchIntegrations, teamContext?.currentTeamId])

  // Format date for input fields
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Toggle between showing all channels or only selected for analysis channels
  useEffect(() => {
    if (showAllChannels) {
      setResources(allChannelResources)
    } else {
      // Only show selected channels if there are any, otherwise show all
      setResources(
        selectedForAnalysisChannels.length > 0
          ? selectedForAnalysisChannels
          : allChannelResources
      )
    }
  }, [showAllChannels, allChannelResources, selectedForAnalysisChannels])

  /**
   * Fetch channels that have been selected for analysis
   */
  const fetchSelectedChannels = useCallback(async (integrationId: string) => {
    try {
      setIsSelectedChannelsLoading(true)

      // Get selected resources from the API
      // Use getSelectedChannels which is the correct method name
      const result = await integrationService.getSelectedChannels(integrationId)

      if (integrationService.isApiError(result)) {
        console.warn('Failed to load selected channels:', result.message)
        return
      }

      // Extract the IDs of selected channels
      const selectedIds = result.map((resource) => resource.id)
      setSelectedChannels(selectedIds)

      // If there's exactly one selected channel, pre-select it
      if (selectedIds.length === 1) {
        setSelectedChannel(selectedIds[0])
      }
    } catch (error) {
      console.error('Error loading selected channels:', error)
    } finally {
      setIsSelectedChannelsLoading(false)
    }
  }, [])

  /**
   * Load resources (channels) for the selected integration
   */
  const loadIntegrationResources = useCallback(
    async (integrationId: string) => {
      try {
        setIsLoading(true)

        // Load all resources
        const result = await integrationService.getResources(integrationId)

        if (integrationService.isApiError(result)) {
          throw new Error(`Failed to load resources: ${result.message}`)
        }

        // Filter out just the channel resources
        const channelResources = result.filter(
          (resource) => resource.resource_type === 'slack_channel'
        ) as ChannelResource[]

        // Sort by name
        channelResources.sort((a, b) => a.name.localeCompare(b.name))

        // Save all channel resources
        setAllChannelResources(channelResources)

        // Find channels that are selected for analysis
        const selectedChannelResources = channelResources.filter(
          (resource) => resource.metadata?.is_selected_for_analysis === true
        )

        // Save selected for analysis channels
        setSelectedForAnalysisChannels(selectedChannelResources)

        // Set displayed resources to only show selected channels by default
        setResources(
          selectedChannelResources.length > 0
            ? selectedChannelResources
            : channelResources
        )

        // After loading resources, fetch selected channels
        fetchSelectedChannels(integrationId)
      } catch (error) {
        console.error('Error loading resources:', error)
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to load channels',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [toast, fetchSelectedChannels]
  )

  /**
   * Filter resources based on search term
   */
  const filteredResources = resources.filter((resource) =>
    resource.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  /**
   * Load the selected channel data
   */
  const loadSelectedChannelData = useCallback(
    async (resourceId: string) => {
      if (!selectedIntegration || !resourceId) return

      try {
        console.log(`Loading channel data for ${resourceId}`)

        // Get the channel data
        const channelData = await integrationService.getResource(
          selectedIntegration,
          resourceId
        )

        if (integrationService.isApiError(channelData)) {
          throw new Error(`Failed to fetch channel: ${channelData.message}`)
        }

        console.log('Channel data retrieved:', channelData)

        // Reset any previous analysis
        setAnalysis(null)
        setAnalysisCompleted(false)
      } catch (error) {
        console.error('Error fetching channel data:', error)
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to load channel data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    },
    [selectedIntegration, toast]
  )

  // When a channel is selected, load its data
  useEffect(() => {
    if (selectedChannel) {
      loadSelectedChannelData(selectedChannel)
    }
  }, [selectedChannel, loadSelectedChannelData])

  /**
   * Run channel analysis with current settings
   */
  const runAnalysis = async () => {
    if (!selectedIntegration || !selectedChannel) {
      toast({
        title: 'Selection Required',
        description: 'Please select an integration and channel to analyze',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    try {
      setIsAnalyzing(true)
      setAnalysis(null)

      // Format date parameters
      const startDateParam = startDate ? new Date(startDate).toISOString() : ''
      const endDateParam = endDate ? new Date(endDate).toISOString() : ''

      // Show toast to indicate analysis is starting
      toast({
        title: 'Analysis Started',
        description:
          'Running channel analysis. This may take several minutes for large channels.',
        status: 'info',
        duration: 8000,
        isClosable: true,
      })

      // Log the analysis parameters
      console.log('Running analysis with parameters:', {
        integrationId: selectedIntegration,
        channelId: selectedChannel,
        startDate: startDateParam,
        endDate: endDateParam,
        includeThreads,
        includeReactions,
      })

      // First - sync the channel data to ensure we have the latest messages
      try {
        // Step 1: Sync general integration resources
        console.log('Syncing general integration data first...')
        await integrationService.syncResources(selectedIntegration)

        // Step 2: Specifically sync messages for this channel
        console.log(`Syncing messages for channel ${selectedChannel}...`)
        const syncChannelEndpoint = `${env.apiUrl}/integrations/${selectedIntegration}/resources/${selectedChannel}/sync-messages`

        // Build the request URL with query parameters
        const url = new URL(syncChannelEndpoint)
        url.searchParams.append(
          'start_date',
          startDateParam ||
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        )
        url.searchParams.append(
          'end_date',
          endDateParam || new Date().toISOString()
        )
        url.searchParams.append('include_replies', includeThreads.toString())

        // Make the channel messages sync request
        const headers = await integrationService.getAuthHeaders()
        const channelSyncResponse = await fetch(url.toString(), {
          method: 'POST',
          headers,
          credentials: 'include',
        })

        if (!channelSyncResponse.ok) {
          let errorDetail = ''
          try {
            const responseText = await channelSyncResponse.text()
            try {
              const errorData = JSON.parse(responseText)
              errorDetail =
                errorData.detail || errorData.message || responseText
            } catch {
              errorDetail = responseText || channelSyncResponse.statusText
            }
          } catch {
            // Ignore response reading errors
          }

          toast({
            title: 'Channel Sync Warning',
            description: `Channel sync was not fully successful: ${errorDetail}. Analysis may not include the latest messages.`,
            status: 'warning',
            duration: 7000,
            isClosable: true,
          })
        } else {
          const channelSyncResult = await channelSyncResponse.json()
          console.log('Channel messages sync successful:', channelSyncResult)

          // Extract sync statistics from the response
          const syncStats = channelSyncResult.sync_results || {}
          const newMessages = syncStats.new_message_count || 0
          const repliesCount = syncStats.replies_synced || 0

          toast({
            title: 'Channel Sync Complete',
            description: `Synced ${newMessages} new messages and ${repliesCount} thread replies from Slack.`,
            status: 'success',
            duration: 3000,
            isClosable: true,
          })
        }
      } catch (syncError) {
        console.error('Error syncing data:', syncError)
        toast({
          title: 'Sync Warning',
          description:
            syncError instanceof Error
              ? `Sync issue: ${syncError.message}. Analysis will use existing data.`
              : 'Failed to sync channel data. Analysis will use existing data.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        })
      }

      // Now, run the analysis
      const analysisOptions: AnalysisOptions = {
        analysis_type: 'contribution',
        start_date: startDateParam || undefined,
        end_date: endDateParam || undefined,
        include_threads: includeThreads,
        include_reactions: includeReactions,
      }

      const result = await integrationService.analyzeResource(
        selectedIntegration,
        selectedChannel,
        analysisOptions
      )

      // Check if the result is an error
      if (integrationService.isApiError(result)) {
        const errorMessage = `Analysis failed: ${result.message}${result.detail ? `\nDetail: ${result.detail}` : ''}`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      // Set the analysis result
      setAnalysis(result as unknown as SlackAnalysisResult)
      setAnalysisCompleted(true)

      toast({
        title: 'Analysis Complete',
        description: 'Channel analysis has been completed successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      // Optionally, if the user wants to view the result in the detailed page:
      if (result.analysis_id) {
        toast({
          title: 'Analysis Result Available',
          description:
            'You can view detailed results or navigate to the analysis result page.',
          status: 'info',
          duration: 8000,
          isClosable: true,
        })
      }
    } catch (error) {
      console.error('Error during analysis:', error)
      toast({
        title: 'Analysis Failed',
        description:
          error instanceof Error ? error.message : 'Failed to analyze channel',
        status: 'error',
        duration: 10000,
        isClosable: true,
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // When an integration is selected, load its resources
  useEffect(() => {
    if (selectedIntegration) {
      loadIntegrationResources(selectedIntegration)
    }
  }, [selectedIntegration, loadIntegrationResources])

  return (
    <Box width="100%">
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
          <BreadcrumbLink as={Link} to="/dashboard/analytics">
            Analytics
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Create Analysis</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Heading as="h1" size="xl" mb={6}>
        Create New Analysis
      </Heading>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
        {/* Step 1: Select integration and channel */}
        <GridItem>
          <Card mb={6} variant="outline">
            <CardHeader pb={2}>
              <Heading size="md">Step 1: Select Channel to Analyze</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                {/* Integration selector */}
                <FormControl>
                  <FormLabel>Workspace</FormLabel>
                  <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={3}>
                    {integrations.map((integration) => (
                      <Box
                        key={integration.id}
                        p={3}
                        borderWidth="1px"
                        borderRadius="md"
                        cursor="pointer"
                        onClick={() => setSelectedIntegration(integration.id)}
                        bg={
                          selectedIntegration === integration.id
                            ? selectedBg
                            : 'transparent'
                        }
                        borderColor={
                          selectedIntegration === integration.id
                            ? borderColorHover
                            : 'inherit'
                        }
                        _hover={{ bg: bgHover, borderColor: borderColorHover }}
                        transition="all 0.2s"
                      >
                        <HStack>
                          <Icon as={FiSlack} color="purple.500" />
                          <Text fontWeight="medium">{integration.name}</Text>
                        </HStack>
                      </Box>
                    ))}

                    {integrations.length === 0 && (
                      <Box p={4} borderWidth="1px" borderRadius="md">
                        <Text>No integrations available</Text>
                        <Button
                          as={Link}
                          to="/dashboard/integrations"
                          size="sm"
                          colorScheme="purple"
                          mt={2}
                        >
                          Connect Workspace
                        </Button>
                      </Box>
                    )}
                  </SimpleGrid>
                </FormControl>

                {/* Channel selector */}
                {selectedIntegration && (
                  <FormControl>
                    <FormLabel>Channel</FormLabel>

                    {/* Show selected channels for quick access - only if we're showing all channels */}
                    {showAllChannels &&
                      (isSelectedChannelsLoading ? (
                        <Flex align="center" justify="center" p={4}>
                          <Spinner size="sm" color="purple.500" mr={2} />
                          <Text fontSize="sm">
                            Loading selected channels...
                          </Text>
                        </Flex>
                      ) : selectedChannels.length > 0 ? (
                        <Box mb={4}>
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            mb={2}
                            color="purple.600"
                          >
                            Selected for Analysis (Quick Access)
                          </Text>
                          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                            {resources
                              .filter((resource) =>
                                selectedChannels.includes(resource.id)
                              )
                              .map((resource) => (
                                <Box
                                  key={resource.id}
                                  p={2}
                                  borderWidth="1px"
                                  borderRadius="md"
                                  cursor="pointer"
                                  onClick={() =>
                                    setSelectedChannel(resource.id)
                                  }
                                  bg={
                                    selectedChannel === resource.id
                                      ? selectedBg
                                      : 'transparent'
                                  }
                                  _hover={{ bg: bgHover }}
                                  borderColor="purple.300"
                                >
                                  <HStack>
                                    <Icon
                                      as={FiMessageSquare}
                                      color="purple.500"
                                    />
                                    <Text>#{resource.name}</Text>
                                  </HStack>
                                </Box>
                              ))}
                          </SimpleGrid>
                        </Box>
                      ) : null)}

                    <Flex justify="space-between" align="center" mb={4}>
                      <InputGroup flex="1" mr={4}>
                        <InputLeftElement>
                          <Icon as={FiSearch} color="gray.400" />
                        </InputLeftElement>
                        <Input
                          placeholder="Search channels..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </InputGroup>

                      <FormControl
                        display="flex"
                        alignItems="center"
                        width="auto"
                      >
                        <Switch
                          id="show-all-channels"
                          isChecked={showAllChannels}
                          onChange={(e) => setShowAllChannels(e.target.checked)}
                          colorScheme="purple"
                          mr={2}
                        />
                        <FormLabel
                          htmlFor="show-all-channels"
                          mb={0}
                          fontSize="sm"
                        >
                          Show All Channels
                        </FormLabel>
                      </FormControl>
                    </Flex>

                    <Flex justify="space-between" align="center" mb={2}>
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color={showAllChannels ? 'gray.600' : 'purple.600'}
                      >
                        {showAllChannels
                          ? 'All Channels'
                          : selectedForAnalysisChannels.length > 0
                            ? 'Channels Selected for Analysis'
                            : 'All Channels'}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {filteredResources.length} channel
                        {filteredResources.length !== 1 ? 's' : ''} found
                      </Text>
                    </Flex>

                    <Box
                      borderWidth="1px"
                      borderRadius="md"
                      maxHeight="300px"
                      overflowY="auto"
                    >
                      {isLoading ? (
                        <Flex justify="center" align="center" py={8}>
                          <Spinner size="md" color="purple.500" />
                        </Flex>
                      ) : filteredResources.length === 0 ? (
                        <Box p={4} textAlign="center">
                          <Text color="gray.500">No channels found</Text>
                        </Box>
                      ) : (
                        filteredResources.map((resource) => (
                          <Box
                            key={resource.id}
                            p={3}
                            borderBottomWidth="1px"
                            cursor="pointer"
                            onClick={() => setSelectedChannel(resource.id)}
                            bg={
                              selectedChannel === resource.id
                                ? selectedBg
                                : selectedChannels.includes(resource.id)
                                  ? bgHover
                                  : 'transparent'
                            }
                            _hover={{ bg: bgHover }}
                            transition="all 0.2s"
                            position="relative"
                          >
                            <HStack>
                              <Icon
                                as={FiMessageSquare}
                                color={
                                  resource.is_private ||
                                  (resource.metadata &&
                                    resource.metadata.is_private)
                                    ? 'orange.500'
                                    : 'green.500'
                                }
                              />
                              <Text>#{resource.name}</Text>
                              {selectedChannels.includes(resource.id) && (
                                <Text
                                  fontSize="xs"
                                  color="purple.500"
                                  fontWeight="bold"
                                >
                                  (Selected for analysis)
                                </Text>
                              )}
                            </HStack>
                          </Box>
                        ))
                      )}
                    </Box>
                  </FormControl>
                )}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>

        {/* Step 2: Set analysis parameters */}
        <GridItem>
          <Card mb={6} variant="outline">
            <CardHeader pb={2}>
              <Heading size="md">Step 2: Set Analysis Parameters</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>Start Date</FormLabel>
                    <InputGroup>
                      <InputLeftElement>
                        <Icon as={FiCalendar} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </InputGroup>
                  </FormControl>

                  <FormControl>
                    <FormLabel>End Date</FormLabel>
                    <InputGroup>
                      <InputLeftElement>
                        <Icon as={FiCalendar} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </InputGroup>
                  </FormControl>
                </HStack>

                <FormControl>
                  <FormLabel>Analysis Options</FormLabel>
                  <Stack>
                    <Checkbox
                      isChecked={includeThreads}
                      onChange={(e) => setIncludeThreads(e.target.checked)}
                      colorScheme="purple"
                    >
                      Include Thread Replies
                    </Checkbox>

                    <Checkbox
                      isChecked={includeReactions}
                      onChange={(e) => setIncludeReactions(e.target.checked)}
                      colorScheme="purple"
                    >
                      Include Reactions
                    </Checkbox>
                  </Stack>
                </FormControl>

                <FormControl>
                  <FormHelperText>
                    Select a date range and options for analysis. A larger date
                    range will take longer to analyze.
                  </FormHelperText>
                </FormControl>
              </VStack>
            </CardBody>
            <Divider />
            <CardFooter>
              <Button
                rightIcon={<Icon as={isAnalyzing ? undefined : FiArrowRight} />}
                colorScheme="purple"
                onClick={runAnalysis}
                isDisabled={
                  !selectedIntegration || !selectedChannel || isAnalyzing
                }
                isLoading={isAnalyzing}
                loadingText="Running Analysis..."
                width="100%"
              >
                Run Analysis
              </Button>
            </CardFooter>
          </Card>

          {/* Analysis information */}
          <Card variant="outline">
            <CardHeader pb={0}>
              <HStack>
                <Icon as={FiFileText} color="purple.500" />
                <Heading size="md">Analysis Information</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Text>
                  The analysis will evaluate channel communication patterns and
                  identify:
                </Text>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <Box p={3} borderWidth="1px" borderRadius="md">
                    <Heading size="xs" mb={2}>
                      Channel Summary
                    </Heading>
                    <Text fontSize="sm">
                      Overall activity patterns and main discussion topics
                    </Text>
                  </Box>
                  <Box p={3} borderWidth="1px" borderRadius="md">
                    <Heading size="xs" mb={2}>
                      Topic Analysis
                    </Heading>
                    <Text fontSize="sm">
                      Key topics and themes discussed in the channel
                    </Text>
                  </Box>
                  <Box p={3} borderWidth="1px" borderRadius="md">
                    <Heading size="xs" mb={2}>
                      Contributor Insights
                    </Heading>
                    <Text fontSize="sm">
                      Participation patterns and key contributors
                    </Text>
                  </Box>
                  <Box p={3} borderWidth="1px" borderRadius="md">
                    <Heading size="xs" mb={2}>
                      Key Highlights
                    </Heading>
                    <Text fontSize="sm">
                      Important discussions and significant threads
                    </Text>
                  </Box>
                </SimpleGrid>
                <Text fontSize="sm" color="gray.600">
                  Analysis typically takes 1-2 minutes to complete depending on
                  channel volume.
                </Text>
              </VStack>
            </CardBody>
          </Card>
        </GridItem>
        {/* Processing Indicator */}
        {isAnalyzing && (
          <GridItem colSpan={{ base: 1, lg: 2 }}>
            <Card
              mb={6}
              bgColor="purple.50"
              boxShadow="lg"
              position="relative"
              sx={{
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0px rgba(159, 122, 234, 0.7)' },
                  '70%': { boxShadow: '0 0 0 15px rgba(159, 122, 234, 0)' },
                  '100%': { boxShadow: '0 0 0 0px rgba(159, 122, 234, 0)' },
                },
              }}
            >
              <CardBody>
                <Flex direction="column" align="center" justify="center" py={8}>
                  <Box position="relative" mb={4}>
                    <Spinner
                      size="xl"
                      color="purple.500"
                      thickness="4px"
                      speed="0.8s"
                    />
                    <Box
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                      fontSize="sm"
                      fontWeight="bold"
                      color="purple.600"
                    >
                      LLM
                    </Box>
                  </Box>

                  <Heading size="md" mb={2} color="purple.700">
                    Analyzing Channel Data
                  </Heading>
                  <Text textAlign="center" maxW="lg" mb={3}>
                    Analysis is in progress. This process may take several
                    minutes for large channels with many messages.
                  </Text>

                  <Box
                    p={3}
                    bg="white"
                    borderRadius="md"
                    width="100%"
                    maxW="lg"
                  >
                    <Heading size="xs" mb={2} color="purple.600">
                      Processing Steps:
                    </Heading>
                    <HStack mb={1}>
                      <Icon as={FiMessageSquare} color="green.500" />
                      <Text fontSize="sm">Retrieving channel messages</Text>
                    </HStack>
                    <HStack mb={1}>
                      <Icon as={FiUsers} color="purple.500" />
                      <Text fontSize="sm">
                        Analyzing communication patterns
                      </Text>
                    </HStack>
                    <HStack>
                      <Icon as={FiBarChart2} color="blue.500" />
                      <Text fontSize="sm">
                        Generating insights and recommendations
                      </Text>
                    </HStack>
                  </Box>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
        )}

        {/* Analysis Results (only shown when analysis is complete) */}
        {analysisCompleted && analysis && (
          <GridItem colSpan={{ base: 1, lg: 2 }}>
            <Card
              variant="elevated"
              mb={6}
              borderColor="green.300"
              borderWidth={2}
            >
              <CardHeader>
                <Heading size="lg">Analysis Results</Heading>
              </CardHeader>
              <CardBody>
                {/* Analysis Stats */}
                <SimpleGrid
                  columns={{ base: 1, md: 2, lg: 4 }}
                  spacing={4}
                  mb={6}
                >
                  <Stat>
                    <StatLabel>Messages</StatLabel>
                    <StatNumber>
                      {analysis.stats?.message_count || 0}
                    </StatNumber>
                    <StatHelpText>Total messages analyzed</StatHelpText>
                  </Stat>

                  <Stat>
                    <StatLabel>Participants</StatLabel>
                    <StatNumber>
                      {analysis.stats?.participant_count || 0}
                    </StatNumber>
                    <StatHelpText>Unique contributors</StatHelpText>
                  </Stat>

                  <Stat>
                    <StatLabel>Threads</StatLabel>
                    <StatNumber>{analysis.stats?.thread_count || 0}</StatNumber>
                    <StatHelpText>Conversation threads</StatHelpText>
                  </Stat>

                  <Stat>
                    <StatLabel>Reactions</StatLabel>
                    <StatNumber>
                      {analysis.stats?.reaction_count || 0}
                    </StatNumber>
                    <StatHelpText>Total emoji reactions</StatHelpText>
                  </Stat>
                </SimpleGrid>

                {/* Analysis Content */}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <Card>
                    <CardHeader>
                      <Heading size="md">Channel Summary</Heading>
                    </CardHeader>
                    <CardBody>
                      {analysis.channel_summary ? (
                        <Box>
                          {analysis.channel_summary
                            .split('\n')
                            .map((paragraph, index) => (
                              <Box key={index} mb={2}>
                                {paragraph || <Box height="1em" />}
                              </Box>
                            ))}
                        </Box>
                      ) : (
                        <Text color="gray.500">No summary available</Text>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Heading size="md">Topic Analysis</Heading>
                    </CardHeader>
                    <CardBody>
                      {analysis.topic_analysis ? (
                        <Box>
                          {analysis.topic_analysis
                            .split('\n')
                            .map((paragraph, index) => (
                              <Box key={index} mb={2}>
                                {paragraph || <Box height="1em" />}
                              </Box>
                            ))}
                        </Box>
                      ) : (
                        <Text color="gray.500">
                          No topic analysis available
                        </Text>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Heading size="md">Contributor Insights</Heading>
                    </CardHeader>
                    <CardBody>
                      {analysis.contributor_insights ? (
                        <Box>
                          {analysis.contributor_insights
                            .split('\n')
                            .map((paragraph, index) => (
                              <Box key={index} mb={2}>
                                {paragraph || <Box height="1em" />}
                              </Box>
                            ))}
                        </Box>
                      ) : (
                        <Text color="gray.500">
                          No contributor insights available
                        </Text>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Heading size="md">Key Highlights</Heading>
                    </CardHeader>
                    <CardBody>
                      {analysis.key_highlights ? (
                        <Box>
                          {analysis.key_highlights
                            .split('\n')
                            .map((paragraph, index) => (
                              <Box key={index} mb={2}>
                                {paragraph || <Box height="1em" />}
                              </Box>
                            ))}
                        </Box>
                      ) : (
                        <Text color="gray.500">
                          No key highlights available
                        </Text>
                      )}
                    </CardBody>
                  </Card>
                </SimpleGrid>

                {/* Analysis metadata */}
                <Box mt={4} p={3} borderRadius="md" bg="gray.50">
                  <HStack spacing={2}>
                    <Text fontWeight="bold" fontSize="sm">
                      Analysis period:
                    </Text>
                    <Text fontSize="sm">
                      {analysis.period?.start
                        ? new Date(analysis.period.start).toLocaleDateString()
                        : 'Unknown'}{' '}
                      to{' '}
                      {analysis.period?.end
                        ? new Date(analysis.period.end).toLocaleDateString()
                        : 'Unknown'}
                    </Text>
                  </HStack>

                  <HStack spacing={2}>
                    <Text fontWeight="bold" fontSize="sm">
                      Model:
                    </Text>
                    <Text fontSize="sm">
                      {analysis.model_used || 'Unknown'}
                    </Text>
                  </HStack>

                  <HStack spacing={2}>
                    <Text fontWeight="bold" fontSize="sm">
                      Generated:
                    </Text>
                    <Text fontSize="sm">
                      {analysis.generated_at
                        ? new Date(analysis.generated_at).toLocaleString()
                        : 'Unknown'}
                    </Text>
                  </HStack>
                </Box>

                {/* View detailed results button */}
                {analysis.analysis_id && (
                  <Flex justify="center" mt={6}>
                    <Button
                      as={Link}
                      to={`/dashboard/integrations/${selectedIntegration}/channels/${selectedChannel}/analysis/${analysis.analysis_id}`}
                      colorScheme="purple"
                      leftIcon={<Icon as={FiFileText} />}
                    >
                      View Detailed Results
                    </Button>
                  </Flex>
                )}
              </CardBody>
            </Card>
          </GridItem>
        )}
      </Grid>
    </Box>
  )
}

export default CreateAnalysisPage
