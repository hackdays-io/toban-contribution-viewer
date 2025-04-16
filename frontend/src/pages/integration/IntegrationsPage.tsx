import React from 'react'
import { Box } from '@chakra-ui/react'
import { IntegrationList } from '../../components/integration'
import { PageTitle } from '../../components/layout'
import useAuth from '../../context/useAuth'

/**
 * Page component for displaying and managing all integrations
 */
const IntegrationsPage: React.FC = () => {
  const { teamContext } = useAuth()

  return (
    <Box>
      <PageTitle
        title="Integrations"
        description="Manage all your team's integrations"
      />

      <Box mt={4}>
        <IntegrationList teamId={teamContext?.currentTeamId} />
      </Box>
    </Box>
  )
}

export default IntegrationsPage
