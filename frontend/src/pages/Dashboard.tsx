import React from 'react'
import {
  Box,
  Button,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Icon,
  Card,
  CardBody,
  HStack,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { FiSlack, FiGithub, FiUsers, FiBarChart2 } from 'react-icons/fi'
import { TeamContext } from '../components/team'
import useAuth from '../context/useAuth'

/**
 * Dashboard home page with overview and quick access to key features
 */
const Dashboard: React.FC = () => {
  const { teamContext } = useAuth()
  const cardBg = useColorModeValue('white', 'gray.800')

  // Get current team name
  const currentTeam = teamContext.teams?.find(
    (team) => team.id === teamContext.currentTeamId
  )

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" mb={2}>
          Welcome to your Dashboard
        </Heading>
        {currentTeam && (
          <Text color="gray.600">
            You're currently viewing the {currentTeam.name} team workspace.
          </Text>
        )}
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 4 }} spacing={6} mb={6}>
        <Stat bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <StatLabel>Team Members</StatLabel>
          <StatNumber>7</StatNumber>
          <StatHelpText>Active contributors</StatHelpText>
        </Stat>

        <Stat bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <StatLabel>Integrations</StatLabel>
          <StatNumber>3</StatNumber>
          <StatHelpText>Connected services</StatHelpText>
        </Stat>

        <Stat bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <StatLabel>Messages</StatLabel>
          <StatNumber>1,204</StatNumber>
          <StatHelpText>Last 30 days</StatHelpText>
        </Stat>

        <Stat bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <StatLabel>PRs & Issues</StatLabel>
          <StatNumber>32</StatNumber>
          <StatHelpText>Open items</StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Team Context Card */}
      <Box mb={8} bg={cardBg} p={6} borderRadius="md" boxShadow="sm">
        <Heading size="md" mb={4}>Team Context</Heading>
        <TeamContext />
      </Box>

      {/* Quick access cards */}
      <Heading size="md" mb={4}>
        Quick Access
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
        <Card variant="outline" bg={cardBg}>
          <CardBody>
            <HStack>
              <Icon as={FiSlack} color="purple.500" boxSize={6} />
              <Box>
                <Heading size="sm">Slack Workspaces</Heading>
                <Text fontSize="sm" color="gray.600">
                  Manage your connected Slack workspaces
                </Text>
              </Box>
            </HStack>
            <Divider my={3} />
            <Button
              as={Link}
              to="/dashboard/workspaces"
              size="sm"
              variant="ghost"
              width="full"
              justifyContent="flex-start"
              leftIcon={<FiSlack />}
            >
              View Workspaces
            </Button>
          </CardBody>
        </Card>

        <Card variant="outline" bg={cardBg}>
          <CardBody>
            <HStack>
              <Icon as={FiUsers} color="blue.500" boxSize={6} />
              <Box>
                <Heading size="sm">Team Management</Heading>
                <Text fontSize="sm" color="gray.600">
                  Manage your team members and roles
                </Text>
              </Box>
            </HStack>
            <Divider my={3} />
            <Button
              as={Link}
              to="/dashboard/teams"
              size="sm"
              variant="ghost"
              width="full"
              justifyContent="flex-start"
              leftIcon={<FiUsers />}
            >
              Manage Teams
            </Button>
          </CardBody>
        </Card>

        <Card variant="outline" bg={cardBg}>
          <CardBody>
            <HStack>
              <Icon as={FiBarChart2} color="green.500" boxSize={6} />
              <Box>
                <Heading size="sm">Analytics</Heading>
                <Text fontSize="sm" color="gray.600">
                  View insights across platforms
                </Text>
              </Box>
            </HStack>
            <Divider my={3} />
            <Button
              as={Link}
              to="/dashboard/analysis"
              size="sm"
              variant="ghost"
              width="full"
              justifyContent="flex-start"
              leftIcon={<FiBarChart2 />}
            >
              View Analytics
            </Button>
          </CardBody>
        </Card>

        <Card variant="outline" bg={cardBg}>
          <CardBody>
            <HStack>
              <Icon as={FiGithub} color="gray.700" boxSize={6} />
              <Box>
                <Heading size="sm">GitHub</Heading>
                <Text fontSize="sm" color="gray.600">
                  Connect GitHub repositories
                </Text>
              </Box>
            </HStack>
            <Divider my={3} />
            <Button
              as={Link}
              to="/dashboard/github"
              size="sm"
              variant="ghost"
              width="full"
              justifyContent="flex-start"
              leftIcon={<FiGithub />}
            >
              Connect Repos
            </Button>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  )
}

export default Dashboard
