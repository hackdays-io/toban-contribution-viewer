import React, { useState } from 'react'
import {
  Box,
  Heading,
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
import { useNavigate } from 'react-router-dom'
import {
  FiChevronDown,
  FiRefreshCw,
  FiSettings,
  FiTrash2,
  FiShare2,
  FiLink,
  FiZap,
  FiPlusCircle,
  FiBarChart,
  FiList,
  FiCheckSquare,
  FiInfo,
} from 'react-icons/fi'
import useIntegration from '../../context/useIntegration'
import { IntegrationStatus, ResourceType } from '../../lib/integrationService'
import ReconnectIntegration from './ReconnectIntegration'

/**
 * Integration detail component showing a dashboard of integration options
 */
interface IntegrationDetailProps {
  integrationId: string
}

const IntegrationDetail: React.FC<IntegrationDetailProps> = ({
  integrationId,
}) => {
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
  } = useIntegration()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false)

  // Handler for refreshing integration details
  const handleRefresh = async () => {
    if (!integrationId) return

    setIsRefreshing(true)
    try {
      await fetchIntegration(integrationId)
      await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER])
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
      const success = await syncResources(
        integrationId,
        [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER]
      )
      
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

  // Handler for toggling integration status
  const handleToggleStatus = async () => {
    if (!currentIntegration || !integrationId) return

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

      {/* Dashboard navigation cards */}
      <Box mt={6}>
        <Heading size="md" mb={4}>Integration Dashboard</Heading>
        
        <Flex direction={{ base: 'column', md: 'row' }} gap={4} wrap="wrap">
          {/* Overview Card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
            flex="1"
            minW={{ base: "100%", md: "200px" }}
            _hover={{ shadow: 'md', borderColor: 'blue.300' }}
            cursor="pointer"
            onClick={() => navigate(`/dashboard/integrations/${integrationId}/overview`)}
          >
            <CardHeader pb={0}>
              <Flex align="center" gap={2}>
                <FiInfo size="20px" color="var(--chakra-colors-blue-500)" />
                <Heading size="md">Overview</Heading>
              </Flex>
            </CardHeader>
            <CardBody>
              <Text fontSize="sm" color="gray.500" mb={3}>
                View integration details, status, and resource summary
              </Text>
              <Button size="sm" colorScheme="blue" variant="outline" width="full">
                View Details
              </Button>
            </CardBody>
          </Card>
          
          {/* Resources Card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
            flex="1"
            minW={{ base: "100%", md: "200px" }}
            _hover={{ shadow: 'md', borderColor: 'blue.300' }}
            cursor="pointer"
            onClick={() => navigate(`/dashboard/integrations/${integrationId}/resources`)}
          >
            <CardHeader pb={0}>
              <Flex align="center" gap={2}>
                <FiList size="20px" color="var(--chakra-colors-teal-500)" />
                <Heading size="md">Resources</Heading>
                {currentResources.length > 0 && (
                  <Badge colorScheme="teal" fontSize="sm" borderRadius="full">
                    {getTotalResources()}
                  </Badge>
                )}
              </Flex>
            </CardHeader>
            <CardBody>
              <Text fontSize="sm" color="gray.500" mb={3}>
                Manage and view all resources from this integration
              </Text>
              <Button size="sm" colorScheme="teal" variant="outline" width="full">
                View Resources
              </Button>
            </CardBody>
          </Card>
          
          {/* Channel Selection Card - only for Slack */}
          {currentIntegration.service_type === 'slack' && (
            <Card
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={cardBg}
              borderColor={cardBorder}
              flex="1"
              minW={{ base: "100%", md: "200px" }}
              _hover={{ shadow: 'md', borderColor: 'blue.300' }}
              cursor="pointer"
              onClick={() => navigate(`/dashboard/integrations/${integrationId}/channels`)}
            >
              <CardHeader pb={0}>
                <Flex align="center" gap={2}>
                  <FiBarChart size="20px" color="var(--chakra-colors-purple-500)" />
                  <Heading size="md">Channel Analysis</Heading>
                  {getResourcesByType(ResourceType.SLACK_CHANNEL) > 0 && (
                    <Badge colorScheme="purple" fontSize="sm" borderRadius="full">
                      {getResourcesByType(ResourceType.SLACK_CHANNEL)}
                    </Badge>
                  )}
                </Flex>
              </CardHeader>
              <CardBody>
                <Text fontSize="sm" color="gray.500" mb={3}>
                  Select channels for contribution analysis
                </Text>
                <Button size="sm" colorScheme="purple" variant="outline" width="full">
                  Manage Channels
                </Button>
              </CardBody>
            </Card>
          )}
          
          {/* Settings Card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor={cardBorder}
            flex="1"
            minW={{ base: "100%", md: "200px" }}
            _hover={{ shadow: 'md', borderColor: 'blue.300' }}
            cursor="pointer"
            onClick={() => navigate(`/dashboard/integrations/${integrationId}/settings`)}
          >
            <CardHeader pb={0}>
              <Flex align="center" gap={2}>
                <FiSettings size="20px" color="var(--chakra-colors-gray-500)" />
                <Heading size="md">Settings</Heading>
              </Flex>
            </CardHeader>
            <CardBody>
              <Text fontSize="sm" color="gray.500" mb={3}>
                Configure and manage integration settings
              </Text>
              <Button size="sm" colorScheme="gray" variant="outline" width="full">
                Manage Settings
              </Button>
            </CardBody>
          </Card>
        </Flex>
        
        {/* Quick Actions */}
        <Box mt={6}>
          <Heading size="md" mb={4}>Quick Actions</Heading>
          <Flex gap={4} wrap="wrap">
            <Button
              leftIcon={<FiZap />}
              colorScheme="blue"
              onClick={handleSyncResources}
              isLoading={isSyncing}
            >
              Sync Resources
            </Button>
            
            {currentIntegration.service_type === 'slack' && getResourcesByType(ResourceType.SLACK_CHANNEL) > 0 && (
              <Button
                leftIcon={<FiCheckSquare />}
                colorScheme="purple"
                onClick={() => navigate(`/dashboard/integrations/${integrationId}/channels`)}
              >
                Select Channels for Analysis
              </Button>
            )}
            
            {needsReconnection && (
              <Button
                leftIcon={<FiLink />}
                colorScheme="red"
                onClick={handleReconnect}
              >
                Reconnect Integration
              </Button>
            )}
          </Flex>
        </Box>
        
        {/* Resource Summary if resources are loaded */}
        {currentResources.length > 0 && (
          <Box mt={6}>
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size="md">Resource Summary</Heading>
              <Button
                size="sm"
                colorScheme="blue"
                variant="outline"
                onClick={() => navigate(`/dashboard/integrations/${integrationId}/resources`)}
              >
                View All
              </Button>
            </Flex>

            <Flex gap={4} wrap="wrap">
              {currentIntegration.service_type === 'slack' && getResourcesByType(ResourceType.SLACK_CHANNEL) > 0 && (
                <Card 
                  p={4} 
                  borderRadius="lg" 
                  bg={cardBg} 
                  borderWidth="1px"
                  borderColor={cardBorder}
                  width={{ base: '100%', sm: '48%', md: '32%' }}
                >
                  <Text fontSize="sm" color="gray.500">Channels</Text>
                  <Text fontSize="3xl" fontWeight="bold">
                    {getResourcesByType(ResourceType.SLACK_CHANNEL)}
                  </Text>
                </Card>
              )}
              
              {currentIntegration.service_type === 'slack' && getResourcesByType(ResourceType.SLACK_USER) > 0 && (
                <Card 
                  p={4} 
                  borderRadius="lg" 
                  bg={cardBg} 
                  borderWidth="1px"
                  borderColor={cardBorder}
                  width={{ base: '100%', sm: '48%', md: '32%' }}
                >
                  <Text fontSize="sm" color="gray.500">Users</Text>
                  <Text fontSize="3xl" fontWeight="bold">
                    {getResourcesByType(ResourceType.SLACK_USER)}
                  </Text>
                </Card>
              )}
              
              <Card 
                p={4} 
                borderRadius="lg" 
                bg={cardBg} 
                borderWidth="1px"
                borderColor={cardBorder}
                width={{ base: '100%', sm: '48%', md: '32%' }}
              >
                <Text fontSize="sm" color="gray.500">Total Resources</Text>
                <Text fontSize="3xl" fontWeight="bold">
                  {getTotalResources()}
                </Text>
              </Card>
            </Flex>
          </Box>
        )}
      </Box>

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