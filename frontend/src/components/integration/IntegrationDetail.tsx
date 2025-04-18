import React, { useEffect, useState } from 'react'
import {
  Box,
  Heading,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  VStack,
  HStack,
  Text,
  Flex,
  Badge,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider,
  Card,
  CardHeader,
  CardBody,
  Spinner,
  useToast,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FiChevronDown,
  FiRefreshCw,
  FiSettings,
  FiTrash2,
  FiShare2,
  FiLink,
  FiZap,
  FiPlusCircle,
} from 'react-icons/fi'
import useIntegration from '../../context/useIntegration'
import { IntegrationStatus, ResourceType } from '../../lib/integrationService'
import ResourceList from './ResourceList'
import ReconnectIntegration from './ReconnectIntegration'

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
 * IntegrationDetail component to view and manage an integration.
 */
const IntegrationDetail: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
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
    updateIntegration,
    selectIntegration,
  } = useIntegration()

  const [, setActiveTab] = useState<string>('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false)

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
      await fetchResources(integrationId)
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

    // Clear any previous error before starting the sync
    setIsSyncing(true)
    try {
      console.log(
        '[DETAIL] Starting resource sync for integration:',
        integrationId
      )

      // DEBUG: Store the previous error to compare after sync
      const prevError = resourceError
      console.log('[DETAIL] Previous error state:', prevError)

      const success = await syncResources(integrationId)
      console.log('[DETAIL] Sync completed with result:', success)

      // DEBUG: Log current error state after sync
      console.log('[DETAIL] Current resourceError after sync:', resourceError)

      // IMPORTANT: The success flag should be the primary determiner
      if (success === true) {
        console.log('[DETAIL] Showing success toast based on success flag')
        toast({
          title: 'Resources synced successfully',
          description: 'Channels and users have been updated',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      } else {
        // Get error message from context if available
        const errorMessage =
          resourceError?.message || 'Failed to sync resources'
        console.error('[DETAIL] Showing error toast. Message:', errorMessage)

        toast({
          title: 'Failed to sync resources',
          description: errorMessage,
          status: 'error',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      }
    } catch (error) {
      console.error('[DETAIL] Exception during sync handler:', error)
      toast({
        title: 'Error syncing resources',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Handler for toggling integration status
  const handleToggleStatus = async () => {
    if (!currentIntegration) return

    const newStatus =
      currentIntegration.status === IntegrationStatus.ACTIVE
        ? IntegrationStatus.DISCONNECTED
        : IntegrationStatus.ACTIVE

    const result = await updateIntegration(integrationId, {
      status: newStatus,
    })

    if (result) {
      toast({
        title: `Integration ${newStatus === IntegrationStatus.ACTIVE ? 'activated' : 'deactivated'}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  // Render loading state
  if (loading && !isRefreshing) {
    return (
      <Flex height="100%" justify="center" align="center" p={8}>
        <Spinner size="xl" color="blue.500" thickness="4px" />
      </Flex>
    )
  }

  // Render error state
  if (error || !currentIntegration) {
    return (
      <Box p={6} textAlign="center">
        <Heading size="md" mb={4} color="red.500">
          {error
            ? `Error: ${error.message}`
            : 'Integration not found or error loading data'}
        </Heading>

        <Button
          mt={4}
          onClick={() => navigate('/dashboard/integrations')}
          colorScheme="blue"
        >
          Back to Integrations
        </Button>
      </Box>
    )
  }

  // Get resources by type
  const getResourcesByType = (type: ResourceType): number => {
    return currentResources.filter((r) => r.resource_type === type).length
  }

  // Get the total number of resources
  const getTotalResources = (): number => {
    return currentResources.length
  }

  // Function to handle reconnection request
  const handleReconnect = () => {
    if (!currentIntegration || !integrationId) return

    // Store integration details in session storage for reconnection flow
    sessionStorage.setItem('slack_integration_id', integrationId)
    sessionStorage.setItem('slack_team_id', currentIntegration.owner_team.id)

    // Open reconnect modal
    setIsReconnectModalOpen(true)
  }

  // Determine if the integration needs reconnection
  const needsReconnection =
    currentIntegration &&
    (currentIntegration.status === IntegrationStatus.EXPIRED ||
      currentIntegration.status === IntegrationStatus.REVOKED ||
      (currentIntegration.status === IntegrationStatus.ERROR &&
        currentIntegration.service_type === 'slack'))

  return (
    <Box p={6}>
      {/* Banner for expired/revoked tokens */}
      {needsReconnection && (
        <Alert status="warning" mb={6} borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>
              Authentication {currentIntegration.status.toLowerCase()}
            </AlertTitle>
            <AlertDescription>
              This Slack integration's token has{' '}
              {currentIntegration.status === IntegrationStatus.EXPIRED
                ? 'expired'
                : currentIntegration.status === IntegrationStatus.REVOKED
                  ? 'been revoked'
                  : 'an error'}
              . You need to reconnect to continue accessing Slack data.
            </AlertDescription>
          </Box>
          <Button colorScheme="blue" size="sm" onClick={handleReconnect}>
            Reconnect
          </Button>
        </Alert>
      )}

      {/* Integration header */}
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        mb={6}
        gap={4}
      >
        <VStack align="start" spacing={1}>
          <Heading as="h1" size="lg">
            {currentIntegration.name}
          </Heading>
          <HStack spacing={2}>
            <Text color="gray.500">{currentIntegration.service_type}</Text>
            <Text color="gray.500">•</Text>
            <Text color="gray.500">
              Owned by {currentIntegration.owner_team.name}
            </Text>
            <Badge
              colorScheme={
                currentIntegration.status === IntegrationStatus.ACTIVE
                  ? 'green'
                  : currentIntegration.status === IntegrationStatus.DISCONNECTED
                    ? 'yellow'
                    : 'red'
              }
              variant="subtle"
              px={2}
              py={1}
              borderRadius="full"
            >
              {currentIntegration.status}
            </Badge>
          </HStack>
        </VStack>

        <HStack spacing={4}>
          <Button
            leftIcon={<FiRefreshCw />}
            onClick={handleRefresh}
            isLoading={isRefreshing}
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>

          <Menu>
            <MenuButton
              as={Button}
              rightIcon={<FiChevronDown />}
              colorScheme="blue"
              size="sm"
            >
              Actions
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<FiZap />}
                onClick={handleSyncResources}
                isDisabled={isSyncing}
              >
                Sync Resources
              </MenuItem>
              <MenuItem
                icon={<FiSettings />}
                onClick={() =>
                  navigate(`/dashboard/integrations/${integrationId}/settings`)
                }
              >
                Settings
              </MenuItem>
              <MenuItem
                icon={<FiShare2 />}
                onClick={() => console.log('Share')}
              >
                Share Integration
              </MenuItem>
              <Divider />
              <MenuItem
                icon={
                  currentIntegration.status === IntegrationStatus.ACTIVE ? (
                    <FiLink />
                  ) : (
                    <FiLink />
                  )
                }
                onClick={handleToggleStatus}
              >
                {currentIntegration.status === IntegrationStatus.ACTIVE
                  ? 'Disconnect'
                  : 'Reconnect'}
              </MenuItem>
              <MenuItem icon={<FiTrash2 />} color="red.500">
                Delete Integration
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>

      {/* Tab navigation */}
      <Tabs
        variant="enclosed"
        colorScheme="blue"
        onChange={(index) => {
          setActiveTab(['overview', 'resources', 'settings'][index])
        }}
        defaultIndex={0}
      >
        <TabList>
          <Tab>Overview</Tab>
          <Tab>
            Resources {getTotalResources() > 0 && `(${getTotalResources()})`}
          </Tab>
          <Tab>Settings</Tab>
        </TabList>

        <TabPanels>
          {/* Overview tab */}
          <TabPanel>
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
                              onClick={handleReconnect}
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
                <CardHeader pb={0}>
                  <Flex justify="space-between" align="center">
                    <Heading size="md">Resources</Heading>
                    <Button
                      size="sm"
                      leftIcon={<FiZap />}
                      colorScheme="blue"
                      variant="outline"
                      onClick={handleSyncResources}
                      isLoading={isSyncing}
                    >
                      Sync Resources
                    </Button>
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
                        leftIcon={<FiPlusCircle />}
                        colorScheme="blue"
                        onClick={handleSyncResources}
                        isLoading={isSyncing}
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
                    </VStack>
                  )}
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* Resources tab */}
          <TabPanel>
            <Box>
              <Flex justify="space-between" mb={4}>
                <Heading size="md">Resources</Heading>
                <Button
                  leftIcon={<FiZap />}
                  colorScheme="blue"
                  onClick={handleSyncResources}
                  isLoading={isSyncing}
                >
                  Sync Resources
                </Button>
              </Flex>

              {loadingResources ? (
                <Flex justify="center" py={8}>
                  <Spinner size="xl" />
                </Flex>
              ) : resourceError ? (
                <Text color="red.500" mb={4}>
                  {resourceError.message}
                </Text>
              ) : (
                <ResourceList
                  resources={currentResources}
                  integrationId={integrationId || ''}
                />
              )}
            </Box>
          </TabPanel>

          {/* Settings tab */}
          <TabPanel>
            <VStack align="stretch" spacing={6}>
              {/* Basic settings card */}
              <Card
                borderWidth="1px"
                borderRadius="lg"
                overflow="hidden"
                bg={cardBg}
                borderColor={cardBorder}
              >
                <CardHeader>
                  <Heading size="md">Basic Settings</Heading>
                </CardHeader>
                <CardBody>
                  <Text>Settings controls will be implemented here.</Text>
                </CardBody>
              </Card>

              {/* Danger zone card */}
              <Card
                borderWidth="1px"
                borderRadius="lg"
                overflow="hidden"
                bg={cardBg}
                borderColor="red.200"
              >
                <CardHeader bg="red.50" _dark={{ bg: 'red.900' }}>
                  <Heading size="md" color="red.500">
                    Danger Zone
                  </Heading>
                </CardHeader>
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    <Box>
                      <Heading size="sm" mb={2}>
                        Disconnect Integration
                      </Heading>
                      <Text mb={2}>
                        Temporarily disable this integration without deleting
                        it.
                      </Text>
                      <Button
                        colorScheme="orange"
                        variant="outline"
                        onClick={handleToggleStatus}
                        isDisabled={
                          currentIntegration.status ===
                          IntegrationStatus.DISCONNECTED
                        }
                      >
                        Disconnect
                      </Button>
                    </Box>

                    <Divider />

                    <Box>
                      <Heading size="sm" mb={2}>
                        Delete Integration
                      </Heading>
                      <Text mb={2}>
                        Permanently delete this integration and all its data.
                        This action cannot be undone.
                      </Text>
                      <Button colorScheme="red">Delete Integration</Button>
                    </Box>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Reconnection Modal */}
      {currentIntegration && (
        <ReconnectIntegration
          integration={currentIntegration}
          isOpen={isReconnectModalOpen}
          onClose={() => setIsReconnectModalOpen(false)}
        />
      )}
    </Box>
  )
}

export default IntegrationDetail
