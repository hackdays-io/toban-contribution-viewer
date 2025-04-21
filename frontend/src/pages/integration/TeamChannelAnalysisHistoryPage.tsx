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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
} from '@chakra-ui/react'
import {
  FiChevronRight,
  FiArrowLeft,
  FiClock,
  FiFileText,
} from 'react-icons/fi'
import { Link, useParams, useNavigate } from 'react-router-dom'
import env from '../../config/env'
import useIntegration from '../../context/useIntegration'
import integrationService, { ServiceResource } from '../../lib/integrationService'

interface AnalysisHistoryItem {
  id: string
  channel_id: string
  start_date: string
  end_date: string
  message_count: number
  model_used: string
  generated_at: string
}

interface Channel extends ServiceResource {
  type: string
  topic?: string
  purpose?: string
}

const TeamChannelAnalysisHistoryPage: React.FC = () => {
  const { integrationId, channelId } = useParams<{
    integrationId: string
    channelId: string
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
  const [analyses, setAnalyses] = useState<AnalysisHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  useEffect(() => {
    if (integrationId && channelId) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, channelId])

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

      // Fetch analysis history using integrationService
      const analysesResult = await integrationService.getResourceAnalyses(
        integrationId || '',
        channelId || ''
      )
      
      // Check if the result is an API error
      if (integrationService.isApiError(analysesResult)) {
        throw new Error(`Error fetching analysis history: ${analysesResult.message}`)
      }
      
      // Set the analyses from the fetched result
      setAnalyses(analysesResult)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load analysis history',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderHistoryTable = () => {
    return (
      <Box overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Period</Th>
              <Th>Messages</Th>
              <Th>Model</Th>
              <Th>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {analyses.map((analysis) => (
              <Tr key={analysis.id} cursor="pointer" _hover={{ bg: 'gray.50' }}>
                <Td>{formatDate(analysis.generated_at)}</Td>
                <Td>
                  {new Date(analysis.start_date).toLocaleDateString()} -{' '}
                  {new Date(analysis.end_date).toLocaleDateString()}
                </Td>
                <Td>{analysis.message_count}</Td>
                <Td>
                  <Badge colorScheme="purple" fontSize="xs">
                    {analysis.model_used?.split('/').pop() || 'AI Model'}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="xs"
                    colorScheme="purple"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/dashboard/integrations/${integrationId}/channels/${channelId}/analysis/${analysis.id}`
                      )
                    }
                  >
                    View
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    )
  }

  return (
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
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Analysis History</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header actions */}
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">
          {channel?.name
            ? `#${channel.name} Analysis History`
            : 'Channel Analysis History'}
        </Heading>
        <HStack spacing={3}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            onClick={() =>
              navigate(`/dashboard/integrations/${integrationId}/channels`)
            }
            variant="outline"
          >
            Back to Channels
          </Button>
          <Button
            leftIcon={<Icon as={FiClock} />}
            colorScheme="purple"
            onClick={() =>
              navigate(
                `/dashboard/integrations/${integrationId}/channels/${channelId}/analyze`
              )
            }
          >
            New Analysis
          </Button>
        </HStack>
      </Flex>

      {isLoading ? (
        <Flex justify="center" align="center" minHeight="400px">
          <Spinner size="xl" color="purple.500" thickness="4px" />
        </Flex>
      ) : analyses.length === 0 ? (
        <Card>
          <CardBody>
            <Box textAlign="center" py={10}>
              <Icon as={FiFileText} boxSize={12} color="gray.400" mb={4} />
              <Heading as="h3" size="md" mb={2}>
                No Analysis History
              </Heading>
              <Text mb={6}>
                There are no saved analyses for this channel yet.
              </Text>
              <Button
                colorScheme="purple"
                onClick={() =>
                  navigate(
                    `/dashboard/integrations/${integrationId}/channels/${channelId}/analyze`
                  )
                }
              >
                Run Analysis
              </Button>
            </Box>
          </CardBody>
        </Card>
      ) : (
        <Card variant="outline">
          <CardHeader>
            <Heading size="md">Analysis History</Heading>
          </CardHeader>
          <CardBody>{renderHistoryTable()}</CardBody>
        </Card>
      )}
    </Box>
  )
}

export default TeamChannelAnalysisHistoryPage
