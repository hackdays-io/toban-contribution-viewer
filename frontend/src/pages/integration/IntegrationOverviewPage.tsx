import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  HStack,
  Icon,
  Card,
  CardHeader,
  CardBody,
  VStack,
  Text,
  Heading,
  Spinner,
  Flex,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react'
import { FiArrowLeft, FiRefreshCw, FiZap, FiLink } from 'react-icons/fi'
import { PageTitle } from '../../components/layout'
import useIntegration from '../../context/useIntegration'
import { ResourceType, IntegrationStatus } from '../../lib/integrationService'

/**
 * DetailPanel properties
 */
interface DetailPanelProps {
  title: string
  children: React.ReactNode
}

/**
 * DetailPanel component to show a section of integration details
 */
const DetailPanel: React.FC<DetailPanelProps> = ({ title, children }) => (
  <Box mb={6}>
    <Heading size="sm" mb={2}>
      {title}
    </Heading>
    <Box>{children}</Box>
  </Box>
)

/**
 * Page component for displaying overview information about a specific integration
 */
const IntegrationOverviewPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const navigate = useNavigate()
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')

  const {
    currentIntegration,
    currentResources,
    loading,
    loadingResources,
    error,
    resourceError,
    fetchIntegration,
    fetchResources,
    syncResources,
    selectIntegration,
  } = useIntegration()

  // Initialize the integration data
  useEffect(() => {
    if (integrationId) {
      selectIntegration(integrationId)
    }
  }, [integrationId, selectIntegration])

  // Handler for refreshing integration details
  const handleRefresh = async () => {
    if (!integrationId) return

    try {
      await fetchIntegration(integrationId)
      await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER])
    } catch (error) {
      console.error('Error refreshing integration details:', error)
    }
  }

  // Handler for syncing resources
  const handleSyncResources = async () => {
    if (!integrationId) return

    try {
      await syncResources(integrationId, [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER])
    } catch (error) {
      console.error('Error syncing resources:', error)
    }
  }

  // Get resources by type
  const getResourcesByType = (type: ResourceType): number => {
    return currentResources.filter((r) => r.resource_type === type).length
  }

  // Get the total number of resources
  const getTotalResources = (): number => {
    return currentResources.length
  }

  // Determine if the integration needs reconnection
  const needsReconnection =
    currentIntegration &&
    (currentIntegration.status === IntegrationStatus.EXPIRED ||
      currentIntegration.status === IntegrationStatus.REVOKED ||
      (currentIntegration.status === IntegrationStatus.ERROR &&
        currentIntegration.service_type === 'slack'))

  const handleBack = () => {
    navigate(-1)
  }

  // Render loading state
  if (loading) {
    return (
      <Box>
        <HStack mb={4}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            variant="ghost"
            onClick={handleBack}
          >
            Back
          </Button>
        </HStack>
        <Flex height="300px" justify="center" align="center">
          <Spinner size="xl" />
        </Flex>
      </Box>
    )
  }

  // Render error state
  if (error || !currentIntegration) {
    return (
      <Box>
        <HStack mb={4}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            variant="ghost"
            onClick={handleBack}
          >
            Back
          </Button>
        </HStack>
        <Heading size="md" color="red.500" mb={4}>
          {error ? error.message : 'Integration not found'}
        </Heading>
      </Box>
    )
  }

  return (
    <Box>
      <HStack mb={4}>
        <Button
          leftIcon={<Icon as={FiArrowLeft} />}
          variant="ghost"
          onClick={handleBack}
        >
          Back
        </Button>
      </HStack>

      <PageTitle
        title={`${currentIntegration.name} - Overview`}
        description="View integration details and summary"
      />

      <Box mt={8}>
        <Flex mb={4} justify="space-between" align="center">
          <Heading size="md">Integration Details</Heading>
          <HStack>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={handleRefresh}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
            <Button
              leftIcon={<FiZap />}
              onClick={handleSyncResources}
              colorScheme="blue"
              size="sm"
            >
              Sync Resources
            </Button>
          </HStack>
        </Flex>

        <VStack align="stretch" spacing={6}>
          {/* Description card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
          >
            <CardHeader>
              <Heading size="md">Description</Heading>
            </CardHeader>
            <CardBody>
              <Text>
                {currentIntegration.description ||
                  'No description provided.'}
              </Text>
            </CardBody>
          </Card>

          {/* Integration details card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
          >
            <CardHeader>
              <Heading size="md">Details</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <DetailPanel title="Service">
                  <Text>{currentIntegration.service_type}</Text>
                </DetailPanel>

                <DetailPanel title="Status">
                  <Flex align="center">
                    <Badge
                      colorScheme={
                        currentIntegration.status ===
                        IntegrationStatus.ACTIVE
                          ? 'green'
                          : currentIntegration.status ===
                            IntegrationStatus.DISCONNECTED
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {currentIntegration.status}
                    </Badge>

                    {/* Reconnect button for expired/revoked tokens */}
                    {needsReconnection &&
                      currentIntegration.service_type === 'slack' && (
                        <Button
                          ml={4}
                          size="sm"
                          colorScheme="blue"
                          leftIcon={<FiLink />}
                          onClick={() => navigate(`/dashboard/integrations/${integrationId}/settings`)}
                        >
                          Reconnect
                        </Button>
                      )}
                  </Flex>
                </DetailPanel>

                <DetailPanel title="Team">
                  <Text>{currentIntegration.owner_team.name}</Text>
                </DetailPanel>

                <DetailPanel title="Created">
                  <Text>
                    {new Date(
                      currentIntegration.created_at
                    ).toLocaleString()}
                  </Text>
                </DetailPanel>

                <DetailPanel title="Last Used">
                  <Text>
                    {currentIntegration.last_used_at
                      ? new Date(
                        currentIntegration.last_used_at
                      ).toLocaleString()
                      : 'Never'}
                  </Text>
                </DetailPanel>

                {currentIntegration.metadata &&
                  Object.keys(currentIntegration.metadata).length > 0 && (
                    <DetailPanel title="Additional Info">
                      <VStack align="stretch" spacing={2}>
                        {Object.entries(currentIntegration.metadata).map(
                          ([key, value]) => (
                            <HStack key={key} spacing={2}>
                              <Text fontWeight="bold">{key}:</Text>
                              <Text>
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </Text>
                            </HStack>
                          )
                        )}
                      </VStack>
                    </DetailPanel>
                  )}
              </VStack>
            </CardBody>
          </Card>

          {/* Resources summary card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
          >
            <CardHeader>
              <Flex justify="space-between" align="center">
                <Heading size="md">Resources</Heading>
                <HStack>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    onClick={() => navigate(`/dashboard/integrations/${integrationId}/resources`)}
                  >
                    View All Resources
                  </Button>
                </HStack>
              </Flex>
            </CardHeader>
            <CardBody>
              {loadingResources ? (
                <Flex justify="center" py={4}>
                  <Spinner />
                </Flex>
              ) : resourceError ? (
                <Text color="red.500">{resourceError.message}</Text>
              ) : currentResources.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Text mb={4}>No resources found.</Text>
                  <Button
                    colorScheme="blue"
                    onClick={handleSyncResources}
                  >
                    Sync Resources
                  </Button>
                </Box>
              ) : (
                <VStack align="stretch" spacing={4}>
                  {currentIntegration.service_type === 'slack' && (
                    <>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">Channels</Text>
                        <Text>
                          {getResourcesByType(ResourceType.SLACK_CHANNEL)}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">Users</Text>
                        <Text>
                          {getResourcesByType(ResourceType.SLACK_USER)}
                        </Text>
                      </HStack>
                    </>
                  )}
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Total Resources</Text>
                    <Text>{getTotalResources()}</Text>
                  </HStack>

                  {currentIntegration.service_type === 'slack' && (
                    <Flex justify="center" mt={4}>
                      <Button
                        colorScheme="purple"
                        onClick={() => 
                          navigate(`/dashboard/integrations/${integrationId}/channels`)
                        }
                      >
                        Manage Channel Analysis
                      </Button>
                    </Flex>
                  )}
                </VStack>
              )}
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </Box>
  )
}

export default IntegrationOverviewPage