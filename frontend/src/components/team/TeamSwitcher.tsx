import React, { useMemo, useCallback } from 'react'
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Text,
  Box,
  Flex,
  Divider,
  Badge,
  MenuGroup,
  Avatar,
  HStack,
  useToast,
} from '@chakra-ui/react'
import { FiChevronDown, FiUsers, FiPlus } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import useAuth from '../../context/useAuth'
// import type { TeamRole } from '../../context/AuthContext'; - unused for now
import { getRoleBadgeColorScheme } from '../../utils/teamUtils'

interface TeamSwitcherProps {
  variant?: 'default' | 'compact'
}

const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ variant = 'default' }) => {
  const { teamContext, switchTeam, loading } = useAuth()
  const toast = useToast()

  // Get the current team from the context - memoized to prevent recalculation
  const currentTeam = useMemo(() => {
    return teamContext.teams.find(
      (team) => team.id === teamContext.currentTeamId
    )
  }, [teamContext.teams, teamContext.currentTeamId])

  // Memoize the event handler to prevent recreation on each render
  const handleTeamSwitch = useCallback(
    async (teamId: string) => {
      try {
        await switchTeam(teamId)
        toast({
          title: 'Team switched',
          status: 'success',
          duration: 2000,
          isClosable: true,
        })
      } catch (error) {
        toast({
          title: 'Failed to switch team',
          description:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    },
    [switchTeam, toast]
  )

  // Using the utility function for badge colors

  if (loading) {
    return null // Don't render while loading
  }

  if (variant === 'compact') {
    return (
      <Menu>
        <MenuButton
          as={Button}
          size="sm"
          variant="ghost"
          rightIcon={<FiChevronDown />}
          aria-label="Switch Team"
        >
          {currentTeam?.name || 'Personal'}
        </MenuButton>
        <MenuList>
          {teamContext.teams.map((team) => (
            <MenuItem
              key={team.id}
              onClick={() => handleTeamSwitch(team.id)}
              fontWeight={
                team.id === teamContext.currentTeamId ? 'bold' : 'normal'
              }
            >
              {team.name}
            </MenuItem>
          ))}
          <Divider my={2} />
          <MenuItem as={Link} to="/dashboard/teams" icon={<FiUsers />}>
            Manage Teams
          </MenuItem>
        </MenuList>
      </Menu>
    )
  }

  return (
    <Menu>
      <MenuButton
        as={Button}
        rightIcon={<FiChevronDown />}
        variant="outline"
        isLoading={loading}
      >
        <HStack>
          {currentTeam && <Avatar size="xs" name={currentTeam.name} />}
          <Text>{currentTeam?.name || 'Personal'}</Text>
        </HStack>
      </MenuButton>
      <MenuList minW="240px">
        <MenuGroup title="Your Teams">
          {teamContext.teams.map((team) => (
            <MenuItem key={team.id} onClick={() => handleTeamSwitch(team.id)}>
              <Flex alignItems="center" width="100%">
                <HStack flex="1">
                  <Avatar size="xs" name={team.name} />
                  <Box>
                    <Text
                      fontWeight={
                        team.id === teamContext.currentTeamId
                          ? 'bold'
                          : 'normal'
                      }
                    >
                      {team.name}
                    </Text>
                  </Box>
                </HStack>
                <Badge ml={2} colorScheme={getRoleBadgeColorScheme(team.role)}>
                  {team.role}
                </Badge>
              </Flex>
            </MenuItem>
          ))}
        </MenuGroup>
        <Divider my={2} />
        <MenuItem as={Link} to="/dashboard/teams" icon={<FiUsers />}>
          Manage Teams
        </MenuItem>
        <MenuItem as={Link} to="/dashboard/teams" icon={<FiPlus />}>
          Create Team
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

export default React.memo(TeamSwitcher)
