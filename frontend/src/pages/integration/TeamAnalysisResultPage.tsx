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
  HStack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  SimpleGrid,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
} from '@chakra-ui/react'
import { FiChevronRight, FiArrowLeft, FiClock } from 'react-icons/fi'
import { Link, useParams, useNavigate } from 'react-router-dom'
import env from '../../config/env'
import MessageText from '../../components/slack/MessageText'
import { SlackUserCacheProvider } from '../../components/slack/SlackUserContext'
import useIntegration from '../../context/useIntegration'
import integrationService, { ServiceResource } from '../../lib/integrationService'

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
}

interface Channel extends ServiceResource {
  type: string
  topic?: string
  purpose?: string
}

/**
 * Page component for viewing a specific analysis result.
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
  const [currentTab, setCurrentTab] = useState(0)

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  useEffect(() => {
    if (integrationId && channelId && analysisId) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, channelId, analysisId])

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
      console.log(`Fetching analysis ${analysisId} for integration ${integrationId} and channel ${channelId}`);
      const analysisResult = await integrationService.getResourceAnalysis(
        integrationId || '',
        channelId || '',
        analysisId || ''
      );
      
      // Check if the result is an API error
      if (integrationService.isApiError(analysisResult)) {
        throw new Error(`Error fetching analysis: ${analysisResult.message}`);
      }
      
      // Set the analysis data
      setAnalysis(analysisResult);
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

  const renderAnalysisContent = () => {
    if (!analysis) {
      return (
        <Box textAlign="center" py={10}>
          <Text>Analysis data could not be loaded or is not available.</Text>
        </Box>
      )
    }

    return (
      <Tabs
        index={currentTab}
        onChange={setCurrentTab}
        colorScheme="purple"
        isLazy
      >
        <TabList>
          <Tab>Summary</Tab>
          <Tab>Topics</Tab>
          <Tab>Contributors</Tab>
          <Tab>Highlights</Tab>
        </TabList>

        <TabPanels>
          {/* Summary Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>
                Channel Summary
              </Heading>
              <Box>
                {analysis.channel_summary
                  .split('\n')
                  .map((paragraph, index) => (
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
                  ))}
              </Box>

              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mt={6}>
                <Stat>
                  <StatLabel>Messages</StatLabel>
                  <StatNumber>{analysis.message_count}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Participants</StatLabel>
                  <StatNumber>{analysis.participant_count}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Threads</StatLabel>
                  <StatNumber>{analysis.thread_count}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Reactions</StatLabel>
                  <StatNumber>{analysis.reaction_count}</StatNumber>
                </Stat>
              </SimpleGrid>
            </Box>
          </TabPanel>

          {/* Topics Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>
                Topic Analysis
              </Heading>
              <Box>
                {analysis.topic_analysis.split('\n').map((paragraph, index) => (
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
                ))}
              </Box>
            </Box>
          </TabPanel>

          {/* Contributors Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>
                Contributor Insights
              </Heading>
              <Box>
                {analysis.contributor_insights
                  .split('\n')
                  .map((paragraph, index) => (
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
                  ))}
              </Box>
            </Box>
          </TabPanel>

          {/* Highlights Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>
                Key Highlights
              </Heading>
              <Box>
                {analysis.key_highlights.split('\n').map((paragraph, index) => (
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
                ))}
              </Box>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
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
              {currentIntegration?.name || 'Integration'}
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
          <BreadcrumbItem>
            <BreadcrumbLink
              as={Link}
              to={`/dashboard/integrations/${integrationId}/channels/${channelId}/analyze`}
            >
              Analysis
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>Results</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Header actions */}
        <Flex justifyContent="space-between" alignItems="center" mb={6}>
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

        {isLoading ? (
          <Flex height="300px" justify="center" align="center">
            <Spinner size="xl" color="purple.500" thickness="4px" />
          </Flex>
        ) : (
          <>
            <Box mb={6}>
              <Heading as="h1" size="xl">
                Analysis Results
              </Heading>
              <HStack mt={2} spacing={2}>
                <Text fontWeight="bold">{currentIntegration?.name}</Text>
                <Text>&gt;</Text>
                <Text>
                  {channel?.name ? 
                    (channel.name.startsWith('#') ? channel.name : `#${channel.name}`) : 
                    (analysis?.channel_name ? 
                      (analysis.channel_name.startsWith('#') ? analysis.channel_name : `#${analysis.channel_name}`) : 
                      '#channel')}
                </Text>
                <Badge
                  colorScheme={channel?.type === 'public' ? 'green' : 'orange'}
                >
                  {channel?.type || 'channel'}
                </Badge>
              </HStack>

              {analysis && (
                <Text color="gray.600" mt={2}>
                  Analyzed period:{' '}
                  {new Date(analysis.start_date).toLocaleDateString()} to{' '}
                  {new Date(analysis.end_date).toLocaleDateString()}
                </Text>
              )}
            </Box>

            <Card variant="outline">
              <CardHeader>
                <Heading size="md">Analysis Results</Heading>
                <Text color="gray.500" fontSize="sm" mt={1}>
                  Generated on{' '}
                  {analysis ? formatDate(analysis.generated_at) : ''}
                </Text>
              </CardHeader>
              <CardBody>{renderAnalysisContent()}</CardBody>
            </Card>
          </>
        )}
      </Box>
    </SlackUserCacheProvider>
  )
}

export default TeamAnalysisResultPage
