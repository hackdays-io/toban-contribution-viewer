import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Box,
  Heading,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  VStack,
  Button,
} from '@chakra-ui/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import env from '../../config/env'
import useAuth from '../../context/useAuth'
// Import the integrationService for creating integrations
import integrationService, {
  CreateSlackIntegrationRequest,
} from '../../lib/integrationService'

/**
 * Component to handle the Slack OAuth callback.
 */
const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  )
  const [errorMessage, setErrorMessage] = useState('')
  // Use a ref to track if we've already processed the code
  const hasProcessedCode = useRef<boolean>(false)
  // Get auth context with teamContext and loading state
  const { teamContext, loading: authLoading } = useAuth()
  // Add state to track if we need to wait for team context
  const [waitingForTeamContext, setWaitingForTeamContext] = useState(false)
  // Add a state to track if we've been waiting too long
  const [teamContextTimeout, setTeamContextTimeout] = useState(false)

  // Create a flag that can be used for debug logging if needed
  const isDevEnvironment = Boolean(
    env.isDev ||
      window.location.hostname === 'localhost' ||
      window.location.hostname.includes('ngrok')
  )

  // Log additional information in development environments
  useEffect(() => {
    if (isDevEnvironment) {
      console.debug('OAuthCallback running in development environment')
      console.debug('Team context:', teamContext)
    }
  }, [isDevEnvironment, teamContext])

  // Main function to handle the OAuth callback
  const handleCallback = useCallback(async () => {
    // Prevent duplicate processing due to StrictMode or rerenders
    if (hasProcessedCode.current) {
      return
    }

    // No mock data for development
    if (!env.apiUrl || env.apiUrl === 'your_api_url') {
      console.error(
        'API URL is not configured. Please set proper API URL in environment variables.'
      )
      setStatus('error')
      setErrorMessage(
        'API URL not configured. Please check application settings.'
      )
      return
    }

    // Look for error parameter
    const error = searchParams.get('error')
    if (error) {
      setStatus('error')
      setErrorMessage(`Authorization failed: ${error}`)
      return
    }

    const code = searchParams.get('code')
    if (code) {
      // Mark that we've started processing this code
      hasProcessedCode.current = true

      try {
        // Retrieve client ID, client secret, and team ID from session storage
        const clientId = sessionStorage.getItem('slack_client_id')
        const clientSecret = sessionStorage.getItem('slack_client_secret')
        const integrationName =
          sessionStorage.getItem('slack_integration_name') || 'Slack Workspace'
        const storedTeamId = sessionStorage.getItem('slack_team_id')

        if (!clientId || !clientSecret) {
          throw new Error('Missing credentials. Please try connecting again.')
        }

        // Use stored team ID if available, otherwise fall back to current team context
        const teamId = storedTeamId || teamContext.currentTeamId

        if (!teamId) {
          throw new Error(
            'No team selected. Please select a team before connecting Slack.'
          )
        }

        // Log debug information
        if (isDevEnvironment) {
          console.debug('OAuth callback data:', {
            code: code ? 'present (not shown for security)' : 'missing',
            redirect_uri: window.location.origin + '/auth/slack/callback',
            team_id: teamId,
            name: integrationName,
            has_client_id: Boolean(clientId),
            has_client_secret: Boolean(clientSecret),
          })
        }

        // Create a new integration using the team-based approach with integrationService
        const slackIntegrationData: CreateSlackIntegrationRequest = {
          code: code,
          // Make sure to use the exact same redirect URI that was used to get the code
          redirect_uri: window.location.origin + '/auth/slack/callback',
          client_id: clientId,
          client_secret: clientSecret,
          service_type: 'slack',
          team_id: teamId,
          name: integrationName,
        }

        const result =
          await integrationService.createSlackIntegration(slackIntegrationData)

        // Check if the result is an API error
        if (result && 'status' in result && 'message' in result) {
          throw new Error(
            `Failed to create Slack integration: ${result.message}`
          )
        }

        // Clear sensitive data from session storage
        sessionStorage.removeItem('slack_client_id')
        sessionStorage.removeItem('slack_client_secret')
        sessionStorage.removeItem('slack_integration_name')
        sessionStorage.removeItem('slack_team_id')

        setStatus('success')

        // Navigate to integrations list after a short delay
        setTimeout(() => {
          navigate('/dashboard/integrations')
        }, 2000)
      } catch (err) {
        console.error('Error connecting to Slack:', err)

        // No mock success for network or CORS errors
        if (
          err instanceof TypeError ||
          (err instanceof Error &&
            (err.message.includes('NetworkError') ||
              err.message.includes('Failed to fetch') ||
              err.message.includes('CORS')))
        ) {
          console.error(
            'Network or CORS error when connecting to backend:',
            err
          )
        }

        // Clear sensitive data from session storage even on error
        sessionStorage.removeItem('slack_client_id')
        sessionStorage.removeItem('slack_client_secret')
        sessionStorage.removeItem('slack_integration_name')
        sessionStorage.removeItem('slack_team_id')

        setStatus('error')

        // Handle specific error messages
        let displayErrorMessage = 'Failed to connect workspace'
        if (err instanceof Error) {
          // Shorten and simplify error messages for the user
          if (err.message.includes('invalid_code')) {
            displayErrorMessage =
              'Authentication code expired or invalid. Please try again.'
          } else {
            displayErrorMessage = err.message
          }
        }

        setErrorMessage(displayErrorMessage)
      }
    } else {
      // No code provided - error condition
      console.error('No authorization code provided in URL parameters')
      setStatus('error')
      setErrorMessage('No authorization code received. Please try again.')
    }
  }, [searchParams, teamContext.currentTeamId, navigate])

  // Effect to handle Auth loading and team context
  useEffect(() => {
    // If we're waiting for team context and not loading anymore
    if (waitingForTeamContext && !authLoading) {
      // Check if we have team context now
      if (teamContext.currentTeamId) {
        console.log('Team context loaded, proceeding with OAuth flow')
        setWaitingForTeamContext(false)
        // Now proceed with the callback processing
        handleCallback()
      } else if (!authLoading) {
        // If auth is done loading but we still don't have a team, show an error
        console.error('Auth loaded but no team context available')
        setStatus('error')
        setErrorMessage(
          'No team selected. Please select a team before connecting Slack.'
        )
      }
    }
  }, [
    authLoading,
    teamContext.currentTeamId,
    waitingForTeamContext,
    handleCallback,
  ])

  // Effect to handle the OAuth callback
  useEffect(() => {
    // Only call handleCallback if we don't need to wait for team context
    if (!authLoading && teamContext.currentTeamId) {
      handleCallback()
    } else if (!waitingForTeamContext) {
      // Set waiting flag if we need to wait
      setWaitingForTeamContext(true)
      console.log('Waiting for team context before proceeding with OAuth flow')

      // Set up a timeout of 10 seconds for team context to load
      const timeoutId = setTimeout(() => {
        if (waitingForTeamContext && !teamContext.currentTeamId) {
          console.error('Timeout waiting for team context')
          setTeamContextTimeout(true)
          setStatus('error')
          setErrorMessage(
            'Unable to retrieve team information. Please try again or select a team first.'
          )
        }
      }, 10000)

      // Clean up the timeout
      return () => clearTimeout(timeoutId)
    }
  }, [
    searchParams,
    authLoading,
    teamContext.currentTeamId,
    waitingForTeamContext,
    handleCallback,
  ])

  return (
    <Box p={6} maxWidth="600px" mx="auto" textAlign="center">
      <VStack spacing={6}>
        {status === 'loading' && (
          <>
            <Spinner
              size="xl"
              color="purple.500"
              thickness="4px"
              speed="0.65s"
            />
            <Heading size="lg">
              {waitingForTeamContext
                ? 'Loading team information...'
                : 'Connecting Workspace...'}
            </Heading>
            <Text color="gray.600">
              {waitingForTeamContext && teamContextTimeout
                ? "Taking longer than expected. Make sure you're signed in and have selected a team."
                : waitingForTeamContext
                  ? 'Please wait while we retrieve your team information.'
                  : 'Please wait while we complete the connection process.'}
            </Text>
            {waitingForTeamContext && teamContextTimeout && (
              <Button
                mt={4}
                colorScheme="purple"
                onClick={() =>
                  (window.location.href = '/dashboard/integrations')
                }
              >
                Return to Integrations
              </Button>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              Workspace successfully connected!
            </Alert>
            <Text>Redirecting to your integrations...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              Connection failed
            </Alert>
            <Text>{errorMessage}</Text>
            <Text mt={4}>
              Please try again or contact support if the problem persists.
            </Text>
          </>
        )}
      </VStack>
    </Box>
  )
}

export default OAuthCallback
