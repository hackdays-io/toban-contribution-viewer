import React, { useMemo } from 'react';
import {
  Box,
  Flex,
  CloseButton,
  Icon,
  Text,
  BoxProps,
  useColorModeValue,
  Heading,
  Divider,
  List,
  ListItem,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiSlack,
  FiGithub,
  FiFileText,
  FiBarChart2,
  FiSettings,
  FiExternalLink,
  FiUser,
  FiBox
} from 'react-icons/fi';
import useAuth from '../../context/useAuth';

interface SidebarProps extends BoxProps {
  onClose?: () => void;
}

interface NavItemProps {
  icon: React.ElementType;
  to: string;
  children: React.ReactNode;
  isActive?: boolean;
  badge?: string;
  badgeColorScheme?: string;
}

/**
 * Navigation item component for the sidebar
 */
const NavItem = React.memo(({ icon, to, children, isActive, badge, badgeColorScheme }: NavItemProps) => {
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.700', 'blue.200');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <Box
      as={Link}
      to={to}
      py={2}
      px={3}
      borderRadius="md"
      transition="all 0.2s"
      fontWeight={isActive ? 'semibold' : 'medium'}
      color={isActive ? activeColor : undefined}
      bg={isActive ? activeBg : undefined}
      _hover={{ bg: isActive ? activeBg : hoverBg }}
      role="group"
      width="100%"
      display="block"
    >
      <HStack spacing={3} overflow="hidden">
        <Icon as={icon} w={5} h={5} />
        <Text overflow="hidden" textOverflow="ellipsis">
          {children}
        </Text>
        {badge && (
          <Badge
            ml="auto"
            colorScheme={badgeColorScheme || 'blue'}
            borderRadius="full"
            px={2}
          >
            {badge}
          </Badge>
        )}
      </HStack>
    </Box>
  );
});

/**
 * Sidebar component with navigation links
 */
const Sidebar = ({ onClose, ...rest }: SidebarProps) => {
  const { teamContext } = useAuth();
  const location = useLocation();

  // Get current team name - memoize to prevent recalculation on every render
  const currentTeam = useMemo(() => {
    return teamContext.teams?.find(team => team.id === teamContext.currentTeamId);
  }, [teamContext.teams, teamContext.currentTeamId]);
  
  // Background and text colors based on light/dark mode
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Helper to check if a path is active - memoize to prevent recalculation
  const isActivePath = useMemo(() => {
    return (path: string) => {
      return location.pathname === path || 
             (path !== '/dashboard' && location.pathname.startsWith(path));
    };
  }, [location.pathname]);
  
  return (
    <Box
      bg={bgColor}
      borderRight="1px"
      borderColor={borderColor}
      w={{ base: 'full', md: 64 }}
      pos="fixed"
      h="full"
      {...rest}
    >
      <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
        <Heading fontSize="xl" fontWeight="bold">
          Toban CV
        </Heading>
        <CloseButton display={{ base: 'flex', md: 'none' }} onClick={onClose} />
      </Flex>
      
      {/* Team context indicator */}
      {currentTeam && (
        <Box mx={6} mb={6}>
          <Text fontSize="sm" fontWeight="medium" color="gray.500">
            CURRENT TEAM
          </Text>
          <Text fontSize="md" fontWeight="semibold" noOfLines={1} title={currentTeam.name}>
            {currentTeam.name}
          </Text>
        </Box>
      )}
      
      <Box mx={3}>
        {/* Main Navigation */}
        <List spacing={1}>
          <ListItem>
            <NavItem
              to="/dashboard"
              icon={FiHome}
              isActive={isActivePath('/dashboard')}
            >
              Dashboard
            </NavItem>
          </ListItem>
          
          <ListItem>
            <NavItem
              to="/dashboard/teams"
              icon={FiUsers}
              isActive={isActivePath('/dashboard/teams')}
            >
              Teams
            </NavItem>
          </ListItem>
          
          <Divider my={3} />
          
          {/* Integrations section */}
          <Box py={2} px={3}>
            <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
              Integrations
            </Text>
          </Box>
          
          <ListItem>
            <NavItem
              to="/dashboard/integrations"
              icon={FiBox}
              isActive={isActivePath('/dashboard/integrations')}
            >
              All Integrations
            </NavItem>
          </ListItem>
          
          <ListItem>
            <NavItem
              to="/dashboard/slack/workspaces"
              icon={FiSlack}
              isActive={isActivePath('/dashboard/slack')}
            >
              Slack
            </NavItem>
          </ListItem>
          
          <ListItem>
            <NavItem
              to="/dashboard/github"
              icon={FiGithub}
              isActive={isActivePath('/dashboard/github')}
            >
              GitHub
            </NavItem>
          </ListItem>
          
          <ListItem>
            <NavItem
              to="/dashboard/notion"
              icon={FiFileText}
              isActive={isActivePath('/dashboard/notion')}
            >
              Notion
            </NavItem>
          </ListItem>
          
          <Divider my={3} />
          
          {/* Analytics section */}
          <Box py={2} px={3}>
            <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
              Analysis
            </Text>
          </Box>
          
          <ListItem>
            <NavItem
              to="/dashboard/analytics"
              icon={FiBarChart2}
              isActive={isActivePath('/dashboard/analytics')}
            >
              Analytics
            </NavItem>
          </ListItem>
          
          <Divider my={3} />
          
          {/* Account section */}
          <Box py={2} px={3}>
            <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">
              Account
            </Text>
          </Box>
          
          <ListItem>
            <NavItem
              to="/dashboard/profile"
              icon={FiUser}
              isActive={isActivePath('/dashboard/profile')}
            >
              Profile
            </NavItem>
          </ListItem>
          
          <ListItem>
            <NavItem
              to="/dashboard/settings"
              icon={FiSettings}
              isActive={isActivePath('/dashboard/settings')}
            >
              Settings
            </NavItem>
          </ListItem>
        </List>
      </Box>
      
      {/* Footer with docs link */}
      <Box position="absolute" bottom={0} w="full" p={3}>
        <NavItem to="https://docs.example.com" icon={FiExternalLink}>
          Documentation
        </NavItem>
      </Box>
    </Box>
  );
};

export default React.memo(Sidebar);
