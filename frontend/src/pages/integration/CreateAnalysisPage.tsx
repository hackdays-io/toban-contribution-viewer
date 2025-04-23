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
  Circle,
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
  Badge,
} from '@chakra-ui/react'
import {
  FiArrowRight,
  FiArrowLeft,
  FiBarChart2,
  FiCalendar,
  FiChevronRight,
  FiFileText,
  FiMessageSquare,
  FiSearch,
  FiSlack,
  FiUsers,
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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

  // Multi-step form state
  const [activeStep, setActiveStep] = useState(0)
  const totalSteps = 3

  // Analysis parameters
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [includeThreads, setIncludeThreads] = useState(true)
  const [includeReactions, setIncludeReactions] = useState(true)

  // Styles
  const bgHover = useColorModeValue('purple.50', 'purple.900')
  const borderColorHover = useColorModeValue('purple.300', 'purple.700')
  const selectedBg = useColorModeValue('purple.100', 'purple.800')
  
  // Step navigation functions
  const nextStep = () => {
    if (activeStep < totalSteps - 1) {
      setActiveStep(activeStep + 1);
    }
  };
  
  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };
  
  // Validation functions for each step
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0: // Integration selection
        return !!selectedIntegration;
      case 1: // Channel selection
        return !!selectedChannel;
      case 2: // Analysis parameters
        return !!startDate && !!endDate;
      default:
        return false;
    }
  };

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
        title: 'The report creation process successfully started',
        description:
          'Analysis is now processing. This may take several minutes depending on channel size.',
        status: 'success',
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

          // Only show the sync message if there are actual messages synced
          if (newMessages > 0 || repliesCount > 0) {
            toast({
              title: 'Channel Data Updated',
              description: `Added ${newMessages} new messages and ${repliesCount} thread replies from Slack.`,
              status: 'info',
              duration: 3000,
              isClosable: true,
            })
          }
          
          // Log sync results but don't show toast if nothing new was synced
          console.log(`Sync complete: ${newMessages} messages, ${repliesCount} replies synced.`)
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

      // Instead of showing the result on this page, notify user and redirect
      toast({
        title: 'Report Generated Successfully',
        description: 'Redirecting to the detailed report page...',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Redirect to the detailed report page
      if (result.analysis_id) {
        // Set a short timeout to allow the toast to be seen before redirecting
        setTimeout(() => {
          navigate(`/dashboard/integrations/${selectedIntegration}/channels/${selectedChannel}/analysis/${result.analysis_id}`);
        }, 1500);
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
      // Only set isAnalyzing to false if there was an error
      // This keeps the button disabled after successful creation
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

      {/* Step indicator */}
      <Flex mb={8} justify="center">
        <HStack spacing={8} width={{ base: "100%", md: "80%" }}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <Flex 
              key={index}
              flex={1}
              direction="column"
              alignItems="center"
              position="relative"
            >
              {/* Connector line */}
              {index < totalSteps - 1 && (
                <Box
                  position="absolute"
                  height="2px"
                  bg={index < activeStep ? "purple.500" : "gray.200"}
                  right="-50%"
                  top="14px"
                  width="100%"
                  zIndex={1}
                />
              )}
              
              {/* Step circle */}
              <Circle 
                size="30px"
                bg={index < activeStep ? "purple.500" : (index === activeStep ? "purple.200" : "gray.200")}
                color={index < activeStep ? "white" : (index === activeStep ? "purple.600" : "gray.500")}
                fontWeight="bold"
                mb={2}
                zIndex={2}
              >
                {index + 1}
              </Circle>
              
              {/* Step label */}
              <Text 
                fontSize="sm" 
                fontWeight="medium"
                color={index <= activeStep ? "purple.600" : "gray.500"}
              >
                {index === 0 ? "Select Workspace" : index === 1 ? "Select Channel" : "Configure"}
              </Text>
            </Flex>
          ))}
        </HStack>
      </Flex>

      {/* Step 1: Select Workspace */}
      {activeStep === 0 && (
        <Card variant="outline" mb={6} maxWidth="800px" mx="auto">
          <CardHeader pb={2}>
            <Heading size="md">Step 1: Select Workspace</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Text>
                Choose the Slack workspace you'd like to analyze.
              </Text>
              
              <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                {integrations.map((integration) => (
                  <Box
                    key={integration.id}
                    p={4}
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
                    <VStack spacing={3}>
                      <Icon as={FiSlack} color="purple.500" boxSize={6} />
                      <Text fontWeight="medium">{integration.name}</Text>
                    </VStack>
                  </Box>
                ))}

                {integrations.length === 0 && (
                  <Box p={4} borderWidth="1px" borderRadius="md" gridColumn="span 3">
                    <VStack>
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
                    </VStack>
                  </Box>
                )}
              </SimpleGrid>
            </VStack>
          </CardBody>
          <Divider />
          <CardFooter justifyContent="flex-end">
            <Button
              rightIcon={<Icon as={FiArrowRight} />}
              colorScheme="purple"
              onClick={nextStep}
              isDisabled={!isStepValid(0)}
            >
              Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Select Channel */}
      {activeStep === 1 && (
        <Card variant="outline" mb={6} maxWidth="800px" mx="auto">
          <CardHeader pb={2}>
            <Heading size="md">Step 2: Select Channel</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Text>
                Choose the Slack channel you'd like to analyze.
              </Text>
              
              <FormControl>
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
                            <Badge colorScheme="purple" ml="auto">
                              Selected for analysis
                            </Badge>
                          )}
                        </HStack>
                      </Box>
                    ))
                  )}
                </Box>
              </FormControl>
            </VStack>
          </CardBody>
          <Divider />
          <CardFooter justifyContent="space-between">
            <Button
              leftIcon={<Icon as={FiArrowLeft} />}
              variant="outline"
              onClick={prevStep}
            >
              Back
            </Button>
            <Button
              rightIcon={<Icon as={FiArrowRight} />}
              colorScheme="purple"
              onClick={nextStep}
              isDisabled={!isStepValid(1)}
            >
              Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Analysis Parameters */}
      {activeStep === 2 && (
        <Card variant="outline" mb={6} maxWidth="800px" mx="auto">
          <CardHeader pb={2}>
            <Heading size="md">Step 3: Configure Analysis</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Text>
                Set your analysis parameters and options.
              </Text>
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
              </SimpleGrid>

              <FormControl>
                <FormLabel>Analysis Options</FormLabel>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={2}>
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
                </SimpleGrid>
              </FormControl>

              <Box bg="purple.50" p={4} borderRadius="md">
                <Heading size="sm" mb={3}>Analysis will include:</Heading>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Icon as={FiFileText} color="purple.500" />
                      <Text fontWeight="medium">Channel Summary</Text>
                    </HStack>
                    <Text fontSize="sm" pl={6}>
                      Overall activity patterns and main discussion topics
                    </Text>
                  </VStack>
                  
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Icon as={FiBarChart2} color="purple.500" />
                      <Text fontWeight="medium">Topic Analysis</Text>
                    </HStack>
                    <Text fontSize="sm" pl={6}>
                      Key topics and themes discussed in the channel
                    </Text>
                  </VStack>
                  
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Icon as={FiUsers} color="purple.500" />
                      <Text fontWeight="medium">Contributor Insights</Text>
                    </HStack>
                    <Text fontSize="sm" pl={6}>
                      Participation patterns and key contributors
                    </Text>
                  </VStack>
                  
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Icon as={FiMessageSquare} color="purple.500" />
                      <Text fontWeight="medium">Key Highlights</Text>
                    </HStack>
                    <Text fontSize="sm" pl={6}>
                      Important discussions and significant threads
                    </Text>
                  </VStack>
                </SimpleGrid>
              </Box>
              
              <Text fontSize="sm" color="gray.600">
                Analysis typically takes 1-2 minutes to complete depending on
                channel volume. We'll notify you when results are ready.
              </Text>
            </VStack>
          </CardBody>
          <Divider />
          <CardFooter justifyContent="space-between">
            <Button
              leftIcon={<Icon as={FiArrowLeft} />}
              variant="outline"
              onClick={prevStep}
            >
              Back
            </Button>
            <Button
              rightIcon={<Icon as={isAnalyzing ? undefined : FiArrowRight} />}
              colorScheme="purple"
              onClick={runAnalysis}
              isDisabled={!isStepValid(2) || isAnalyzing}
              isLoading={isAnalyzing}
              loadingText="Running Analysis..."
            >
              Run Analysis
            </Button>
          </CardFooter>
        </Card>
      )}
        {/* Processing Indicator */}
        {isAnalyzing && (
          <Box maxWidth="800px" mx="auto">
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
          </Box>
        )}

        {/* We no longer show results here as we're redirecting to the detail page */}
    </Box>
  )
}

export default CreateAnalysisPage
