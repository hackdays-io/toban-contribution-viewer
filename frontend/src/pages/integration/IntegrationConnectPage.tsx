import React from 'react'
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  Icon,
  Button,
  VStack,
  Flex,
  useColorModeValue,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
} from '@chakra-ui/react'
import { FiSlack, FiGithub, FiFileText, FiMessageSquare } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { PageTitle } from '../../components/layout'

interface IntegrationOption {
  id: string
  name: string
  description: string
  icon: React.ElementType
  path: string
  primary: boolean
}

/**
 * Page for connecting a new integration, offering various integration options.
 */
const IntegrationConnectPage: React.FC = () => {
  const navigate = useNavigate()
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')
  const hoverBg = useColorModeValue('gray.50', 'gray.700')
  const primaryBg = useColorModeValue('blue.50', 'blue.900')
  const primaryBorder = useColorModeValue('blue.200', 'blue.700')

  const integrationOptions: IntegrationOption[] = [
    {
      id: 'slack',
      name: 'Slack',
      description:
        'Connect your Slack workspace to analyze team communication and contributions.',
      icon: FiSlack,
      path: '/dashboard/slack/connect',
      primary: true,
    },
    {
      id: 'github',
      name: 'GitHub',
      description:
        'Connect your GitHub repositories to analyze code contributions.',
      icon: FiGithub,
      path: '/dashboard/github/connect',
      primary: false,
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Connect Notion to analyze documentation contributions.',
      icon: FiFileText,
      path: '/dashboard/notion/connect',
      primary: false,
    },
    {
      id: 'discord',
      name: 'Discord',
      description:
        'Connect your Discord server to analyze community contributions.',
      icon: FiMessageSquare,
      path: '/dashboard/discord/connect',
      primary: false,
    },
  ]

  const handleIntegrationSelect = (option: IntegrationOption) => {
    navigate(option.path)
  }

  return (
    <Box>
      <Breadcrumb mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard/integrations">
            Integrations
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Connect</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <PageTitle
        title="Connect an Integration"
        description="Choose an integration to connect to your team"
      />

      <Box mt={8}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {integrationOptions.map((option) => (
            <Card
              key={option.id}
              bg={option.primary ? primaryBg : cardBg}
              borderWidth="1px"
              borderColor={option.primary ? primaryBorder : cardBorder}
              borderRadius="lg"
              overflow="hidden"
              transition="all 0.2s"
              _hover={{
                transform: 'translateY(-2px)',
                bg: option.primary ? primaryBg : hoverBg,
                shadow: 'md',
              }}
              onClick={() => handleIntegrationSelect(option)}
              cursor="pointer"
            >
              <CardBody>
                <Flex direction="column" height="100%">
                  <Flex alignItems="center" mb={4}>
                    <Box
                      p={2}
                      borderRadius="md"
                      bg={option.primary ? 'blue.100' : 'gray.100'}
                    >
                      <Icon
                        as={option.icon}
                        boxSize={6}
                        color={option.primary ? 'blue.500' : 'gray.500'}
                      />
                    </Box>
                    <Heading size="md" ml={3}>
                      {option.name}
                    </Heading>
                  </Flex>

                  <Text flex="1" mb={4}>
                    {option.description}
                  </Text>

                  <Button
                    mt="auto"
                    colorScheme={option.primary ? 'blue' : 'gray'}
                    variant={option.primary ? 'solid' : 'outline'}
                    width="full"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleIntegrationSelect(option)
                    }}
                  >
                    Connect {option.name}
                  </Button>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        <VStack
          spacing={2}
          mt={8}
          p={6}
          borderWidth="1px"
          borderRadius="lg"
          borderStyle="dashed"
        >
          <Text fontSize="lg">Don't see the integration you need?</Text>
          <Text color="gray.500">
            We're constantly adding new integrations. Contact us to request an
            integration or let us know what you'd like to see next.
          </Text>
          <Button variant="outline" colorScheme="blue" mt={2}>
            Request Integration
          </Button>
        </VStack>
      </Box>
    </Box>
  )
}

export default IntegrationConnectPage
