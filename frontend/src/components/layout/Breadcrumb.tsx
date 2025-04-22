import React, { useMemo } from 'react';
import {
  Breadcrumb as ChakraBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Box,
  useColorModeValue,
  HStack,
  Icon,
  Text,
} from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { FiChevronRight, FiHome } from 'react-icons/fi';
import useAuth from '../../context/useAuth';
import useIntegration from '../../context/useIntegration';

/**
 * Breadcrumb component for navigation context
 */
const Breadcrumb = () => {
  const location = useLocation();
  const { teamContext } = useAuth();
  const { integrations } = useIntegration();
  const linkColor = useColorModeValue('blue.600', 'blue.300');
  
  // Parse the current path into breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const paths = location.pathname.split('/').filter(Boolean);
    
    // Special handling for dashboard as the root
    if (paths[0] !== 'dashboard') {
      return [];
    }
    
    const breadcrumbItems = [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: FiHome,
      }
    ];
    
    // Skip the dashboard segment since we've already added it
    let currentPath = '/dashboard';
    
    for (let i = 1; i < paths.length; i++) {
      const segment = paths[i];
      currentPath += `/${segment}`;
      
      // Handle special cases for friendly naming
      switch (segment) {
        case 'integrations':
          breadcrumbItems.push({
            label: 'Workspaces',
            path: currentPath,
          });
          break;
          
        case 'workspaces':
          breadcrumbItems.push({
            label: 'Workspaces',
            path: currentPath,
          });
          break;
          
        case 'analytics':
        case 'analysis':
          breadcrumbItems.push({
            label: 'Analysis',
            path: currentPath,
          });
          break;
          
        case 'teams':
          breadcrumbItems.push({
            label: 'Teams',
            path: currentPath,
          });
          break;
          
        case 'profile':
          breadcrumbItems.push({
            label: 'Profile',
            path: currentPath,
          });
          break;
          
        default:
          // Check if it's an integration ID and replace with integration name
          if ((paths[i-1] === 'integrations' || paths[i-1] === 'workspaces') && integrations) {
            const integration = integrations.find(int => int.id === segment);
            if (integration) {
              breadcrumbItems.push({
                label: integration.name || 'Integration',
                path: currentPath,
              });
              break;
            }
          }
          
          // Check if it's a team ID and replace with team name
          if (paths[i-1] === 'teams' && teamContext.teams) {
            const team = teamContext.teams.find(t => t.id === segment);
            if (team) {
              breadcrumbItems.push({
                label: team.name,
                path: currentPath,
              });
              break;
            }
          }
          
          // Handle other cases like channels
          if (paths[i-1] === 'channels') {
            breadcrumbItems.push({
              label: `Channel: ${segment}`,
              path: currentPath,
            });
            break;
          }
          
          // Handle analysis results
          if (paths[i-1] === 'analysis') {
            breadcrumbItems.push({
              label: 'Results',
              path: currentPath,
            });
            break;
          }
          
          // Default case for regular segments - capitalize first letter
          breadcrumbItems.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1),
            path: currentPath,
          });
      }
    }
    
    return breadcrumbItems;
  }, [location.pathname, integrations, teamContext.teams]);
  
  // Don't show breadcrumbs for the dashboard (root)
  if (location.pathname === '/dashboard') {
    return null;
  }
  
  return (
    <Box pb={2}>
      <ChakraBreadcrumb 
        separator={<Icon as={FiChevronRight} color="gray.500" />}
        spacing="8px"
        fontSize="sm"
        color="gray.600"
      >
        {breadcrumbs.map((crumb, index) => (
          <BreadcrumbItem key={crumb.path} isCurrentPage={index === breadcrumbs.length - 1}>
            <BreadcrumbLink 
              as={Link} 
              to={crumb.path}
              color={index === breadcrumbs.length - 1 ? 'inherit' : linkColor}
              fontWeight={index === breadcrumbs.length - 1 ? 'medium' : 'normal'}
              _hover={{ textDecoration: 'none', color: 'blue.500' }}
            >
              <HStack spacing={1}>
                {crumb.icon && <Icon as={crumb.icon} />}
                <Text>{crumb.label}</Text>
              </HStack>
            </BreadcrumbLink>
          </BreadcrumbItem>
        ))}
      </ChakraBreadcrumb>
    </Box>
  );
};

export default React.memo(Breadcrumb);