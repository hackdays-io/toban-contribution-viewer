import React, { useEffect, useState, useRef } from 'react'
import {
  Box,
  Heading,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  VStack,
} from '@chakra-ui/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import env from '../../config/env'
import useIntegration from '../../context/useIntegration'
import useAuth from '../../context/useAuth'
import { IntegrationType } from '../../lib/integrationService'
import { supabase } from '../../lib/supabase'

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
  const [shouldShowError, setShouldShowError] = useState(false)
  const [integrationCreated, setIntegrationCreated] = useState<string | null>(null)
  
  // Use a timer to delay showing errors, to avoid flashing error messages
  const errorTimerRef = useRef<number | null>(null)
  
  // Use a ref to track if we've already processed the code
  const hasProcessedCode = useRef<boolean>(false)

  // Get the integration context to create a Slack integration
  const { createSlackIntegration } = useIntegration()
  const { teamContext } = useAuth()

  // Check for development environment
  const isDevEnvironment =
    env.isDev ||
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('ngrok')

  // Effect to clean up the timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        window.clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate processing due to StrictMode or rerenders
      if (hasProcessedCode.current || integrationCreated) {
        return
      }

      // Reset error states at the start of processing
      setShouldShowError(false)
      setErrorMessage('')
      
      // No mock data for development
      if (\!env.apiUrl || env.apiUrl === 'your_api_url') {
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
      // Ensure we have a valid auth token before continuing
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (\!session) {
        console.error(
          'No active authentication session found in OAuthCallback\!'
        )
        // Try refreshing the session
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession()

        if (refreshError || \!refreshData.session) {
          console.error(
            'Failed to refresh authentication session:',
            refreshError
          )
          setStatus('error')
          setErrorMessage(
            'Authentication expired. Please log in again and retry.'
          )
          return
        }
      }

      const error = searchParams.get('error')
      if (error) {
        console.error('Error parameter found in callback URL:', error)
        setStatus('error')
        setErrorMessage(`Authorization failed: ${error}`)
        return
      }

      const code = searchParams.get('code')
      if (code) {
        // Mark that we've started processing this code
        hasProcessedCode.current = true

        try {
          // Get client credentials from localStorage
          const clientId = localStorage.getItem('slack_client_id')
          const clientSecret = localStorage.getItem('slack_client_secret')

          if (\!clientId || \!clientSecret) {
            throw new Error(
              'Missing Slack credentials. Please try connecting again.'
            )
          }

          // Get the team ID from localStorage or fall back to the context
          const storedTeamId = localStorage.getItem('slack_team_id')
          const contextTeamId = teamContext?.currentTeamId
          const currentTeamId = storedTeamId || contextTeamId

          if (\!currentTeamId) {
            throw new Error(
              'No team ID found. Please select a team and try again.'
            )
          }

          // Use the current window.location for the redirect URI to maintain protocol, domain, port
          // This needs to match exactly what we sent to Slack in the authorization request
          const callbackUrl = window.location.origin + '/auth/slack/callback'

          // For making cross-origin requests to localhost, we need to be careful with credentials
          const useCredentials = env.apiUrl.startsWith('/') || \!env.apiUrl.includes('localhost')
            
          const integration = await createSlackIntegration({
            team_id: currentTeamId,
            service_type: IntegrationType.SLACK,
            name: 'Slack Integration', // This will be updated with actual workspace name later
            code: code,
            redirect_uri: callbackUrl,
            client_id: clientId,
            client_secret: clientSecret,
          }, useCredentials)

          // If we didn't get an integration, something went wrong
          if (\!integration) {
            throw new Error(
              'Failed to create Slack integration: No response received'
            )
          }

          // The integration response should have an id and a status property
          // Only consider it an error if it has an error or error_message property
          if (
            typeof integration === 'object' &&
            integration \!== null &&
            (
              'error' in integration ||
              'error_message' in integration ||
              'error_detail' in integration
            )
          ) {
            console.error('Integration error:', integration)
            throw new Error(
              integration.message || integration.error_message || 'Failed to create Slack integration'
            )
          }
          
          // Log successful integration creation
          console.log('Successfully created Slack integration, id:', integration.id)
          
          // Clear any error timer
          if (errorTimerRef.current) {
            window.clearTimeout(errorTimerRef.current)
            errorTimerRef.current = null
          }
          
          // Set integration ID to prevent duplicate processing
          setIntegrationCreated(integration.id)
          
          // Set success status and ensure error is not shown
          setStatus('success')
          setShouldShowError(false)

          // Clear credentials from localStorage after successful connection
          localStorage.removeItem('slack_client_id')
          localStorage.removeItem('slack_client_secret')
          localStorage.removeItem('slack_team_id')

          // Get the redirect URL from localStorage or default to integrations page
          const redirectUrl =
            localStorage.getItem('slack_redirect_url') ||
            '/dashboard/integrations'
          localStorage.removeItem('slack_redirect_url')

          // Navigate to the redirect URL after a short delay
          setTimeout(() => {
            navigate(redirectUrl)
          }, 2000)
        } catch (err) {
          console.error('Error connecting to Slack:', err)

          // First, clear any existing error timer
          if (errorTimerRef.current) {
            window.clearTimeout(errorTimerRef.current)
            errorTimerRef.current = null
          }

          // Handle network or backend connectivity issues
          if (
            err instanceof TypeError ||
            (err instanceof Error &&
              (err.message.includes('NetworkError') ||
                err.message.includes('Failed to fetch') ||
                err.message.includes('CORS') ||
                err.message.includes('connection failed') ||
                err.message.includes('Connection refused')))
          ) {
            console.error(
              'Network or CORS error when connecting to backend:',
              err
            )
            
            // Delay showing the error in case a retry succeeds
            errorTimerRef.current = window.setTimeout(() => {
              // Only show error if we haven't created an integration yet
              if (\!integrationCreated) {
                setStatus('error')
                setShouldShowError(true)
                setErrorMessage(
                  'Backend server is not running or not accessible. Please start the backend server and try again.'
                )
              }
            }, 5000); // 5 second delay
            
            return
          }

          // Delay showing general errors as well
          errorTimerRef.current = window.setTimeout(() => {
            // Only show error if we haven't created an integration yet
            if (\!integrationCreated) {
              setStatus('error')
              setShouldShowError(true)
            }
          }, 5000); // 5 second delay

          // Variable to hold the error message
          let displayErrorMessage = 'Failed to connect workspace'
          
          // Clear any existing error messages to prevent flashing
          setErrorMessage('')

          // Check if the error is an ApiError object
          if (
            err &&
            typeof err === 'object' &&
            'status' in err &&
            'message' in err
          ) {
            const apiError = err as { status: number; message: string; details?: Record<string, unknown> }

            if (apiError.status === 503) {
              displayErrorMessage =
                'Backend server is not available. Please make sure the API server is running.'
            } else if (apiError.status === 400) {
              // For 400 errors, show the detail message if available
              if (apiError.details && apiError.details.detail) {
                displayErrorMessage = `API Error: ${apiError.details.detail}`
              } else {
                displayErrorMessage = 
                  `Bad request: ${apiError.message || 'Failed to connect workspace'}`
              }
              console.error('API Error details:', apiError.details)
            } else {
              displayErrorMessage =
                apiError.message || 'Failed to connect workspace'
            }
          }
          // Handle standard errors
          else if (err instanceof Error) {
            console.error('Error details:', err)

            // Shorten and simplify error messages for the user
            if (err.message.includes('invalid_code')) {
              displayErrorMessage =
                'Authentication code expired or invalid. Please try again.'
            } else if (err.message.includes('team')) {
              displayErrorMessage = 'Team issue: ' + err.message
            } else if (err.message.includes('token')) {
              displayErrorMessage = 'Token issue: ' + err.message
            } else if (
              err.message.includes('server') ||
              err.message.includes('connect')
            ) {
              displayErrorMessage =
                'Server connection issue: The backend server appears to be offline or unreachable. Please make sure it is running.'
            } else {
              displayErrorMessage = err.message
            }
          } else if (err) {
            // Handle non-Error objects
            console.error('Non-error object thrown:', typeof err, err)
            displayErrorMessage = String(err)
          }

          // Set the error message state
          setErrorMessage(
            displayErrorMessage ||
              'Unknown error occurred while connecting to Slack'
          )
        }
      } else {
        // No code provided - error condition
        console.error('No authorization code provided in URL parameters')
        setStatus('error')
        setErrorMessage('No authorization code received. Please try again.')
      }
    }

    handleCallback()
  }, [
    searchParams,
    navigate,
    isDevEnvironment,
    createSlackIntegration,
    teamContext,
    integrationCreated
  ])

  // If we have successfully created an integration but status isn't set yet,
  // show success state immediately to avoid flashing error
  const displayStatus = integrationCreated && status === 'loading' ? 'success' : status

  return (
    <Box p={6} maxWidth="600px" mx="auto" textAlign="center">
      <VStack spacing={6}>
        {displayStatus === 'loading' && (
          <>
            <Spinner
              size="xl"
              color="purple.500"
              thickness="4px"
              speed="0.65s"
            />
            <Heading size="lg">Connecting Workspace...</Heading>
            <Text color="gray.600">
              Please wait while we complete the connection process.
            </Text>
          </>
        )}

        {displayStatus === 'success' && (
          <>
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              Workspace successfully connected\!
            </Alert>
            <Text>Redirecting to your workspaces...</Text>
          </>
        )}

        {displayStatus === 'error' && shouldShowError && (
          <>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              Connection failed
            </Alert>
            <Text>{errorMessage}</Text>

            {/* Additional guidance for backend connection issues */}
            {errorMessage.includes('backend') ||
            errorMessage.includes('server') ? (
              <Box mt={4} p={4} bg="gray.50" borderRadius="md">
                <Text fontWeight="bold">Troubleshooting Steps:</Text>
                <Text mt={2}>1. Make sure the backend server is running:</Text>
                <Text
                  as="code"
                  display="block"
                  p={2}
                  bg="gray.100"
                  borderRadius="md"
                  mt={1}
                >
                  cd ../backend
                  <br />
                  uvicorn app.main:app --reload
                </Text>
                <Text mt={2}>2. Verify the API URL in your .env file:</Text>
                <Text
                  as="code"
                  display="block"
                  p={2}
                  bg="gray.100"
                  borderRadius="md"
                  mt={1}
                >
                  VITE_API_URL=/api/v1
                </Text>
                <Text mt={2}>
                  3. Wait a moment and try again after the backend is running.
                </Text>
              </Box>
            ) : (
              <Text mt={4}>
                Please try again or contact support if the problem persists.
              </Text>
            )}
          </>
        )}
      </VStack>
    </Box>
  )
}

export default OAuthCallback
