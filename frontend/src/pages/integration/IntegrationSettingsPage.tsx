import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  HStack,
  Icon,
  VStack,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  Flex,
  Spinner,
  useColorModeValue,
  Badge,
  Divider,
  useToast,
} from '@chakra-ui/react'
import { FiArrowLeft, FiTrash2, FiLink } from 'react-icons/fi'
import { PageTitle } from '../../components/layout'
import useIntegration from '../../context/useIntegration'
import { IntegrationStatus } from '../../lib/integrationService'
import { ReconnectIntegration } from '../../components/integration'

/**
 * Page component for managing settings of a specific integration
 */
const IntegrationSettingsPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')
  const [isReconnectModalOpen, setIsReconnectModalOpen] = useState(false)

  const {
    currentIntegration,
    loading,
    error,
    updateIntegration,
    selectIntegration,
  } = useIntegration()

  // Initialize the integration data
  useEffect(() => {
    if (integrationId) {
      selectIntegration(integrationId)
    }
  }, [integrationId, selectIntegration])

  const handleBack = () => {
    navigate(`/dashboard/integrations/${integrationId}`)
  }

  // Determine if the integration needs reconnection
  const needsReconnection =
    currentIntegration &&
    (currentIntegration.status === IntegrationStatus.EXPIRED ||
      currentIntegration.status === IntegrationStatus.REVOKED ||
      (currentIntegration.status === IntegrationStatus.ERROR &&
        currentIntegration.service_type === 'slack'))

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

  // Function to handle reconnection request
  const handleReconnect = () => {
    if (!currentIntegration || !integrationId) return

    // Store integration details in session storage for reconnection flow
    sessionStorage.setItem('slack_integration_id', integrationId)
    sessionStorage.setItem('slack_team_id', currentIntegration.owner_team.id)

    // Open reconnect modal
    setIsReconnectModalOpen(true)
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
        title={`${currentIntegration.name} - Settings`}
        description="Configure and manage integration settings"
      />

      <Box mt={8}>
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
              <VStack align="stretch" spacing={4}>
                <Flex justify="space-between" align="center">
                  <Text fontWeight="bold">Status</Text>
                  <Badge
                    colorScheme={
                      currentIntegration.status === IntegrationStatus.ACTIVE
                        ? 'green'
                        : currentIntegration.status === IntegrationStatus.DISCONNECTED
                          ? 'yellow'
                          : 'red'
                    }
                    py={1}
                    px={2}
                    borderRadius="full"
                  >
                    {currentIntegration.status}
                  </Badge>
                </Flex>

                <Flex justify="space-between" align="center">
                  <Text fontWeight="bold">Service Type</Text>
                  <Text>{currentIntegration.service_type}</Text>
                </Flex>

                <Flex justify="space-between" align="center">
                  <Text fontWeight="bold">Team</Text>
                  <Text>{currentIntegration.owner_team.name}</Text>
                </Flex>

                <Flex justify="space-between" align="center">
                  <Text fontWeight="bold">Created At</Text>
                  <Text>{new Date(currentIntegration.created_at).toLocaleDateString()}</Text>
                </Flex>

                {currentIntegration.last_used_at && (
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="bold">Last Used</Text>
                    <Text>{new Date(currentIntegration.last_used_at).toLocaleDateString()}</Text>
                  </Flex>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Reconnect card for expired/revoked tokens */}
          {needsReconnection && (
            <Card
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={cardBg}
              borderColor="orange.200"
              _dark={{ borderColor: "orange.700" }}
            >
              <CardHeader bg="orange.50" _dark={{ bg: "orange.900" }}>
                <Heading size="md" color="orange.500">Reconnection Required</Heading>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Text>
                    This integration's authentication has {currentIntegration.status === IntegrationStatus.EXPIRED
                      ? 'expired'
                      : currentIntegration.status === IntegrationStatus.REVOKED
                        ? 'been revoked'
                        : 'an error'}.
                    You need to reconnect to continue accessing data.
                  </Text>
                  <Box>
                    <Button
                      colorScheme="blue"
                      leftIcon={<FiLink />}
                      onClick={handleReconnect}
                    >
                      Reconnect
                    </Button>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Danger zone card */}
          <Card
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg={cardBg}
            borderColor="red.200"
            _dark={{ borderColor: "red.700" }}
          >
            <CardHeader bg="red.50" _dark={{ bg: "red.900" }}>
              <Heading size="md" color="red.500">Danger Zone</Heading>
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
                  <Button colorScheme="red" leftIcon={<FiTrash2 />}>
                    Delete Integration
                  </Button>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
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

export default IntegrationSettingsPage