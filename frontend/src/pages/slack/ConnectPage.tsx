import React from 'react'
import {
  Box,
  Heading,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
} from '@chakra-ui/react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectWorkspace } from '../../components/slack'

/**
 * Page for connecting a new Slack workspace.
 */
const ConnectPage: React.FC = () => {
  const location = useLocation()
  const fromIntegrations = location.search.includes('from=integrations')
  
  return (
    <Box p={6}>
      <Breadcrumb mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {fromIntegrations ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} to="/dashboard/integrations">
                Integrations
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} to="/dashboard/integrations/connect">
                Connect
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/dashboard/slack/workspaces">
              Slack
            </BreadcrumbLink>
          </BreadcrumbItem>
        )}
        
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Slack</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Heading size="xl" mb={8}>
        Connect Slack Workspace
      </Heading>

      <ConnectWorkspace redirectTo={fromIntegrations ? '/dashboard/integrations' : '/dashboard/slack/workspaces'} />
    </Box>
  )
}

export default ConnectPage