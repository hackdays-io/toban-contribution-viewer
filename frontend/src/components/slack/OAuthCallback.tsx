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
        console.error('API URL is not configured. Please set proper API URL in environment variables.')
        setStatus('error')
        setErrorMessage('API URL not configured. Please check application settings.')
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
          // Forward the code to our backend to exchange it for an access token
          const response = await fetch(
            `${env.apiUrl}/slack/oauth-callback?code=${code}&redirect_from_frontend=true`,
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
            const errorData = await response.json()
            throw new Error(
              errorData.detail || 'Failed to complete OAuth process'
            )
          }

          await response.json()

          setStatus('success')

          // Navigate to workspace list after a short delay
          setTimeout(() => {
            navigate('/dashboard/slack/workspaces')
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
            console.error('Network or CORS error when connecting to backend:', err)
          }

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
    }

    handleCallback()
  }, [searchParams, navigate, isDevEnvironment])

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
