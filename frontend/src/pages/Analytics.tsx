import React from 'react'
import {
  Box,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  Icon,
  HStack,
  Flex,
  Divider,
} from '@chakra-ui/react'
import {
  FiUsers,
  FiMessageSquare,
  FiBarChart2,
  FiTrendingUp,
  FiActivity,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'

/**
 * Main Analytics page component to display various analytics features.
 */
const Analytics: React.FC = () => {
  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading as="h1" size="xl">
          Analytics
        </Heading>
      </Flex>

      <Tabs colorScheme="purple" mb={6}>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Slack</Tab>
          <Tab>GitHub</Tab>
          <Tab>Notion</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg" mb={8}>
              <Heading as="h2" size="md" mb={4}>
                Platform Analytics Overview
              </Heading>
              <Text mb={4}>
                View insights and analytics across all your connected platforms.
                Select a platform-specific tab for detailed analysis.
              </Text>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
              <Card>
                <CardHeader>
                  <HStack>
                    <Icon as={FiMessageSquare} color="purple.500" boxSize={5} />
                    <Heading size="md">Slack Analytics</Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Text>
                    Analyze communication patterns, topic discussions, and
                    contributor insights from your Slack workspaces.
                  </Text>
                  <Divider my={3} />
                  <Link to="/dashboard/integrations">
                    View Slack Analytics
                  </Link>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <HStack>
                    <Icon as={FiActivity} color="blue.500" boxSize={5} />
                    <Heading size="md">GitHub Analytics</Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Text>
                    Track code contributions, pull requests, reviews, and
                    development metrics across repositories.
                  </Text>
                  <Divider my={3} />
                  <Text color="gray.500">Coming soon</Text>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <HStack>
                    <Icon as={FiUsers} color="teal.500" boxSize={5} />
                    <Heading size="md">Notion Analytics</Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Text>
                    Measure knowledge sharing, documentation quality, and
                    collaborative editing across your Notion workspace.
                  </Text>
                  <Divider my={3} />
                  <Text color="gray.500">Coming soon</Text>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <HStack>
                    <Icon as={FiBarChart2} color="orange.500" boxSize={5} />
                    <Heading size="md">Cross-Platform Analysis</Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Text>
                    See how your team performs across all platforms with unified
                    metrics and correlation analysis.
                  </Text>
                  <Divider my={3} />
                  <Text color="gray.500">Coming soon</Text>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <HStack>
                    <Icon as={FiTrendingUp} color="red.500" boxSize={5} />
                    <Heading size="md">Trend Reports</Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Text>
                    Track changes over time and identify patterns in your team's
                    communication and contribution metrics.
                  </Text>
                  <Divider my={3} />
                  <Text color="gray.500">Coming soon</Text>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                Slack Analytics
              </Heading>
              <Text mb={4}>
                Analyze your Slack workspaces to gain insights about
                communication patterns, topic discussions, and contributor
                engagement.
              </Text>
              <HStack spacing={4} wrap="wrap">
                <Box
                  as={Link}
                  to="/dashboard/integrations"
                  p={4}
                  borderWidth="1px"
                  borderRadius="md"
                  _hover={{ boxShadow: 'md', bg: 'purple.50' }}
                  width={{ base: '100%', md: 'auto' }}
                >
                  <HStack mb={2}>
                    <Icon as={FiMessageSquare} color="purple.500" />
                    <Heading size="sm">Channel Analysis</Heading>
                  </HStack>
                  <Text>
                    Analyze communication patterns in specific channels
                  </Text>
                </Box>
              </HStack>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                GitHub Analytics
              </Heading>
              <Text>
                GitHub analytics features will be available in a future update.
              </Text>
            </Box>
          </TabPanel>

          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                Notion Analytics
              </Heading>
              <Text>
                Notion analytics features will be available in a future update.
              </Text>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default Analytics
