import React, { useState, useEffect } from 'react'
import {
  Button,
  Box,
  Heading,
  Text,
  VStack,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  Input,
  FormHelperText,
  FormErrorMessage,
  IconButton,
  InputGroup,
  InputRightElement,
  Divider,
  Code,
  useClipboard,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon, CopyIcon, CheckIcon } from '@chakra-ui/icons'
import env from '../../config/env'
import useAuth from '../../context/useAuth'
import { TeamSelector } from '../team'

/**
 * Component to connect a Slack workspace using OAuth.
 */
const ConnectWorkspace: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [integrationName, setIntegrationName] = useState('Slack Workspace')
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [teamError, setTeamError] = useState('')
  const [clientIdError, setClientIdError] = useState('')
  const [clientSecretError, setClientSecretError] = useState('')
  const [integrationNameError, setIntegrationNameError] = useState('')
  const { teamContext } = useAuth()

  // Slack App Manifest in YAML format
  const slackManifest = `display_information:
  name: Toban Contribution Viewer
  description: Track and analyze team contributions across Slack
  background_color: "#4A154B"

features:
  bot_user:
    display_name: Toban
    always_online: false

oauth_config:
  redirect_urls:
    - ${window.location.origin}/auth/slack/callback
  scopes:
    bot:
      - channels:history
      - channels:read
      - groups:history
      - groups:read
      - team:read
      - users:read
      - users.profile:read
      - reactions:read
      - im:history
      - mpim:history
      - files:read

settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false`

  const { hasCopied, onCopy } = useClipboard(slackManifest)

  interface CorsDebugInfo {
    allowed_origins: string[]
    additional_cors_origins: string
    ngrok_url: string
    api_url: string | null
    frontend_url: string | null
    debug_mode: boolean
  }
  const [corsDebugInfo, setCorsDebugInfo] = useState<CorsDebugInfo | null>(null)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [corsError, setCorsError] = useState(false)
  const toast = useToast()

  // Check if we're in a CORS-problematic environment
  const isNgrokOrRemote =
    window.location.hostname.includes('ngrok') ||
    (!window.location.hostname.includes('localhost') &&
      env.apiUrl.includes('localhost'))

  // Fetch CORS debug info when in ngrok environment
  useEffect(() => {
    if (isNgrokOrRemote) {
      checkCorsDebug()
    }
  }, [isNgrokOrRemote])

  // Function to check CORS debug endpoint
  const checkCorsDebug = async () => {
    try {
      const response = await fetch(
        `${env.apiUrl.split('/api/v1')[0]}/cors-debug`,
        {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setCorsDebugInfo(data)
        setShowDebugInfo(true)
      }
    } catch (error) {
      console.error('Error fetching CORS debug info:', error)
      // If we can't reach the CORS debug endpoint, this is likely a CORS issue
      setCorsError(true)
    }
  }

  // Handle team selection
  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId)
    if (teamId) {
      setTeamError('')
    }
  }

  // Initialize selectedTeamId with the current team if available
  useEffect(() => {
    if (teamContext.currentTeamId && !selectedTeamId) {
      setSelectedTeamId(teamContext.currentTeamId)
    }
  }, [teamContext.currentTeamId, selectedTeamId])

  // Form validation
  const validateForm = (): boolean => {
    let isValid = true

    // Validate client ID
    if (!clientId.trim()) {
      setClientIdError('Client ID is required')
      isValid = false
    } else {
      setClientIdError('')
    }

    // Validate client secret
    if (!clientSecret.trim()) {
      setClientSecretError('Client Secret is required')
      isValid = false
    } else {
      setClientSecretError('')
    }

    // Validate integration name
    if (!integrationName.trim()) {
      setIntegrationNameError('Integration name is required')
      isValid = false
    } else {
      setIntegrationNameError('')
    }

    // Validate team selection
    if (!selectedTeamId) {
      setTeamError('Please select a team')
      toast({
        title: 'No team selected',
        description: 'Please select a team before connecting Slack.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      isValid = false
    } else {
      setTeamError('')
    }

    return isValid
  }

  /**
   * Initiates the OAuth flow by redirecting to Slack.
   */
  const connectWorkspace = async () => {
    try {
      // Validate form inputs first
      if (!validateForm()) {
        return
      }

      setIsLoading(true)

      // Build URL with query parameters for client_id and client_secret
      const url = new URL(`${env.apiUrl}/slack/oauth-url`)
      url.searchParams.append('client_id', clientId)
      url.searchParams.append('client_secret', clientSecret)

      // Get OAuth URL from backend with explicit CORS headers
      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to get Slack authorization URL')
      }

      const data = await response.json()

      // Store client_id, client_secret, integration_name, and selected team_id in session storage for OAuth callback
      sessionStorage.setItem('slack_client_id', clientId)
      sessionStorage.setItem('slack_client_secret', clientSecret)
      sessionStorage.setItem('slack_integration_name', integrationName)
      sessionStorage.setItem('slack_team_id', selectedTeamId)

      // Redirect to Slack OAuth page
      window.location.href = data.url
    } catch (error) {
      console.error('Error connecting workspace:', error)

      // Check if this is likely a CORS error
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const isCorsError =
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('CORS')

      if (isCorsError && isNgrokOrRemote) {
        setCorsError(true)
      }

      toast({
        title: 'Connection Error',
        description:
          error instanceof Error ? error.message : 'Failed to connect to Slack',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setIsLoading(false)
    }
  }

  return (
    <Box
      p={6}
      borderWidth="1px"
      borderRadius="lg"
      width="100%"
      maxWidth="600px"
      mx="auto"
    >
      <VStack spacing={6} align="flex-start">
        <Heading size="lg">Connect Slack Workspace</Heading>

        {corsError && (
          <Alert status="warning" mb={6}>
            <AlertIcon />
            <VStack align="start" spacing={2} width="100%">
              <Text fontWeight="bold">CORS Error Detected</Text>
              <Text>
                Unable to connect to the API due to browser security
                restrictions (CORS). This commonly happens when accessing the
                app through ngrok while the API is running on localhost.
              </Text>
              <Text fontWeight="bold">Try one of these solutions:</Text>
              <Text>1. Run the frontend directly on localhost</Text>
              <Text>2. Run the backend on a public URL</Text>
              <Text>
                3. Configure the backend to accept requests from{' '}
                {window.location.origin}
              </Text>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={checkCorsDebug}
                mt={2}
              >
                Check CORS Configuration
              </Button>
            </VStack>
          </Alert>
        )}

        {showDebugInfo && corsDebugInfo && (
          <Alert status="info" mb={6}>
            <AlertIcon />
            <VStack align="start" spacing={2} width="100%">
              <Text fontWeight="bold">CORS Debug Information</Text>
              <Text>API URL: {corsDebugInfo.api_url || 'Not set'}</Text>
              <Text>
                Frontend URL: {corsDebugInfo.frontend_url || 'Not set'}
              </Text>
              <Text>
                Debug Mode: {corsDebugInfo.debug_mode ? 'Enabled' : 'Disabled'}
              </Text>
              <Text fontWeight="bold">Allowed Origins:</Text>
              <Box
                p={2}
                bg="gray.50"
                borderRadius="md"
                width="100%"
                overflow="auto"
              >
                <pre style={{ fontSize: '0.8em' }}>
                  {JSON.stringify(corsDebugInfo.allowed_origins, null, 2)}
                </pre>
              </Box>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={() => setShowDebugInfo(false)}
                mt={2}
              >
                Hide Debug Info
              </Button>
            </VStack>
          </Alert>
        )}

        <Text>
          Connect your Slack workspace to analyze team contributions and
          communication patterns. This will allow us to collect message data,
          reactions, and user information.
        </Text>

        <Divider my={4} />

        <Text fontWeight="bold" mb={2}>
          Team Selection
        </Text>

        <TeamSelector
          label="Select Team"
          value={selectedTeamId}
          onChange={handleTeamChange}
          hasError={!!teamError}
          errorMessage={teamError}
          helperText="This integration will be associated with the selected team"
          mb={4}
        />

        <Text fontWeight="bold">Required OAuth Scopes:</Text>

        <VStack align="flex-start" spacing={1} pl={4}>
          <Text>
            • <code>channels:history</code> - Read messages in public channels
          </Text>
          <Text>
            • <code>groups:history</code> - Read messages in private channels
          </Text>
          <Text>
            • <code>channels:read</code> - View basic info about public channels
          </Text>
          <Text>
            • <code>groups:read</code> - View basic info about private channels
          </Text>
          <Text>
            • <code>users:read</code> - Access basic user information
          </Text>
          <Text>
            • <code>users.profile:read</code> - Access user profile details
          </Text>
          <Text>
            • <code>team:read</code> - View basic workspace information
          </Text>
          <Text>
            • <code>reactions:read</code> - View emoji reactions (for
            engagement)
          </Text>
        </VStack>

        <Text mt={2}>Optional scopes for additional features:</Text>
        <VStack align="flex-start" spacing={1} pl={4}>
          <Text>
            • <code>im:history</code> - Access direct messages (for 1:1
            communication)
          </Text>
          <Text>
            • <code>mpim:history</code> - Access group direct messages
          </Text>
          <Text>
            • <code>files:read</code> - Access files (if tracking document
            contributions)
          </Text>
        </VStack>

        <Text mt={2}>
          We respect your privacy and will only collect the data necessary for
          contribution analysis.
        </Text>

        <Accordion allowToggle width="100%" mt={4}>
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box as="span" flex="1" textAlign="left" fontWeight="bold">
                  Slack App Manifest (Easy Setup)
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <Text mb={2}>
                Use this manifest to quickly create your Slack app with all
                required scopes. Go to{' '}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'blue', textDecoration: 'underline' }}
                >
                  api.slack.com/apps
                </a>
                , click "Create New App" and select "From an app manifest".
              </Text>
              <Box
                position="relative"
                bg="gray.50"
                p={4}
                borderRadius="md"
                fontSize="sm"
                mb={2}
                maxHeight="300px"
                overflow="auto"
              >
                <Box position="absolute" top={2} right={2} zIndex={1}>
                  <Button
                    size="sm"
                    colorScheme={hasCopied ? 'green' : 'gray'}
                    leftIcon={hasCopied ? <CheckIcon /> : <CopyIcon />}
                    onClick={onCopy}
                  >
                    {hasCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </Box>
                <Code
                  display="block"
                  whiteSpace="pre"
                  fontFamily="monospace"
                  overflowX="auto"
                  mt={4}
                  ml={2}
                >
                  {slackManifest}
                </Code>
              </Box>
              <Text fontSize="sm" color="gray.600">
                After creating your app, you'll still need to install it to your
                workspace and enter the Client ID and Client Secret below.
              </Text>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        <Text fontWeight="bold" mt={4}>
          Integration Settings
        </Text>

        <VStack spacing={4} width="100%" align="flex-start">
          {/* Integration Name Field */}
          <FormControl isRequired isInvalid={!!integrationNameError}>
            <FormLabel htmlFor="integration-name">Integration Name</FormLabel>
            <Input
              id="integration-name"
              placeholder="Enter a name for this integration"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
            />
            {integrationNameError ? (
              <FormErrorMessage>{integrationNameError}</FormErrorMessage>
            ) : (
              <FormHelperText>
                A friendly name to identify this Slack workspace
              </FormHelperText>
            )}
          </FormControl>
        </VStack>

        <Text fontWeight="bold" mt={4}>
          Slack App Credentials
        </Text>
        <Text fontSize="sm" color="gray.600">
          Enter your Slack application credentials to connect your workspace.
        </Text>

        <Accordion allowToggle width="100%" my={2}>
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box as="span" flex="1" textAlign="left">
                  Manual Setup Instructions
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack align="flex-start" spacing={2}>
                <Text fontWeight="bold">Step 1: Create a Slack App</Text>
                <Text>
                  1. Go to{' '}
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'blue', textDecoration: 'underline' }}
                  >
                    api.slack.com/apps
                  </a>{' '}
                  and click "Create New App"
                </Text>
                <Text>
                  2. Choose "From scratch" or use the manifest option above
                </Text>
                <Text>
                  3. Name your app "Toban Contribution Viewer" (or your
                  preferred name)
                </Text>
                <Text>
                  4. Select the workspace where you want to install the app
                </Text>

                <Text fontWeight="bold" mt={2}>
                  Step 2: Configure OAuth Scopes
                </Text>
                <Text>1. In the left sidebar, click "OAuth & Permissions"</Text>
                <Text>
                  2. Scroll down to "Scopes" and add the Bot Token Scopes listed
                  above
                </Text>

                <Text fontWeight="bold" mt={2}>
                  Step 3: Set Redirect URLs
                </Text>
                <Text>
                  1. Still in "OAuth & Permissions", scroll up to "Redirect
                  URLs"
                </Text>
                <Text>
                  2. Add: {window.location.origin}/auth/slack/callback
                </Text>
                <Text>3. Save the URLs</Text>

                <Text fontWeight="bold" mt={2}>
                  Step 4: Get Credentials
                </Text>
                <Text>1. Go to "Basic Information" in the left sidebar</Text>
                <Text>
                  2. Under "App Credentials", copy the Client ID and Client
                  Secret
                </Text>
                <Text>3. Paste these values into the form below</Text>

                <Text fontWeight="bold" mt={2}>
                  Step 5: Install the App
                </Text>
                <Text>1. In the left sidebar, click "Install App"</Text>
                <Text>2. Click "Install to Workspace"</Text>
                <Text>3. Review the permissions and click "Allow"</Text>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        <VStack spacing={4} width="100%" align="flex-start">
          {/* Client ID Field */}
          <FormControl isRequired isInvalid={!!clientIdError}>
            <FormLabel htmlFor="client-id">Client ID</FormLabel>
            <Input
              id="client-id"
              placeholder="Enter your Slack Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            {clientIdError ? (
              <FormErrorMessage>{clientIdError}</FormErrorMessage>
            ) : (
              <FormHelperText>
                Find this in your Slack App's Basic Information page
              </FormHelperText>
            )}
          </FormControl>

          {/* Client Secret Field */}
          <FormControl isRequired isInvalid={!!clientSecretError}>
            <FormLabel htmlFor="client-secret">Client Secret</FormLabel>
            <InputGroup>
              <Input
                id="client-secret"
                type={showClientSecret ? 'text' : 'password'}
                placeholder="Enter your Slack Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              <InputRightElement>
                <IconButton
                  aria-label={
                    showClientSecret
                      ? 'Hide client secret'
                      : 'Show client secret'
                  }
                  icon={showClientSecret ? <ViewOffIcon /> : <ViewIcon />}
                  variant="ghost"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  size="sm"
                />
              </InputRightElement>
            </InputGroup>
            {clientSecretError ? (
              <FormErrorMessage>{clientSecretError}</FormErrorMessage>
            ) : (
              <FormHelperText>
                Keep this confidential. Found in your Slack App's Basic
                Information page
              </FormHelperText>
            )}
          </FormControl>
        </VStack>

        <Box width="100%" pt={4}>
          <Button
            colorScheme="purple"
            size="lg"
            width="100%"
            onClick={connectWorkspace}
            isLoading={isLoading}
            loadingText="Connecting..."
            isDisabled={!teamContext.currentTeamId}
          >
            {isLoading ? <Spinner size="sm" mr={2} /> : null}
            Connect to Slack
          </Button>
        </Box>
      </VStack>
    </Box>
  )
}

export default ConnectWorkspace
