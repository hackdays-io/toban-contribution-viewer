import React from 'react';
import { Box, Heading, Breadcrumb, BreadcrumbItem, BreadcrumbLink } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { WorkspaceList } from '../../components/slack';

/**
 * Page for displaying and managing Slack workspaces.
 */
const WorkspacesPage: React.FC = () => {
  return (
    <Box p={6}>
      <Breadcrumb mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Slack</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      
      <Heading size="xl" mb={8}>
        Slack Integration
      </Heading>
      
      <WorkspaceList />
    </Box>
  );
};

export default WorkspacesPage;