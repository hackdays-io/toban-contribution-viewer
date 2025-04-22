import React from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Container,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  FiActivity,
  FiBarChart2,
  FiClock,
  FiExternalLink,
  FiMessageSquare,
  FiPieChart,
  FiSearch,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { LAYOUT_CONSTANTS } from '../components/layout/AppLayout'

/**
 * Main Analytics page component with improved accessibility.
 */
const Analytics: React.FC = () => {
  const navigate = useNavigate()
  const cardBgHover = useColorModeValue('purple.50', 'purple.900')
  const highlightBg = useColorModeValue('purple.50', 'purple.800')

  // Recent analyses (would be fetched from API in real implementation)
  const recentAnalyses = [
    {
      id: 'a1',
      title: 'general',
      date: '2023-04-20',
      workspace: 'Toban Team',
      type: 'slack',
      path: '/dashboard/integrations',
    },
    {
      id: 'a2',
      title: 'dev-frontend',
      date: '2023-04-18',
      workspace: 'Toban Team',
      type: 'slack',
      path: '/dashboard/integrations',
    },
    {
      id: 'a3',
      title: 'announcements',
      date: '2023-04-15',
      workspace: 'Toban Team',
      type: 'slack',
      path: '/dashboard/integrations',
    },
  ]

  // Analysis features available for connected platforms
  const analyticsFeatures = [
    {
      title: 'Channel Analysis',
      description: 'Analyze communication patterns in Slack channels',
      icon: FiMessageSquare,
      color: 'purple.500',
      available: true,
      path: '/dashboard/analysis/create',
    },
    {
      title: 'Contributor Insights',
      description: 'Measure participation and engagement patterns',
      icon: FiUsers,
      color: 'blue.500',
      available: true,
      path: '/dashboard/integrations',
    },
    {
      title: 'Topic Analysis',
      description: 'Identify key discussion topics and trends',
      icon: FiPieChart,
      color: 'green.500',
      available: true,
      path: '/dashboard/integrations',
    },
    {
      title: 'Cross-Channel Analytics',
      description: 'Compare activity across multiple channels',
      icon: FiBarChart2,
      color: 'orange.500',
      available: false,
      path: '#',
    },
    {
      title: 'Trend Reports',
      description: 'Track changes in communication over time',
      icon: FiTrendingUp,
      color: 'pink.500',
      available: false,
      path: '#',
    },
    {
      title: 'Integration Analytics',
      description: 'Analyze patterns across all connected tools',
      icon: FiActivity,
      color: 'cyan.500',
      available: false,
      path: '#',
    },
  ]

  // Render a feature card
  const renderFeatureCard = (feature: any) => (
    <Card
      key={feature.title}
      variant="outline"
      borderWidth="1px"
      _hover={
        feature.available
          ? {
              bg: cardBgHover,
              borderColor: 'purple.300',
              transform: 'translateY(-2px)',
            }
          : {}
      }
      height="100%"
      transition="all 0.2s"
      opacity={feature.available ? 1 : 0.6}
      cursor={feature.available ? 'pointer' : 'default'}
      onClick={() => feature.available && navigate(feature.path)}
    >
      <CardHeader pb={2}>
        <HStack>
          <Icon as={feature.icon} color={feature.color} boxSize={5} />
          <Heading size="md">{feature.title}</Heading>
        </HStack>
      </CardHeader>
      <CardBody pt={0}>
        <Text>{feature.description}</Text>
      </CardBody>
      <CardFooter pt={0}>
        {feature.available ? (
          <Button
            as={Link}
            to={feature.path}
            variant="ghost"
            colorScheme="purple"
            size="sm"
            rightIcon={<Icon as={FiExternalLink} />}
          >
            Open
          </Button>
        ) : (
          <Text fontSize="sm" color="gray.500">
            Coming soon
          </Text>
        )}
      </CardFooter>
    </Card>
  )

  return (
    <Box width="100%">
      <Grid
        templateColumns={{ base: '1fr', lg: '3fr 1fr' }}
        gap={6}
        width="100%"
      >
        {/* Main content area */}
        <GridItem>
          <Flex justifyContent="space-between" alignItems="center" mb={6}>
            <Heading as="h1" size="xl">
              Analytics Hub
            </Heading>
            <Button
              as={Link}
              to="/dashboard/analysis/create"
              colorScheme="purple"
              size="md"
              leftIcon={<Icon as={FiSearch} />}
            >
              Run New Analysis
            </Button>
          </Flex>

          <Tabs colorScheme="purple" mb={6} variant="enclosed-colored">
            <TabList>
              <Tab>Available Features</Tab>
              <Tab>By Platform</Tab>
            </TabList>

            <TabPanels>
              {/* Features Tab */}
              <TabPanel px={0}>
                <Box
                  p={4}
                  borderWidth="1px"
                  borderRadius="lg"
                  mb={6}
                  bg={highlightBg}
                >
                  <Heading as="h2" size="md" mb={2}>
                    Available Analytics Features
                  </Heading>
                  <Text>
                    Select any of the available analytics tools to gain insights
                    into your team's communication and collaboration patterns.
                  </Text>
                </Box>

                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  {analyticsFeatures.map(renderFeatureCard)}
                </SimpleGrid>
              </TabPanel>

              {/* Platforms Tab */}
              <TabPanel px={0}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  {/* Slack Platform */}
                  <Card variant="filled" bg={highlightBg}>
                    <CardHeader>
                      <HStack>
                        <Icon
                          as={FiMessageSquare}
                          color="purple.500"
                          boxSize={5}
                        />
                        <Heading size="md">Slack Analytics</Heading>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <Text mb={4}>
                        Analyze communication patterns, topics, and contributor
                        insights from your Slack workspaces.
                      </Text>
                      <VStack align="stretch" spacing={2}>
                        <Button
                          as={Link}
                          to="/dashboard/analysis/create"
                          variant="solid"
                          colorScheme="purple"
                          size="sm"
                          justifyContent="space-between"
                          rightIcon={<Icon as={FiExternalLink} />}
                        >
                          Channel Analysis
                        </Button>
                        <Button
                          as={Link}
                          to="/dashboard/integrations"
                          variant="outline"
                          colorScheme="purple"
                          size="sm"
                          justifyContent="space-between"
                          rightIcon={<Icon as={FiExternalLink} />}
                        >
                          View Past Analyses
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>

                  {/* GitHub Platform */}
                  <Card variant="outline">
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

                  {/* Notion Platform */}
                  <Card variant="outline">
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

                  {/* Cross-Platform Analysis */}
                  <Card variant="outline">
                    <CardHeader>
                      <HStack>
                        <Icon as={FiBarChart2} color="orange.500" boxSize={5} />
                        <Heading size="md">Cross-Platform Analysis</Heading>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      <Text>
                        See how your team performs across all platforms with
                        unified metrics and correlation analysis.
                      </Text>
                      <Divider my={3} />
                      <Text color="gray.500">Coming soon</Text>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>

        {/* Right sidebar */}
        <GridItem>
          <Card borderWidth="1px" height="100%">
            <CardHeader pb={2}>
              <HStack>
                <Icon as={FiClock} color="purple.500" />
                <Heading size="md">Recent Analyses</Heading>
              </HStack>
            </CardHeader>
            <CardBody pt={2}>
              {recentAnalyses.length > 0 ? (
                <VStack align="stretch" spacing={3}>
                  {recentAnalyses.map((analysis) => (
                    <Card
                      key={analysis.id}
                      size="sm"
                      variant="outline"
                      _hover={{ bg: cardBgHover }}
                      as={Link}
                      to={analysis.path}
                      cursor="pointer"
                    >
                      <CardBody py={3}>
                        <Flex justify="space-between" align="center">
                          <VStack align="start" spacing={0}>
                            <Heading size="xs">#{analysis.title}</Heading>
                            <Text fontSize="xs" color="gray.500">
                              {analysis.workspace}
                            </Text>
                          </VStack>
                          <HStack>
                            <Icon
                              as={
                                analysis.type === 'slack'
                                  ? FiMessageSquare
                                  : FiBarChart2
                              }
                              color="purple.500"
                              boxSize={4}
                            />
                            <Text fontSize="xs" color="gray.500">
                              {new Date(analysis.date).toLocaleDateString()}
                            </Text>
                          </HStack>
                        </Flex>
                      </CardBody>
                    </Card>
                  ))}
                  <Button
                    as={Link}
                    to="/dashboard/integrations"
                    variant="outline"
                    colorScheme="purple"
                    size="sm"
                    width="100%"
                  >
                    View All History
                  </Button>
                </VStack>
              ) : (
                <Box textAlign="center" py={4}>
                  <Text color="gray.500">No recent analyses</Text>
                </Box>
              )}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Box>
  )
}

export default Analytics
