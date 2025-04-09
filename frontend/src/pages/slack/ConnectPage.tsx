import React from 'react';
import { Box, Heading, Breadcrumb, BreadcrumbItem, BreadcrumbLink } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { ConnectWorkspace } from '../../components/slack';

/**
 * Page for connecting a new Slack workspace.
 */
const ConnectPage: React.FC = () => {
  return (
    <Box p={6}>
      <Breadcrumb mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard/slack/workspaces">
            Slack
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Connect</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      
      <Heading size="xl" mb={8}>
        Connect Slack Workspace
      </Heading>
      
      <ConnectWorkspace />
    </Box>
  );
};

export default ConnectPage;