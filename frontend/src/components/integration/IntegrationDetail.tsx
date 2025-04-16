import React, { useState, useEffect } from 'react'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  Button,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Flex,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Tag,
  TagLabel,
  useToast,
  useColorModeValue,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react'
import {
  FiRefreshCw,
  FiEdit2,
  FiSettings,
  FiTrash2,
  FiLock,
  FiUnlock,
  FiUsers,
  FiActivity,
  FiClock,
} from 'react-icons/fi'
import {
  IntegrationType,
  IntegrationStatus,
  ServiceResource,
  ResourceType,
  ShareLevel,
} from '../../lib/integrationService'
import useIntegration from '../../context/useIntegration'

// Helper function to get an icon for the integration type
const getIntegrationTypeIcon = (type: IntegrationType) => {
  switch (type) {
    case IntegrationType.SLACK:
      return '💬'
    case IntegrationType.GITHUB:
      return '📦'
    case IntegrationType.NOTION:
      return '📝'
    case IntegrationType.DISCORD:
      return '🎮'
    default:
      return '🔌'
  }
}

// Helper function to get color for status badge
const getStatusColor = (status: IntegrationStatus) => {
  switch (status) {
    case IntegrationStatus.ACTIVE:
      return 'green'
    case IntegrationStatus.DISCONNECTED:
      return 'yellow'
    case IntegrationStatus.EXPIRED:
      return 'orange'
    case IntegrationStatus.REVOKED:
      return 'red'
    case IntegrationStatus.ERROR:
      return 'red'
    default:
      return 'gray'
  }
}

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

// Helper function to get readable resource type
const getReadableResourceType = (type: ResourceType) => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Helper function to get color for share level
const getShareLevelColor = (shareLevel: ShareLevel) => {
  switch (shareLevel) {
    case ShareLevel.FULL_ACCESS:
      return 'green'
    case ShareLevel.LIMITED_ACCESS:
      return 'blue'
    case ShareLevel.READ_ONLY:
      return 'yellow'
    default:
      return 'gray'
  }
}

interface IntegrationDetailProps {
  integrationId: string
}

/**
 * Component to display detailed information about a specific integration
 */
const IntegrationDetail: React.FC<IntegrationDetailProps> = ({
  integrationId,
}) => {
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
  } = useIntegration()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const toast = useToast()

  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')
  const statBg = useColorModeValue('blue.50', 'blue.900')
  const tableBg = useColorModeValue('white', 'gray.800')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')

  // Load integration on component mount
  useEffect(() => {
    if (integrationId) {
      fetchIntegration(integrationId)
      fetchResources(integrationId)
    }
  }, [integrationId, fetchIntegration, fetchResources])

  // Handler for refreshing integration details
  const handleRefresh = async () => {
    if (!integrationId) return

    setIsRefreshing(true)
    try {
      await fetchIntegration(integrationId)
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
      const success = await syncResources(integrationId)
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
  if (loading && !currentIntegration) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading integration details...</Text>
      </Box>
    )
  }

  // Render error state
  if (error && !currentIntegration) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="red.500">Error loading integration: {error.message}</Text>
        <Button mt={4} onClick={handleRefresh} leftIcon={<FiRefreshCw />}>
          Try Again
        </Button>
      </Box>
    )
  }

  // Return placeholder if no integration is loaded
  if (!currentIntegration) {
    return (
      <Box textAlign="center" py={10}>
        <Text>No integration selected</Text>
      </Box>
    )
  }

  return (
    <Box w="100%">
      <Flex
        justifyContent="space-between"
        alignItems="center"
        mb={6}
        flexDirection={{ base: 'column', md: 'row' }}
        gap={4}
      >
        <HStack spacing={3} alignItems="center">
          <Box fontSize="3xl">
            {getIntegrationTypeIcon(
              currentIntegration.service_type as IntegrationType
            )}
          </Box>
          <Box>
            <Heading
              size="lg"
              display="inline-flex"
              alignItems="center"
              gap={3}
            >
              {currentIntegration.name}
              <Badge
                colorScheme={getStatusColor(
                  currentIntegration.status as IntegrationStatus
                )}
                variant="solid"
                fontSize="sm"
                px={2}
                py={1}
                borderRadius="full"
              >
                {currentIntegration.status}
              </Badge>
            </Heading>
            <Text color="gray.500">{currentIntegration.service_type}</Text>
          </Box>
        </HStack>

        <HStack spacing={2}>
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
            leftIcon={
              currentIntegration.status === IntegrationStatus.ACTIVE ? (
                <FiLock />
              ) : (
                <FiUnlock />
              )
            }
            onClick={handleToggleStatus}
            colorScheme={
              currentIntegration.status === IntegrationStatus.ACTIVE
                ? 'red'
                : 'green'
            }
            variant="outline"
            size="sm"
          >
            {currentIntegration.status === IntegrationStatus.ACTIVE
              ? 'Deactivate'
              : 'Activate'}
          </Button>
          <Button leftIcon={<FiEdit2 />} colorScheme="blue" size="sm">
            Edit
          </Button>
        </HStack>
      </Flex>

      {currentIntegration.description && (
        <Box mb={6}>
          <Text>{currentIntegration.description}</Text>
        </Box>
      )}

      {/* Stats Cards */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={5} mb={6}>
        <Card bg={statBg} borderRadius="lg">
          <CardBody>
            <Stat>
              <StatLabel display="flex" alignItems="center">
                <FiClock style={{ marginRight: '8px' }} /> Last Used
              </StatLabel>
              <StatNumber>
                {currentIntegration.last_used_at
                  ? new Date(
                      currentIntegration.last_used_at
                    ).toLocaleDateString()
                  : 'Never'}
              </StatNumber>
              <StatHelpText>
                {currentIntegration.last_used_at
                  ? new Date(
                      currentIntegration.last_used_at
                    ).toLocaleTimeString()
                  : ''}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={statBg} borderRadius="lg">
          <CardBody>
            <Stat>
              <StatLabel display="flex" alignItems="center">
                <FiUsers style={{ marginRight: '8px' }} /> Owner Team
              </StatLabel>
              <StatNumber fontSize="lg">
                {currentIntegration.owner_team.name}
              </StatNumber>
              <StatHelpText>
                Created by{' '}
                {currentIntegration.created_by.name ||
                  currentIntegration.created_by.email ||
                  'Unknown'}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={statBg} borderRadius="lg">
          <CardBody>
            <Stat>
              <StatLabel display="flex" alignItems="center">
                <FiActivity style={{ marginRight: '8px' }} /> Resources
              </StatLabel>
              <StatNumber>
                {loadingResources ? (
                  <Spinner size="sm" />
                ) : (
                  currentResources.length
                )}
              </StatNumber>
              <StatHelpText>Available resources</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={statBg} borderRadius="lg">
          <CardBody>
            <Stat>
              <StatLabel display="flex" alignItems="center">
                <FiUsers style={{ marginRight: '8px' }} /> Shared With
              </StatLabel>
              <StatNumber>
                {currentIntegration.shared_with?.length || 0}
              </StatNumber>
              <StatHelpText>Teams with access</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Detailed content in tabs */}
      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>
            Resources {loadingResources && <Spinner size="xs" ml={2} />}
          </Tab>
          <Tab>Sharing</Tab>
          <Tab>Settings</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Panel */}
          <TabPanel>
            <Card
              bg={cardBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="lg"
            >
              <CardHeader>
                <Heading size="md">Integration Details</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Flex justifyContent="space-between">
                    <Text fontWeight="bold">ID</Text>
                    <Text>{currentIntegration.id}</Text>
                  </Flex>
                  <Divider />

                  <Flex justifyContent="space-between">
                    <Text fontWeight="bold">Type</Text>
                    <Text>{currentIntegration.service_type}</Text>
                  </Flex>
                  <Divider />

                  <Flex justifyContent="space-between">
                    <Text fontWeight="bold">Status</Text>
                    <Badge
                      colorScheme={getStatusColor(
                        currentIntegration.status as IntegrationStatus
                      )}
                    >
                      {currentIntegration.status}
                    </Badge>
                  </Flex>
                  <Divider />

                  <Flex justifyContent="space-between">
                    <Text fontWeight="bold">Created</Text>
                    <Text>{formatDate(currentIntegration.created_at)}</Text>
                  </Flex>
                  <Divider />

                  <Flex justifyContent="space-between">
                    <Text fontWeight="bold">Last Updated</Text>
                    <Text>{formatDate(currentIntegration.updated_at)}</Text>
                  </Flex>
                  <Divider />

                  <Flex justifyContent="space-between">
                    <Text fontWeight="bold">Last Used</Text>
                    <Text>
                      {currentIntegration.last_used_at
                        ? formatDate(currentIntegration.last_used_at)
                        : 'Never used'}
                    </Text>
                  </Flex>

                  {currentIntegration.metadata &&
                    Object.keys(currentIntegration.metadata).length > 0 && (
                      <>
                        <Divider />
                        <Box>
                          <Text fontWeight="bold" mb={2}>
                            Metadata
                          </Text>
                          <VStack align="stretch" spacing={2}>
                            {Object.entries(currentIntegration.metadata).map(
                              ([key, value]) => (
                                <Flex key={key} justifyContent="space-between">
                                  <Text>{key}</Text>
                                  <Text>
                                    {typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </Text>
                                </Flex>
                              )
                            )}
                          </VStack>
                        </Box>
                      </>
                    )}
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>

          {/* Resources Panel */}
          <TabPanel>
            <Flex justifyContent="space-between" alignItems="center" mb={4}>
              <Heading size="md">Resources</Heading>
              <Button
                leftIcon={<FiRefreshCw />}
                onClick={handleSyncResources}
                isLoading={isSyncing}
                size="sm"
              >
                Sync Resources
              </Button>
            </Flex>

            {resourceError && (
              <Box bg="red.50" color="red.500" p={3} borderRadius="md" mb={4}>
                Error loading resources: {resourceError.message}
              </Box>
            )}

            {loadingResources && !currentResources.length ? (
              <Flex justify="center" align="center" p={10}>
                <Spinner />
                <Text ml={3}>Loading resources...</Text>
              </Flex>
            ) : currentResources.length === 0 ? (
              <Box
                p={6}
                textAlign="center"
                borderWidth="1px"
                borderStyle="dashed"
                borderRadius="lg"
              >
                <Text mb={4}>No resources found for this integration.</Text>
                <Button
                  onClick={handleSyncResources}
                  colorScheme="blue"
                  leftIcon={<FiRefreshCw />}
                  isLoading={isSyncing}
                >
                  Sync Now
                </Button>
              </Box>
            ) : (
              <Box overflowX="auto">
                <Table
                  variant="simple"
                  bg={tableBg}
                  borderRadius="lg"
                  overflow="hidden"
                >
                  <Thead bg={tableHeaderBg}>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th>External ID</Th>
                      <Th>Last Synced</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {currentResources.map((resource: ServiceResource) => (
                      <Tr key={resource.id}>
                        <Td fontWeight="medium">{resource.name}</Td>
                        <Td>
                          <Tag size="sm" colorScheme="blue" borderRadius="full">
                            <TagLabel>
                              {getReadableResourceType(
                                resource.resource_type as ResourceType
                              )}
                            </TagLabel>
                          </Tag>
                        </Td>
                        <Td>
                          <Text fontSize="sm" isTruncated maxW="200px">
                            {resource.external_id}
                          </Text>
                        </Td>
                        <Td>
                          {resource.last_synced_at
                            ? new Date(resource.last_synced_at).toLocaleString()
                            : 'Never'}
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <IconButton
                              aria-label="View resource"
                              icon={<FiSettings />}
                              size="sm"
                              variant="ghost"
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </TabPanel>

          {/* Sharing Panel */}
          <TabPanel>
            <Card
              bg={cardBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="lg"
            >
              <CardHeader>
                <Heading size="md">Sharing Settings</Heading>
              </CardHeader>
              <CardBody>
                {!currentIntegration.shared_with ||
                currentIntegration.shared_with.length === 0 ? (
                  <Box
                    p={6}
                    textAlign="center"
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderRadius="lg"
                  >
                    <Text mb={4}>
                      This integration is not shared with any teams.
                    </Text>
                    <Button colorScheme="blue">Share Integration</Button>
                  </Box>
                ) : (
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Team</Th>
                          <Th>Access Level</Th>
                          <Th>Shared By</Th>
                          <Th>Shared On</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {currentIntegration.shared_with.map((share) => (
                          <Tr key={share.id}>
                            <Td fontWeight="medium">{share.team.name}</Td>
                            <Td>
                              <Badge
                                colorScheme={getShareLevelColor(
                                  share.share_level as ShareLevel
                                )}
                              >
                                {share.share_level}
                              </Badge>
                            </Td>
                            <Td>
                              {share.shared_by.name || share.shared_by.email}
                            </Td>
                            <Td>
                              {new Date(share.created_at).toLocaleDateString()}
                            </Td>
                            <Td>
                              <IconButton
                                aria-label="Revoke access"
                                icon={<FiTrash2 />}
                                colorScheme="red"
                                size="sm"
                                variant="ghost"
                              />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          {/* Settings Panel */}
          <TabPanel>
            <Card
              bg={cardBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="lg"
            >
              <CardHeader>
                <Heading size="md">Integration Settings</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <Box>
                    <Button leftIcon={<FiEdit2 />} colorScheme="blue" mb={4}>
                      Edit Integration
                    </Button>
                    <Text fontSize="sm" color="gray.500">
                      Update the integration name, description, or other
                      settings.
                    </Text>
                  </Box>

                  <Divider />

                  <Box>
                    <Button
                      leftIcon={<FiRefreshCw />}
                      colorScheme="teal"
                      mb={4}
                    >
                      Reconnect
                    </Button>
                    <Text fontSize="sm" color="gray.500">
                      Reauthenticate or refresh the connection to the service.
                    </Text>
                  </Box>

                  <Divider />

                  <Box>
                    <Button leftIcon={<FiTrash2 />} colorScheme="red" mb={4}>
                      Delete Integration
                    </Button>
                    <Text fontSize="sm" color="gray.500">
                      Permanently delete this integration and revoke all access.
                      This action cannot be undone.
                    </Text>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default IntegrationDetail
