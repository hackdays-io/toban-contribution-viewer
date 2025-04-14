import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Button,
  Flex,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FiSettings, FiUsers } from 'react-icons/fi';
import useAuth from '../../context/useAuth';
import { TeamSwitcher } from './index';
import { getRoleBadgeColorScheme, getRoleDisplayName } from '../../utils/teamUtils';

const TeamContext: React.FC = () => {
  const { teamContext, loading } = useAuth();
  
  // Memoize derived values to prevent recalculation on every render
  const currentTeam = useMemo(() => {
    return teamContext.teams?.find(team => team.id === teamContext.currentTeamId);
  }, [teamContext.teams, teamContext.currentTeamId]);
  
  const cardBg = useColorModeValue('white', 'gray.800');
  
  if (loading) {
    return null;
  }
  
  if (!currentTeam) {
    return (
      <Card variant="outline" bg={cardBg}>
        <CardHeader>
          <Heading size="md">Team Context</Heading>
        </CardHeader>
        <CardBody>
          <Text>No team selected. Please select a team to continue.</Text>
          <Box mt={4}>
            <TeamSwitcher />
          </Box>
        </CardBody>
      </Card>
    );
  }
  
  // Using utility functions for badges and role display names
  
  return (
    <Card variant="outline" bg={cardBg}>
      <CardHeader>
        <HStack justify="space-between">
          <Heading size="md">Team Context</Heading>
          <TeamSwitcher variant="compact" />
        </HStack>
      </CardHeader>
      <Divider />
      <CardBody>
        <VStack align="start" spacing={4}>
          <Box>
            <Text fontWeight="bold" fontSize="sm" color="gray.500">CURRENT TEAM</Text>
            <HStack mt={1}>
              <Heading size="md">{currentTeam.name}</Heading>
              <Badge colorScheme={getRoleBadgeColorScheme(teamContext.currentTeamRole)}>
                {getRoleDisplayName(teamContext.currentTeamRole)}
              </Badge>
            </HStack>
          </Box>
          
          {teamContext.teams?.length > 1 && (
            <Box width="100%">
              <Text fontWeight="bold" fontSize="sm" color="gray.500" mb={2}>SWITCH TEAM</Text>
              <TeamSwitcher />
            </Box>
          )}
          
          <Divider />
          
          <Flex width="100%" justifyContent="space-between">
            <Button
              as={Link}
              to={`/dashboard/teams/${currentTeam.id}`}
              leftIcon={<FiSettings />}
              size="sm"
              variant="outline"
            >
              Team Settings
            </Button>
            
            <Button
              as={Link}
              to={`/dashboard/teams/${currentTeam.id}/members`}
              leftIcon={<FiUsers />}
              size="sm"
              variant="outline"
            >
              Team Members
            </Button>
          </Flex>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default React.memo(TeamContext);
