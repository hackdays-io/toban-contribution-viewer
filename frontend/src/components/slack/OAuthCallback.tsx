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

  // Get the integration context to create a Slack integration
  const { createSlackIntegration } = useIntegration()
  const { teamContext } = useAuth()

  // Check for development environment
  const isDevEnvironment =
    env.isDev ||
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('ngrok')

  useEffect(() => {
    const handleCallback = async () => {
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
      // Log all URL parameters for debugging
      console.log('All URL parameters in OAuth callback:', Object.fromEntries(searchParams.entries()))
      
      // Ensure we have a valid auth token before continuing
      console.log('Verifying authentication in OAuthCallback component...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active authentication session found in OAuthCallback!');
        
        // Try refreshing the session
        console.log('Attempting to refresh authentication session...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('Failed to refresh authentication session:', refreshError);
          setStatus('error');
          setErrorMessage('Authentication expired. Please log in again and retry.');
          return;
        } else {
          console.log('Successfully refreshed authentication session');
        }
      } else {
        console.log('Found valid authentication session in OAuthCallback');
      }
      
      const error = searchParams.get('error')
      if (error) {
        console.log('Error parameter found in callback URL:', error)
        setStatus('error')
        setErrorMessage(`Authorization failed: ${error}`)
        return
      }

      const code = searchParams.get('code')
      if (code) {
        console.log('Found authorization code in URL parameters:', code.substring(0, 5) + '...')
        // Mark that we've started processing this code
        hasProcessedCode.current = true

        try {
          // Get client credentials from localStorage
          const clientId = localStorage.getItem('slack_client_id')
          const clientSecret = localStorage.getItem('slack_client_secret')
          console.log('Retrieved credentials from localStorage - clientId exists:', !!clientId, 'clientSecret exists:', !!clientSecret)

          if (!clientId || !clientSecret) {
            throw new Error(
              'Missing Slack credentials. Please try connecting again.'
            )
          }
          
          // Log localStorage contents for debugging
          console.log('All Slack-related localStorage items:', {
            slack_client_id: localStorage.getItem('slack_client_id')?.substring(0, 5) + '...',
            slack_client_secret: localStorage.getItem('slack_client_secret') ? '(exists)' : '(missing)',
            slack_team_id: localStorage.getItem('slack_team_id'),
            slack_redirect_url: localStorage.getItem('slack_redirect_url'),
            currentTeamId: localStorage.getItem('currentTeamId')
          })

          // Get the team ID from localStorage or fall back to the context
          const storedTeamId = localStorage.getItem('slack_team_id')
          const contextTeamId = teamContext?.currentTeamId
          const currentTeamId = storedTeamId || contextTeamId
          
          console.log('Team ID determination - from localStorage:', storedTeamId, 'from context:', contextTeamId, 'using:', currentTeamId)

          if (!currentTeamId) {
            throw new Error(
              'No team ID found. Please select a team and try again.'
            )
          }

          // Create an integration using the Integration API
          console.log('Creating integration with team ID:', currentTeamId)

          // Check authentication state before making the request
          console.log('Checking auth state before integration request...');
          try {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('Auth session before integration request:', !!session);
            if (session) {
              console.log('User email:', session.user?.email);
              console.log('Auth valid:', new Date(session.expires_at * 1000) > new Date());
            } else {
              console.error('No active session found before integration request!');
              // Try to refresh the session
              console.log('Attempting to refresh auth session...');
              const { data: refreshResult } = await supabase.auth.refreshSession();
              console.log('Session refresh result:', !!refreshResult.session);
            }
          } catch (authError) {
            console.error('Error checking auth state:', authError);
          }

          // Use the original window.location.origin for the redirect URI
          const callbackUrl = window.location.origin + '/auth/slack/callback'
          console.log('Callback URL set to:', callbackUrl, 'window.location:', window.location.toString())

          console.log('Sending integration request with params:', {
            team_id: currentTeamId,
            service_type: IntegrationType.SLACK,
            redirect_uri: callbackUrl,
            // Omitting sensitive data from logs
          })

          const integration = await createSlackIntegration({
            team_id: currentTeamId,
            service_type: IntegrationType.SLACK,
            name: 'Slack Integration', // This will be updated with actual workspace name later
            code: code,
            redirect_uri: callbackUrl,
            client_id: clientId,
            client_secret: clientSecret,
          })

          console.log('Integration result:', integration)
          console.log(
            'Integration result type:',
            integration ? typeof integration : 'null'
          )
          console.log('Integration result content:', integration ? JSON.stringify(integration).substring(0, 150) + '...' : 'null')
          
          // Additional debugging for integration response
          if (!integration) {
            console.error('Integration is null or undefined - checking teamContext:', teamContext);
            console.error('Integration creation failed with no response - localStorage contains:', 
              Object.keys(localStorage).filter(key => key.includes('slack') || key.includes('team')).map(key => `${key}: ${localStorage.getItem(key)}`));
          }

          // Check if the integration was created successfully
          if (!integration) {
            throw new Error(
              'Failed to create Slack integration: No response received'
            )
          }

          // If the integration has a status property, it's an error
          if (
            typeof integration === 'object' &&
            integration !== null &&
            'status' in integration
          ) {
            console.error('Integration error:', integration)
            throw new Error(
              integration.message || 'Failed to create Slack integration'
            )
          }

          setStatus('success')

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
            setStatus('error')
            setErrorMessage(
              'Backend server is not running or not accessible. Please start the backend server and try again.'
            )
            return
          }

          setStatus('error')

          // Variable to hold the error message
          let displayErrorMessage = 'Failed to connect workspace'

          // Check if the error is an ApiError object
          if (
            err &&
            typeof err === 'object' &&
            'status' in err &&
            'message' in err
          ) {
            const apiError = err as { status: number; message: string }

            if (apiError.status === 503) {
              displayErrorMessage =
                'Backend server is not available. Please make sure the API server is running.'
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
            <Heading size="lg">Connecting Workspace...</Heading>
            <Text color="gray.600">
              Please wait while we complete the connection process.
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              Workspace successfully connected!
            </Alert>
            <Text>Redirecting to your workspaces...</Text>
          </>
        )}

        {status === 'error' && (
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
