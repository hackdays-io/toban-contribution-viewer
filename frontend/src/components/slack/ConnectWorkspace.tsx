import React, { useState, useEffect } from 'react';
import { Button, Box, Heading, Text, VStack, useToast, Spinner, Alert, AlertIcon } from '@chakra-ui/react';
import env from '../../config/env';

/**
 * Component to connect a Slack workspace using OAuth.
 */
const ConnectWorkspace: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [corsDebugInfo, setCorsDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [corsError, setCorsError] = useState(false);
  const toast = useToast();

  // Check if we're in a CORS-problematic environment
  const isNgrokOrRemote = window.location.hostname.includes('ngrok') ||
                          (!window.location.hostname.includes('localhost') &&
                           env.apiUrl.includes('localhost'));

  // Fetch CORS debug info when in ngrok environment
  useEffect(() => {
    if (isNgrokOrRemote) {
      checkCorsDebug();
    }
  }, [isNgrokOrRemote]);

  // Function to check CORS debug endpoint
  const checkCorsDebug = async () => {
    try {
      const response = await fetch(`${env.apiUrl.split('/api/v1')[0]}/cors-debug`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCorsDebugInfo(data);
        setShowDebugInfo(true);
      }
    } catch (error) {
      console.error('Error fetching CORS debug info:', error);
      // If we can't reach the CORS debug endpoint, this is likely a CORS issue
      setCorsError(true);
    }
  };

  /**
   * Initiates the OAuth flow by redirecting to Slack.
   */
  const connectWorkspace = async () => {
    try {
      setIsLoading(true);

      // Get OAuth URL from backend with explicit CORS headers
      const response = await fetch(`${env.apiUrl}/slack/oauth-url`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get Slack authorization URL');
      }

      const data = await response.json();

      // Redirect to Slack OAuth page
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting workspace:', error);
      
      // Check if this is likely a CORS error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCorsError = errorMessage.includes('NetworkError') || 
                         errorMessage.includes('Failed to fetch') ||
                         errorMessage.includes('CORS');
      
      if (isCorsError && isNgrokOrRemote) {
        setCorsError(true);
      }
      
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to connect to Slack',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
    }
  };

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg" width="100%" maxWidth="600px" mx="auto">
      <VStack spacing={6} align="flex-start">
        <Heading size="lg">Connect Slack Workspace</Heading>

        {corsError && (
          <Alert status="warning" mb={6}>
            <AlertIcon />
            <VStack align="start" spacing={2} width="100%">
              <Text fontWeight="bold">CORS Error Detected</Text>
              <Text>
                Unable to connect to the API due to browser security restrictions (CORS).
                This commonly happens when accessing the app through ngrok while the API is running on localhost.
              </Text>
              <Text fontWeight="bold">Try one of these solutions:</Text>
              <Text>1. Run the frontend directly on localhost</Text>
              <Text>2. Run the backend on a public URL</Text>
              <Text>3. Configure the backend to accept requests from {window.location.origin}</Text>
              <Button size="sm" colorScheme="blue" onClick={checkCorsDebug} mt={2}>
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
              <Text>Frontend URL: {corsDebugInfo.frontend_url || 'Not set'}</Text>
              <Text>Debug Mode: {corsDebugInfo.debug_mode ? 'Enabled' : 'Disabled'}</Text>
              <Text fontWeight="bold">Allowed Origins:</Text>
              <Box p={2} bg="gray.50" borderRadius="md" width="100%" overflow="auto">
                <pre style={{ fontSize: '0.8em' }}>
                  {JSON.stringify(corsDebugInfo.allowed_origins, null, 2)}
                </pre>
              </Box>
              <Button size="sm" colorScheme="blue" onClick={() => setShowDebugInfo(false)} mt={2}>
                Hide Debug Info
              </Button>
            </VStack>
          </Alert>
        )}

        <Text>
          Connect your Slack workspace to analyze team contributions and communication patterns.
          This will allow us to collect message data, reactions, and user information.
        </Text>

        <Text fontWeight="bold">
          We'll need the following permissions:
        </Text>

        <VStack align="flex-start" spacing={1} pl={4}>
          <Text>• Access to public and private channels</Text>
          <Text>• Access to message history</Text>
          <Text>• View reactions to messages</Text>
          <Text>• View basic user information</Text>
        </VStack>

        <Text>
          We respect your privacy and will only collect the data necessary for contribution analysis.
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
  );
};

export default ConnectWorkspace;
