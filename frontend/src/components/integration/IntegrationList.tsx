import React, { useState, useEffect } from 'react'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Card,
  CardBody,
  Badge,
  Spinner,
  Button,
  Select,
  Flex,
  Divider,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { FiPlus, FiSettings, FiRefreshCw, FiExternalLink } from 'react-icons/fi'
import {
  Integration,
  IntegrationType,
  IntegrationStatus,
} from '../../lib/integrationService'
import useIntegration from '../../context/useIntegration'
import useAuth from '../../context/useAuth'

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

interface IntegrationListProps {
  teamId?: string // Optional, will use current team if not provided
}

/**
 * Component to display a list of integrations with filtering capabilities
 */
const IntegrationList: React.FC<IntegrationListProps> = ({ teamId }) => {
  const { teamContext } = useAuth()
  const { integrations, loading, error, fetchIntegrations, selectIntegration } =
    useIntegration()

  const [typeFilter, setTypeFilter] = useState<string>('')
  const [filteredIntegrations, setFilteredIntegrations] = useState<
    Integration[]
  >([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const toast = useToast()
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')

  // Use provided teamId or current team's ID
  const effectiveTeamId = teamId || teamContext?.currentTeamId

  // Load integrations on component mount
  useEffect(() => {
    if (effectiveTeamId) {
      fetchIntegrations(effectiveTeamId)
    }
  }, [effectiveTeamId, fetchIntegrations])

  // Apply filtering when integrations or filter change
  useEffect(() => {
    if (integrations) {
      let filtered = [...integrations]

      // Apply type filter if set
      if (typeFilter) {
        filtered = filtered.filter(
          (integration) => integration.service_type === typeFilter
        )
      }

      setFilteredIntegrations(filtered)
    }
  }, [integrations, typeFilter])

  // Handler for refreshing integrations
  const handleRefresh = async () => {
    if (!effectiveTeamId) return

    setIsRefreshing(true)
    try {
      await fetchIntegrations(effectiveTeamId)
      toast({
        title: 'Integrations refreshed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch {
      toast({
        title: 'Failed to refresh integrations',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handler for selecting an integration
  const handleSelectIntegration = (integrationId: string) => {
    selectIntegration(integrationId)
  }

  // Render loading state
  if (loading && !isRefreshing) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading integrations...</Text>
      </Box>
    )
  }

  // Check if we have any Slack auth from local storage
  const hasLocalSlackAuth = Boolean(localStorage.getItem('slack_auth_code'))

  // Render error state with potential local Slack integration
  if (error) {
    return (
      <Box>
        <Box textAlign="center" py={6}>
          <Text
            color={
              error.message.includes('local Slack auth')
                ? 'orange.500'
                : 'red.500'
            }
          >
            {error.message}
          </Text>
          <Button mt={4} onClick={handleRefresh} leftIcon={<FiRefreshCw />}>
            Try Again
          </Button>
        </Box>

        {hasLocalSlackAuth && (
          <Box mt={8}>
            <Heading size="md" mb={4}>
              Locally Stored Integrations
            </Heading>
            <Text mb={4}>
              You have successfully authenticated with Slack, but there was an
              error connecting to the backend. Your authorization is saved
              locally.
            </Text>

            <Card
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={cardBg}
              borderColor={cardBorder}
              p={4}
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
                  authenticated
                </Badge>
              </Flex>

              <Text fontSize="sm" color="gray.600" mb={4}>
                Successfully authenticated with Slack. Authentication data is
                stored locally.
              </Text>
            </Card>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box w="100%">
      {/* Header with filters and actions */}
      <Flex
        justifyContent="space-between"
        alignItems="center"
        mb={6}
        flexDirection={{ base: 'column', md: 'row' }}
        gap={4}
      >
        <Heading size="lg" as="h2">
          Integrations
        </Heading>

        <HStack spacing={4} width={{ base: '100%', md: 'auto' }}>
          <Select
            placeholder="All types"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            width={{ base: '100%', md: '200px' }}
          >
            <option value={IntegrationType.SLACK}>Slack</option>
            <option value={IntegrationType.GITHUB}>GitHub</option>
            <option value={IntegrationType.NOTION}>Notion</option>
            <option value={IntegrationType.DISCORD}>Discord</option>
          </Select>

          <Button
            leftIcon={<FiRefreshCw />}
            onClick={handleRefresh}
            isLoading={isRefreshing}
            variant="outline"
          >
            Refresh
          </Button>

          <Button
            as={Link}
            to="/dashboard/integrations/connect"
            colorScheme="blue"
            leftIcon={<FiPlus />}
          >
            Connect
          </Button>
        </HStack>
      </Flex>

      {/* Empty state */}
      {filteredIntegrations.length === 0 && (
        <Box>
          {hasLocalSlackAuth ? (
            <Box mt={4}>
              <Heading size="md" mb={4}>
                Locally Stored Integrations
              </Heading>
              <Text mb={4}>
                You have successfully authenticated with Slack. Your
                authorization data is saved locally.
              </Text>

              <Card
                borderWidth="1px"
                borderRadius="lg"
                overflow="hidden"
                bg={cardBg}
                borderColor={cardBorder}
                p={4}
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
                    authenticated
                  </Badge>
                </Flex>

                <Text fontSize="sm" color="gray.600" mb={4}>
                  Client ID:{' '}
                  {localStorage.getItem('slack_client_id')?.substring(0, 8)}...
                </Text>

                <Text fontSize="sm" color="green.600" mb={4}>
                  Authorization code is stored locally. This integration is
                  ready to use.
                </Text>
              </Card>

              <Box mt={8} textAlign="center">
                <Divider mb={6} />
                <Button
                  as={Link}
                  to="/dashboard/integrations/connect"
                  colorScheme="blue"
                  leftIcon={<FiPlus />}
                >
                  Connect another integration
                </Button>
              </Box>
            </Box>
          ) : (
            <Box
              textAlign="center"
              py={12}
              px={6}
              borderWidth="1px"
              borderRadius="lg"
              borderStyle="dashed"
              borderColor={cardBorder}
            >
              <Text fontSize="lg" mb={4}>
                No integrations found.
              </Text>
              <Button
                as={Link}
                to="/dashboard/integrations/connect"
                colorScheme="blue"
                leftIcon={<FiPlus />}
              >
                Connect your first integration
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Integration cards grid */}
      {filteredIntegrations.length > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {filteredIntegrations.map((integration) => (
            <Card
              key={integration.id}
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={cardBg}
              borderColor={cardBorder}
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
            >
              <CardBody>
                <Flex alignItems="center" mb={4}>
                  <Box fontSize="2xl" mr={3}>
                    {getIntegrationTypeIcon(
                      integration.service_type as IntegrationType
                    )}
                  </Box>
                  <VStack align="start" spacing={0} flex={1}>
                    <Heading size="md" noOfLines={1}>
                      {integration.name}
                    </Heading>
                    <Text color="gray.500" fontSize="sm">
                      {integration.service_type}
                    </Text>
                  </VStack>
                  <Badge
                    colorScheme={getStatusColor(
                      integration.status as IntegrationStatus
                    )}
                    variant="subtle"
                    px={2}
                    py={1}
                    borderRadius="full"
                  >
                    {integration.status}
                  </Badge>
                </Flex>

                {integration.description && (
                  <Text fontSize="sm" color="gray.600" mb={4} noOfLines={2}>
                    {integration.description}
                  </Text>
                )}

                <Divider my={3} />

                <Flex justify="space-between" mt={3}>
                  <Button
                    as={Link}
                    to={`/dashboard/integrations/${integration.id}`}
                    size="sm"
                    variant="ghost"
                    leftIcon={<FiExternalLink />}
                    onClick={() => handleSelectIntegration(integration.id)}
                  >
                    View
                  </Button>

                  <Button
                    as={Link}
                    to={`/dashboard/integrations/${integration.id}/settings`}
                    size="sm"
                    variant="ghost"
                    leftIcon={<FiSettings />}
                    onClick={() => handleSelectIntegration(integration.id)}
                  >
                    Settings
                  </Button>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}

export default IntegrationList
