import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  HStack,
  Icon,
  Heading,
  Spinner,
  Flex,
  Text,
  useToast,
} from '@chakra-ui/react'
import { FiArrowLeft, FiZap, FiBarChart } from 'react-icons/fi'
import { PageTitle } from '../../components/layout'
import useIntegration from '../../context/useIntegration'
import { ResourceList } from '../../components/integration'
import { ResourceType } from '../../lib/integrationService'

/**
 * Page component for displaying all resources of a specific integration
 */
const IntegrationResourcesPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const {
    currentIntegration,
    currentResources,
    loading,
    loadingResources,
    error,
    resourceError,
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

  // Handler for syncing resources
  const handleSyncResources = async () => {
    if (!integrationId) return

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
    }
  }

  const handleBack = () => {
    navigate(`/dashboard/integrations/${integrationId}`)
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

  // Get counts
  const channelCount = currentResources.filter(
    (r) => r.resource_type === ResourceType.SLACK_CHANNEL
  ).length
  const userCount = currentResources.filter(
    (r) => r.resource_type === ResourceType.SLACK_USER
  ).length

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
        title={`${currentIntegration.name} - Resources`}
        description="View and manage integration resources"
      />

      <Box mt={8}>
        <Flex mb={6} justify="space-between" align="center">
          <HStack>
            <Heading size="md">Resources</Heading>
            <Text color="gray.500">
              {currentResources.length > 0 ? `(${currentResources.length})` : ''}
            </Text>
          </HStack>

          <HStack spacing={4}>
            {currentIntegration.service_type === 'slack' && channelCount > 0 && (
              <Button
                leftIcon={<FiBarChart />}
                colorScheme="purple"
                onClick={() => 
                  navigate(`/dashboard/integrations/${integrationId}/channels`)
                }
              >
                Manage Channel Analysis
              </Button>
            )}
            <Button
              leftIcon={<FiZap />}
              colorScheme="blue"
              onClick={handleSyncResources}
              isLoading={loadingResources}
            >
              Sync Resources
            </Button>
          </HStack>
        </Flex>

        {/* Resource Summary */}
        {currentResources.length > 0 && (
          <HStack spacing={8} mb={6}>
            {channelCount > 0 && (
              <Box borderWidth="1px" borderRadius="md" p={4} minW="150px">
                <Text fontSize="sm" color="gray.500">
                  Channels
                </Text>
                <Text fontSize="2xl" fontWeight="bold">
                  {channelCount}
                </Text>
              </Box>
            )}
            {userCount > 0 && (
              <Box borderWidth="1px" borderRadius="md" p={4} minW="150px">
                <Text fontSize="sm" color="gray.500">
                  Users
                </Text>
                <Text fontSize="2xl" fontWeight="bold">
                  {userCount}
                </Text>
              </Box>
            )}
            <Box borderWidth="1px" borderRadius="md" p={4} minW="150px">
              <Text fontSize="sm" color="gray.500">
                Total Resources
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {currentResources.length}
              </Text>
            </Box>
          </HStack>
        )}

        {loadingResources ? (
          <Flex justify="center" py={8}>
            <Spinner size="xl" />
          </Flex>
        ) : resourceError ? (
          <Text color="red.500" mb={4}>
            {resourceError.message}
          </Text>
        ) : currentResources.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text mb={4}>No resources found.</Text>
            <Button
              colorScheme="blue"
              onClick={handleSyncResources}
            >
              Sync Resources
            </Button>
          </Box>
        ) : (
          <ResourceList
            resources={currentResources}
            integrationId={integrationId || ''}
          />
        )}
      </Box>
    </Box>
  )
}

export default IntegrationResourcesPage