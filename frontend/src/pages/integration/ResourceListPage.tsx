import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, HStack, Icon } from '@chakra-ui/react'
import { FiArrowLeft } from 'react-icons/fi'
import { ResourceList } from '../../components/integration'
import { PageTitle } from '../../components/layout'
import useIntegration from '../../context/useIntegration'

/**
 * Page component for displaying and managing resources for a specific integration
 */
const ResourceListPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const { currentIntegration, selectIntegration } = useIntegration()
  const navigate = useNavigate()

  useEffect(() => {
    if (integrationId) {
      selectIntegration(integrationId)
    }
  }, [integrationId, selectIntegration])

  const handleBack = () => {
    navigate(`/integrations/${integrationId}`)
  }

  return (
    <Box>
      <HStack mb={4}>
        <Button
          leftIcon={<Icon as={FiArrowLeft} />}
          variant="ghost"
          onClick={handleBack}
        >
          Back to Integration Details
        </Button>
      </HStack>

      <PageTitle
        title={`${currentIntegration?.name || 'Integration'} Resources`}
        description="View and manage integration resources"
      />

      <Box mt={8}>
        {integrationId && <ResourceList integrationId={integrationId} />}
      </Box>
    </Box>
  )
}

export default ResourceListPage
