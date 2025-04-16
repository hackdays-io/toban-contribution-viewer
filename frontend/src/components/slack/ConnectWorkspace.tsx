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
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'
import env from '../../config/env'

interface ConnectWorkspaceProps {
  redirectTo?: string
}

/**
 * Component to connect a Slack workspace using OAuth.
 */
const ConnectWorkspace: React.FC<ConnectWorkspaceProps> = ({
  redirectTo = '/dashboard/slack/workspaces',
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [clientIdError, setClientIdError] = useState('')
  const [clientSecretError, setClientSecretError] = useState('')

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

  // Try to load credentials from localStorage
  useEffect(() => {
    const savedClientId = localStorage.getItem('slack_client_id')
    if (savedClientId) {
      setClientId(savedClientId)
    }
  }, [])

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

  // Validate inputs
  const validateInputs = () => {
    let isValid = true

    if (!clientId.trim()) {
      setClientIdError('Client ID is required')
      isValid = false
    } else {
      setClientIdError('')
    }

    if (!clientSecret.trim()) {
      setClientSecretError('Client Secret is required')
      isValid = false
    } else {
      setClientSecretError('')
    }

    return isValid
  }

  /**
   * Initiates the OAuth flow by redirecting to Slack.
   */
  const connectWorkspace = async () => {
    try {
      if (!validateInputs()) {
        return
      }

      setIsLoading(true)

      // Save client ID, redirect URL, and team ID in localStorage for the callback
      localStorage.setItem('slack_client_id', clientId)
      localStorage.setItem('slack_client_secret', clientSecret)
      localStorage.setItem('slack_redirect_url', redirectTo)
      // Store current team ID for use during callback
      const currentTeamId = localStorage.getItem('currentTeamId')
      if (currentTeamId) {
        localStorage.setItem('slack_team_id', currentTeamId)
      }

      // Get the full redirect URI based on current location
      const callbackUrl = window.location.origin + '/auth/slack/callback'
      console.log('Using callback URL:', callbackUrl)

      // Get OAuth URL from backend with explicit CORS headers
      const response = await fetch(
        `${env.apiUrl}/slack/oauth-url?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(callbackUrl)}`,
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

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to get Slack authorization URL')
      }

      const data = await response.json()

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

        <FormControl isRequired isInvalid={!!clientIdError}>
          <FormLabel>Slack Client ID</FormLabel>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter your Slack Client ID"
          />
          {clientIdError && (
            <FormErrorMessage>{clientIdError}</FormErrorMessage>
          )}
          <FormHelperText>
            You can find this in your Slack App settings
          </FormHelperText>
        </FormControl>

        <FormControl isRequired isInvalid={!!clientSecretError}>
          <FormLabel>Slack Client Secret</FormLabel>
          <InputGroup>
            <Input
              type={showClientSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Enter your Slack Client Secret"
            />
            <InputRightElement>
              <IconButton
                aria-label={showClientSecret ? 'Hide secret' : 'Show secret'}
                icon={showClientSecret ? <ViewOffIcon /> : <ViewIcon />}
                onClick={() => setShowClientSecret(!showClientSecret)}
                variant="ghost"
                size="sm"
              />
            </InputRightElement>
          </InputGroup>
          {clientSecretError && (
            <FormErrorMessage>{clientSecretError}</FormErrorMessage>
          )}
          <FormHelperText>
            You can find this in your Slack App settings
          </FormHelperText>
        </FormControl>

        <Text fontWeight="bold">We'll need the following permissions:</Text>

        <VStack align="flex-start" spacing={1} pl={4}>
          <Text>• Access to public and private channels</Text>
          <Text>• Access to message history</Text>
          <Text>• View reactions to messages</Text>
          <Text>• View basic user information</Text>
        </VStack>

        <Text>
          We respect your privacy and will only collect the data necessary for
          contribution analysis.
        </Text>

        <Box width="100%" pt={4}>
          <Button
            colorScheme="purple"
            size="lg"
            width="100%"
            onClick={connectWorkspace}
            isLoading={isLoading}
            loadingText="Connecting..."
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
