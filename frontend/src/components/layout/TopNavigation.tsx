import React, { useMemo } from 'react'
import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
  useColorModeValue,
  Badge,
  Tooltip,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Button,
  Container,
} from '@chakra-ui/react'
import { Link, useLocation } from 'react-router-dom'
import {
  FiHome,
  FiUsers,
  FiBarChart2,
  FiDatabase,
  FiChevronDown,
  FiPlus,
  FiHelpCircle,
} from 'react-icons/fi'
import useAuth from '../../context/useAuth'

interface TabItemProps {
  icon: React.ElementType
  to: string
  children: React.ReactNode
  isActive?: boolean
  badge?: string
  badgeColorScheme?: string
}

/**
 * Tab navigation item for the top navigation bar
 */
const TabItem = React.memo(
  ({ icon, to, children, isActive, badge, badgeColorScheme }: TabItemProps) => {
    const activeBorderColor = useColorModeValue('blue.500', 'blue.400')
    const hoverBg = useColorModeValue('gray.100', 'gray.700')

    return (
      <Box
        as={Link}
        to={to}
        px={4}
        py={4}
        transition="all 0.2s"
        fontWeight="medium"
        color={isActive ? 'blue.500' : undefined}
        borderBottom={
          isActive ? `2px solid ${activeBorderColor}` : '2px solid transparent'
        }
        _hover={{ bg: isActive ? 'transparent' : hoverBg }}
        role="group"
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="full"
        width="140px" // Set consistent width for all menu items
      >
        <HStack spacing={2} justifyContent="center" width="full">
          <Icon as={icon} w={5} h={5} flexShrink={0} />
          <Text>{children}</Text>
          {badge && (
            <Badge
              colorScheme={badgeColorScheme || 'green'}
              borderRadius="full"
              px={2}
              fontSize="xs"
              ml={1}
            >
              {badge}
            </Badge>
          )}
        </HStack>
      </Box>
    )
  }
)

/**
 * Dropdown menu component for workspace selection
 */
const WorkspaceMenu = () => {
  const { teamContext, switchTeam } = useAuth()
  const menuBg = useColorModeValue('white', 'gray.800')

  // Get current team name
  const currentTeam = useMemo(() => {
    return teamContext.teams?.find(
      (team) => team.id === teamContext.currentTeamId
    )
  }, [teamContext.teams, teamContext.currentTeamId])

  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="ghost"
        rightIcon={<FiChevronDown />}
        py={2}
        fontWeight="medium"
      >
        <Text>{currentTeam?.name || 'My Personal Team'}</Text>
      </MenuButton>
      <MenuList bg={menuBg} zIndex={10}>
        {teamContext.teams?.map((team) => (
          <MenuItem
            key={team.id}
            onClick={() => switchTeam(team.id)}
            fontWeight={
              team.id === teamContext.currentTeamId ? 'bold' : 'normal'
            }
          >
            {team.name}
          </MenuItem>
        ))}
        <MenuDivider />
        <MenuItem as={Link} to="/dashboard/teams">
          Manage Teams
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

/**
 * Top navigation component with tabs
 */
const TopNavigation = () => {
  const location = useLocation()
  const bgColor = useColorModeValue('gray.100', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  // Helper to check if a path is active
  const isActivePath = useMemo(() => {
    return (path: string) => {
      // For dashboard, only match exactly
      if (path === '/dashboard') {
        return location.pathname === '/dashboard'
      }
      // For other paths, check if the current path starts with the given path
      return location.pathname.startsWith(path)
    }
  }, [location.pathname])

  return (
    <Box
      bg={bgColor}
      boxShadow="sm"
      position="sticky"
      top={0}
      zIndex={10}
      borderBottom="1px"
      borderColor={borderColor}
      py={{ base: 1, md: 0 }}
    >
      <Container maxW="container.xl">
        <Flex alignItems="center" justifyContent="space-between">
          {/* Left side with workspace selector */}
          <Flex align="center" h={14}>
            <WorkspaceMenu />
          </Flex>

          {/* Center with main navigation tabs */}
          <Flex
            as="nav"
            display={{ base: 'none', md: 'flex' }}
            justifyContent="center"
            h={14}
          >
            <TabItem
              icon={FiHome}
              to="/dashboard"
              isActive={
                isActivePath('/dashboard') &&
                !location.pathname.includes('/dashboard/')
              }
            >
              Dashboard
            </TabItem>
            <TabItem
              icon={FiDatabase}
              to="/dashboard/workspaces"
              isActive={
                isActivePath('/dashboard/workspaces') ||
                isActivePath('/dashboard/integrations')
              }
            >
              Workspaces
            </TabItem>
            <TabItem
              icon={FiBarChart2}
              to="/dashboard/analysis"
              isActive={
                isActivePath('/dashboard/analysis') ||
                isActivePath('/dashboard/analytics')
              }
              badge="NEW"
            >
              Analysis
            </TabItem>
            <TabItem
              icon={FiUsers}
              to="/dashboard/teams"
              isActive={isActivePath('/dashboard/teams')}
            >
              Team
            </TabItem>
          </Flex>

          {/* Right side with action buttons */}
          <HStack spacing={3}>
            <Tooltip label="Create New">
              <IconButton
                aria-label="Create New"
                icon={<FiPlus />}
                borderRadius="full"
                as={Link}
                to="/dashboard/analysis/new"
              />
            </Tooltip>
            <Tooltip label="Help">
              <IconButton
                aria-label="Help"
                icon={<FiHelpCircle />}
                borderRadius="full"
                variant="ghost"
              />
            </Tooltip>
          </HStack>
        </Flex>

        {/* Mobile navigation (hidden on desktop) */}
        <Box display={{ base: 'block', md: 'none' }} pb={2} overflow="hidden">
          <Flex
            justifyContent="space-between"
            overflowX="auto"
            py={1}
            width="full"
          >
            <TabItem
              icon={FiHome}
              to="/dashboard"
              isActive={
                isActivePath('/dashboard') &&
                !location.pathname.includes('/dashboard/')
              }
            >
              Dashboard
            </TabItem>
            <TabItem
              icon={FiDatabase}
              to="/dashboard/workspaces"
              isActive={
                isActivePath('/dashboard/workspaces') ||
                isActivePath('/dashboard/integrations')
              }
            >
              Workspaces
            </TabItem>
            <TabItem
              icon={FiBarChart2}
              to="/dashboard/analysis"
              isActive={
                isActivePath('/dashboard/analysis') ||
                isActivePath('/dashboard/analytics')
              }
            >
              Analysis
            </TabItem>
            <TabItem
              icon={FiUsers}
              to="/dashboard/teams"
              isActive={isActivePath('/dashboard/teams')}
            >
              Team
            </TabItem>
          </Flex>
        </Box>
      </Container>
    </Box>
  )
}

export default React.memo(TopNavigation)
