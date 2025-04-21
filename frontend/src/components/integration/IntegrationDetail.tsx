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
        <HStack spacing={2}>
          <Badge
            colorScheme={
              currentIntegration.status === IntegrationStatus.ACTIVE
                ? 'green'
                : currentIntegration.status === IntegrationStatus.DISCONNECTED
                  ? 'yellow'
                  : 'red'
            }
            variant="solid"
            px={2}
            py={1}
            borderRadius="full"
          >
            {currentIntegration.status}
          </Badge>
          
          <Text color="gray.500" fontSize="md">
            Last updated: {new Date(currentIntegration.updated_at || currentIntegration.created_at).toLocaleString()}
          </Text>
        </HStack>

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

      {/* Main content area */}
      <Box>
        {/* Resource summary statistics */}
        {currentResources.length > 0 && (
          <Box mb={8}>
            <Flex gap={4} wrap="wrap">
              {currentIntegration.service_type === 'slack' && getResourcesByType(ResourceType.SLACK_CHANNEL) > 0 && (
                <Card 
                  p={4} 
                  borderRadius="lg" 
                  bg={cardBg} 
                  borderWidth="1px"
                  borderColor={cardBorder}
                  width={{ base: '100%', sm: '48%', md: '30%' }}
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
                  width={{ base: '100%', sm: '48%', md: '30%' }}
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
                width={{ base: '100%', sm: '48%', md: '30%' }}
              >
                <Text fontSize="sm" color="gray.500">Total Resources</Text>
                <Text fontSize="3xl" fontWeight="bold">
                  {getTotalResources()}
                </Text>
              </Card>
            </Flex>
          </Box>
        )}
        
        {/* Main action cards */}
        <Heading size="md" mb={4}>Integration Management</Heading>
        
        <Flex direction={{ base: 'column', md: 'row' }} gap={6} wrap="wrap">
          {/* Channel Selection Card - only for Slack */}
          {currentIntegration.service_type === 'slack' && (
            <Card
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={cardBg}
              borderColor={cardBorder}
              flex="1"
              minW={{ base: "100%", md: "48%" }}
              _hover={{ shadow: 'md', borderColor: 'purple.300' }}
              cursor="pointer"
              onClick={() => navigate(`/dashboard/integrations/${integrationId}/channels`)}
            >
              <CardHeader pb={0}>
                <Flex align="center" gap={2}>
                  <FiBarChart size="20px" color="var(--chakra-colors-purple-500)" />
                  <Heading size="md">Channel Analysis</Heading>
                </Flex>
              </CardHeader>
              <CardBody>
                <Text fontSize="sm" color="gray.500" mb={3}>
                  Select and analyze channels to understand team contribution patterns
                </Text>
                <Button 
                  size="md" 
                  colorScheme="purple" 
                  width="full"
                  leftIcon={<FiBarChart />}
                >
                  Manage Channel Analysis
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
            minW={{ base: "100%", md: "48%" }}
            _hover={{ shadow: 'md', borderColor: 'gray.400' }}
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
                Configure integration properties, authentication, and manage connection
              </Text>
              <Button 
                size="md" 
                colorScheme="gray" 
                width="full"
                leftIcon={<FiSettings />}
              >
                Manage Settings
              </Button>
            </CardBody>
          </Card>
        </Flex>
        
        {/* Maintenance section */}
        <Box mt={8}>
          <Heading size="md" mb={4}>Maintenance</Heading>
          <Flex 
            gap={4} 
            wrap="wrap" 
            p={4} 
            borderWidth="1px" 
            borderRadius="lg" 
            borderStyle="dashed" 
            borderColor={cardBorder}
          >
            <Button
              leftIcon={<FiZap />}
              colorScheme="blue"
              onClick={handleSyncResources}
              isLoading={isSyncing}
              flex="1"
            >
              Sync Resources
            </Button>
            
            {needsReconnection && (
              <Button
                leftIcon={<FiLink />}
                colorScheme="red"
                onClick={handleReconnect}
                flex="1"
              >
                Reconnect Integration
              </Button>
            )}
          </Flex>
        </Box>
        
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