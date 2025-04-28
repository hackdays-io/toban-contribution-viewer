import React, { useEffect, useState } from 'react'
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
  useToast,
} from '@chakra-ui/react'
import {
  FiArrowLeft,
  FiRefreshCw,
  FiZap,
  FiLink,
  FiBarChart,
  FiSettings,
} from 'react-icons/fi'
import { IntegrationDetail } from '../../components/integration'
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
 * Page component for displaying detailed information about a specific integration
 * Merged with overview functionality
 */
const IntegrationDetailPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')

  const showDashboard = true // Default to dashboard view
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

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

    setIsRefreshing(true)
    try {
      await fetchIntegration(integrationId)
      // Only fetch channel resources, user data is not needed for UI
      await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL])
      toast({
        title: 'Integration details refreshed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch {
      toast({
        title: 'Failed to refresh integration details',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handler for syncing resources
  const handleSyncResources = async () => {
    if (!integrationId) return

    setIsSyncing(true)
    try {
      // Only sync channel resources to reduce network traffic
      const success = await syncResources(integrationId, [
        ResourceType.SLACK_CHANNEL,
      ])

      if (success) {
        toast({
          title: 'Resources synced successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'Failed to sync resources',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error) {
      toast({
        title: 'Error syncing resources',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsSyncing(false)
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
    navigate('/dashboard/integrations')
  }

  // Display is currently locked to dashboard view
  // Future implementation may allow toggling between views

  // Render loading state
  if (loading && !isRefreshing) {
    return (
      <Box>
        <HStack mb={4}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            variant="ghost"
            onClick={handleBack}
          >
            Back to Integrations
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
            Back to Integrations
          </Button>
        </HStack>
        <Heading size="md" color="red.500" mb={4}>
          {error ? error.message : 'Integration not found'}
        </Heading>
      </Box>
    )
  }

  // If showing dashboard view
  if (showDashboard) {
    return (
      <Box>
        <HStack mb={4}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            variant="ghost"
            onClick={handleBack}
          >
            Back to Integrations
          </Button>
        </HStack>

        <PageTitle
          title={currentIntegration?.name || 'Integration Details'}
          description="View and manage integration details"
        />

        <Box mt={8}>
          {integrationId && <IntegrationDetail integrationId={integrationId} />}
        </Box>
      </Box>
    )
  }

  // Detail view (former overview page)
  return (
    <Box>
      <HStack mb={4}>
        <Button
          leftIcon={<Icon as={FiArrowLeft} />}
          variant="ghost"
          onClick={handleBack}
        >
          Back to Integrations
        </Button>
      </HStack>

      <PageTitle
        title={currentIntegration.name}
        description="View integration details and summary"
      />

      <Box mt={8}>
        <Flex mb={4} justify="space-between" align="center">
          <Heading size="md">Integration Details</Heading>
          <HStack>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={handleRefresh}
              isLoading={isRefreshing}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
            <Button
              leftIcon={<FiZap />}
              onClick={handleSyncResources}
              isLoading={isSyncing}
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
                {currentIntegration.description || 'No description provided.'}
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
                        currentIntegration.status === IntegrationStatus.ACTIVE
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
                          onClick={() =>
                            navigate(
                              `/dashboard/integrations/${integrationId}/settings`
                            )
                          }
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
                    {new Date(currentIntegration.created_at).toLocaleString()}
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
                  <Button colorScheme="blue" onClick={handleSyncResources}>
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
                        leftIcon={<FiBarChart />}
                        colorScheme="purple"
                        onClick={() =>
                          navigate(
                            `/dashboard/integrations/${integrationId}/channels`
                          )
                        }
                      >
                        Select Resources for Analysis
                      </Button>
                    </Flex>
                  )}
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Settings link */}
          <Flex justify="end">
            <Button
              leftIcon={<FiSettings />}
              colorScheme="gray"
              variant="outline"
              onClick={() =>
                navigate(`/dashboard/integrations/${integrationId}/settings`)
              }
            >
              Integration Settings
            </Button>
          </Flex>
        </VStack>
      </Box>
    </Box>
  )
}

export default IntegrationDetailPage
