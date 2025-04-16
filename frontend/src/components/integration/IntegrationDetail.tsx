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
  const [localSlackAuth, setLocalSlackAuth] = useState<boolean>(false)

  // Check for local Slack auth info
  useEffect(() => {
    const hasLocalSlackAuth = Boolean(localStorage.getItem('slack_auth_code'))
    const hasSlackClientId = Boolean(localStorage.getItem('slack_client_id'))
    setLocalSlackAuth(hasLocalSlackAuth && hasSlackClientId)
  }, [])

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
    console.log('Sync button clicked')
    console.log('Integration ID:', integrationId)
    console.log('Local Slack Auth:', localSlackAuth)
    console.log('Integration service type:', currentIntegration?.service_type)

    if (!integrationId) {
      console.log('No integration ID, returning')
      return
    }

    // If we're using local Slack auth, simulate a sync instead of calling backend
    if (localSlackAuth && currentIntegration?.service_type === 'slack') {
      console.log('Using local Slack auth, simulating sync')
      setIsSyncing(true)

      try {
        // Simulate resource sync with a delay
        await new Promise((resolve) => setTimeout(resolve, 1500))

        toast({
          title: 'Resources synced locally',
          description: 'Using local credentials from browser storage',
          status: 'info',
          duration: 3000,
          isClosable: true,
        })
        console.log('Local sync complete')
      } finally {
        setIsSyncing(false)
      }
      return
    }

    // Otherwise call the backend
    console.log('Calling backend sync resources')
    setIsSyncing(true)
    try {
      console.log('Calling syncResources with ID:', integrationId)
      const success = await syncResources(integrationId)
      console.log('Sync result:', success)

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
      console.error('Error syncing resources:', error)
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

        {localSlackAuth && (
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
            p={4}
            mt={6}
            mb={6}
          >
            <Flex alignItems="center" mb={4}>
              <Box fontSize="2xl" mr={3}>
                💬
              </Box>
              <VStack align="start" spacing={0} flex={1}>
                <Heading size="md" noOfLines={1}>
                  Slack Workspace
                </Heading>
                <Text color="gray.500" fontSize="sm">
                  slack
                </Text>
              </VStack>
              <Badge
                colorScheme="green"
                variant="subtle"
                px={2}
                py={1}
                borderRadius="full"
              >
                locally authenticated
              </Badge>
            </Flex>

            <Text fontSize="sm" color="gray.600" mb={4}>
              Client ID:{' '}
              {localStorage.getItem('slack_client_id')?.substring(0, 8)}...
            </Text>

            <Text fontSize="sm" color="green.600" mb={4}>
              Authorization code is stored locally. Integration data is not
              available from the backend.
            </Text>
          </Card>
        )}

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

  return (
    <Box p={6}>
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
            {localSlackAuth && (
              <Badge
                colorScheme="blue"
                variant="subtle"
                px={2}
                py={1}
                borderRadius="full"
              >
                Local Auth
              </Badge>
            )}
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
    </Box>
  )
}

export default IntegrationDetail
