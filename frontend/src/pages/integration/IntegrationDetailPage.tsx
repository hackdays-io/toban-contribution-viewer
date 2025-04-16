import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, HStack, Icon } from '@chakra-ui/react'
import { FiArrowLeft } from 'react-icons/fi'
import { IntegrationDetail } from '../../components/integration'
import { PageTitle } from '../../components/layout'
import useIntegration from '../../context/useIntegration'

/**
 * Page component for displaying detailed information about a specific integration
 */
const IntegrationDetailPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>()
  const { currentIntegration, selectIntegration } = useIntegration()
  const navigate = useNavigate()

  useEffect(() => {
    if (integrationId) {
      selectIntegration(integrationId)
    }
  }, [integrationId, selectIntegration])

  const handleBack = () => {
    navigate(-1)
  }

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

export default IntegrationDetailPage
