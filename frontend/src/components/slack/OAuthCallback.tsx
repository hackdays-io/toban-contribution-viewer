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
import { IntegrationType } from '../../lib/integrationService'

/**
 * Component to handle the Slack OAuth callback.
 */
const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<
    'loading' | 'success' | 'error' | 'reconnected'
  >('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
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

    if (isDevEnvironment) {
      console.log('Starting OAuth callback handler')
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

        // Check if this is a reconnection flow by looking for integration_id in session storage
        const integrationId = sessionStorage.getItem('slack_integration_id')
        const isReconnection = Boolean(integrationId)

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
            is_reconnection: isReconnection,
            integration_id: integrationId || 'not provided',
          })
        }

        // Try using the direct OAuth callback endpoint instead of the integration endpoint
        if (isDevEnvironment) {
          console.debug(
            `Using ${isReconnection ? 'reconnection' : 'direct OAuth'} callback endpoint`
          )
        }

        // Build URL with query parameters
        const url = new URL(`${env.apiUrl}/slack/oauth-callback`)
        url.searchParams.append('code', code)
        url.searchParams.append('client_id', clientId)
        url.searchParams.append('client_secret', clientSecret)
        url.searchParams.append('redirect_from_frontend', 'true')

        // Add integration ID if this is a reconnection flow
        if (isReconnection && integrationId) {
          url.searchParams.append('integration_id', integrationId)
        }

        // Make direct request to the OAuth callback endpoint
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
          const errorData = await response.json()
          throw new Error(
            errorData.detail || 'Failed to authenticate with Slack'
          )
        }

        const result = await response.json()

        // Check if the OAuth result indicates an error
        if (result.status !== 'success') {
          throw new Error(
            `Failed to connect Slack workspace: ${result.message || 'Unknown error'}`
          )
        }

        // Check if this was a reconnection/update or a new connection
        const wasReconnected =
          sessionStorage.getItem('slack_integration_id') || result.updated

        // Clear sensitive data from session storage
        sessionStorage.removeItem('slack_client_id')
        sessionStorage.removeItem('slack_client_secret')
        sessionStorage.removeItem('slack_integration_name')
        sessionStorage.removeItem('slack_team_id')
        sessionStorage.removeItem('slack_integration_id')

        if (wasReconnected) {
          setStatus('reconnected')
          setSuccessMessage('Slack workspace reconnected successfully!')
        } else {
          setStatus('success')
          setSuccessMessage('Slack workspace connected successfully!')
        }

        // Now manually create the integration with the team ID
        try {
          if (isDevEnvironment) {
            console.debug(
              'Workspace connected successfully, now creating team integration'
            )
          }

          // Import the integration service
          const integrationService = (
            await import('../../lib/integrationService')
          ).default

          // Check if we received the access token from the OAuth response
          if (
            !result.access_token ||
            !result.workspace_id ||
            !result.workspace_name
          ) {
            console.error('Missing required data from OAuth response:', result)
            throw new Error(
              'Incomplete data from OAuth callback. Cannot create integration.'
            )
          }

          // Use the direct integration method without a second OAuth code exchange
          const integrationData = {
            name: integrationName || result.workspace_name,
            service_type: IntegrationType.SLACK,
            team_id: teamId,
            description: `Slack workspace: ${result.workspace_name}`,
            // Set workspace_id directly from the Slack workspace ID
            workspace_id: result.workspace_id,
            metadata: {
              slack_id: result.workspace_id, // Keep for backward compatibility
              domain: result.workspace_domain,
              name: result.workspace_name,
              bot_user_id: result.bot_user_id,
              scope: result.scope,
              access_token: result.access_token,
            },
          }

          console.log('Creating integration with data:', {
            ...integrationData,
            metadata: {
              ...integrationData.metadata,
              access_token: 'REDACTED',
            },
          })

          // Create the integration directly without OAuth
          const integrationResult =
            await integrationService.createIntegration(integrationData)

          if (integrationService.isApiError(integrationResult)) {
            console.error('Error creating integration:', integrationResult)
            throw new Error(
              integrationResult.message || 'Failed to create integration'
            )
          } else {
            console.log('Integration created successfully:', integrationResult)

            // Navigate to integrations list after a short delay
            setTimeout(() => {
              navigate('/dashboard/integrations')
            }, 1000)
          }
        } catch (linkError) {
          console.error('Error linking workspace to team:', linkError)
          // Still consider it a success since the OAuth part worked
          // The user can try linking it to the team again later
        }
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
        sessionStorage.removeItem('slack_integration_id')

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
  }, [searchParams, teamContext.currentTeamId, navigate, isDevEnvironment])

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
    isDevEnvironment,
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

        {(status === 'success' || status === 'reconnected') && (
          <>
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              {status === 'reconnected'
                ? 'Workspace successfully reconnected!'
                : 'Workspace successfully connected!'}
            </Alert>
            <Text>
              {successMessage || 'Redirecting to your integrations...'}
            </Text>
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
