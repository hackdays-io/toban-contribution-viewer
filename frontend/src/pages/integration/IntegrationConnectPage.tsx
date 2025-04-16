import React, { useState } from 'react'
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
  Alert,
  AlertIcon,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
} from '@chakra-ui/react'
import { FiSlack, FiGithub, FiFileText, FiMessageSquare } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageTitle } from '../../components/layout'
import { SlackCredentialsForm } from '../../components/integration'
import useAuth from '../../context/useAuth'

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
 * If a serviceType is provided in the URL, it will display a specific connection UI for that service.
 */
const IntegrationConnectPage: React.FC = () => {
  const { serviceType } = useParams<{ serviceType?: string }>()
  const navigate = useNavigate()
  const { teamContext } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(0)

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
      path: '/dashboard/integrations/connect/slack',
      primary: true,
    },
    {
      id: 'github',
      name: 'GitHub',
      description:
        'Connect your GitHub repositories to analyze code contributions.',
      icon: FiGithub,
      path: '/dashboard/integrations/connect/github',
      primary: false,
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Connect Notion to analyze documentation contributions.',
      icon: FiFileText,
      path: '/dashboard/integrations/connect/notion',
      primary: false,
    },
    {
      id: 'discord',
      name: 'Discord',
      description:
        'Connect your Discord server to analyze community contributions.',
      icon: FiMessageSquare,
      path: '/dashboard/integrations/connect/discord',
      primary: false,
    },
  ]

  const handleIntegrationSelect = (option: IntegrationOption) => {
    navigate(option.path)
  }

  // Function to initiate Slack OAuth authentication
  const initiateSlackAuth = () => {
    const clientId = localStorage.getItem('slack_client_id')
    if (!clientId) {
      setError('Slack Client ID not found. Please configure it first.')
      return
    }

    // Make sure we're using the correct Slack OAuth endpoint
    const redirectUri = `${window.location.origin}/dashboard/integrations/oauth/slack`
    const scope = 'channels:read,channels:history,users:read,groups:read'

    // Use the stored client ID directly for OAuth - IMPORTANT: Use the correct OAuth v2 endpoint
    const state = teamContext?.currentTeamId || 'unknown'
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

    console.log('Redirecting to Slack OAuth URL:', authUrl)

    // Navigate to Slack's OAuth page
    window.location.href = authUrl
  }

  // Function to handle the connection of a specific service
  const handleConnectService = () => {
    if (!serviceType || !teamContext?.currentTeamId) return

    setIsLoading(true)
    setError(null)

    if (serviceType === 'slack') {
      initiateSlackAuth()
    } else {
      setError(`Integration with ${serviceType} is not yet implemented.`)
      setIsLoading(false)
    }
  }

  // Handler for when credentials form is successfully submitted
  const handleCredentialsSuccess = () => {
    setStep(1) // Move to next step
  }

  // Find the current service option if a serviceType is provided
  const currentServiceOption = serviceType
    ? integrationOptions.find((option) => option.id === serviceType)
    : null

  // Render the service-specific connection UI if a serviceType is provided
  if (serviceType && currentServiceOption) {
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
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/dashboard/integrations/connect">
              Connect
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>{currentServiceOption.name}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        <PageTitle
          title={`Connect ${currentServiceOption.name}`}
          description={`Connect your ${currentServiceOption.name} account to your team`}
        />

        {error && (
          <Alert status="error" mb={6} borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <Box mt={8}>
          <Stepper index={step} mb={8} colorScheme="blue">
            <Step>
              <StepIndicator>
                <StepStatus
                  complete={<StepIcon />}
                  incomplete={<StepNumber>1</StepNumber>}
                  active={<StepNumber>1</StepNumber>}
                />
              </StepIndicator>
              <Box flexShrink="0">
                <StepTitle>API Credentials</StepTitle>
                <StepDescription>
                  Enter your Slack API credentials
                </StepDescription>
              </Box>
              <StepSeparator />
            </Step>
            <Step>
              <StepIndicator>
                <StepStatus
                  complete={<StepIcon />}
                  incomplete={<StepNumber>2</StepNumber>}
                  active={<StepNumber>2</StepNumber>}
                />
              </StepIndicator>
              <Box flexShrink="0">
                <StepTitle>Authorization</StepTitle>
                <StepDescription>Authorize with Slack</StepDescription>
              </Box>
            </Step>
          </Stepper>

          <Card
            bg={primaryBg}
            borderWidth="1px"
            borderColor={primaryBorder}
            borderRadius="lg"
            overflow="hidden"
            p={6}
          >
            <Flex alignItems="center" mb={6}>
              <Box p={3} borderRadius="md" bg="blue.100">
                <Icon
                  as={currentServiceOption.icon}
                  boxSize={8}
                  color="blue.500"
                />
              </Box>
              <Heading size="lg" ml={4}>
                {currentServiceOption.name}
              </Heading>
            </Flex>

            {step === 0 ? (
              <SlackCredentialsForm onSuccess={handleCredentialsSuccess} />
            ) : (
              <>
                <Text mb={6}>{currentServiceOption.description}</Text>

                <Text mb={8}>
                  Now that you've set up your API credentials, you'll need to
                  authorize this application to access your Slack workspace.
                  Click the button below to start the authorization process.
                </Text>

                <Button
                  colorScheme="blue"
                  size="lg"
                  onClick={handleConnectService}
                  isLoading={isLoading}
                  mb={4}
                  width={{ base: 'full', md: 'auto' }}
                >
                  Authorize with {currentServiceOption.name}
                </Button>

                <Button variant="ghost" onClick={() => setStep(0)} mr={4}>
                  Back to Credentials
                </Button>

                <Text fontSize="sm" color="gray.500" mt={4}>
                  By connecting your account, you agree to our terms of service
                  and privacy policy.
                </Text>
              </>
            )}
          </Card>
        </Box>
      </Box>
    )
  }

  // Render the default integration options if no serviceType is provided
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
