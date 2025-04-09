import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, Spinner, Alert, AlertIcon, VStack } from '@chakra-ui/react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Component to handle the Slack OAuth callback.
 */
const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Extract query parameters
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      
      if (error) {
        setStatus('error');
        setErrorMessage(`Authorization failed: ${error}`);
        return;
      }
      
      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received');
        return;
      }
      
      try {
        // Send code to backend
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/slack/oauth-callback?code=${code}`
        );
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || 'Failed to complete authorization');
        }
        
        const data = await response.json();
        setStatus('success');
        
        // Navigate to workspace list after a short delay
        setTimeout(() => {
          navigate('/dashboard/slack/workspaces');
        }, 2000);
      } catch (error) {
        console.error('Error during OAuth callback:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Authorization failed');
      }
    };
    
    handleCallback();
  }, [searchParams, navigate]);

  return (
    <Box p={6} maxWidth="600px" mx="auto" textAlign="center">
      <VStack spacing={6}>
        {status === 'loading' && (
          <>
            <Spinner size="xl" color="purple.500" thickness="4px" speed="0.65s" />
            <Heading size="lg">Connecting Workspace...</Heading>
            <Text color="gray.600">Please wait while we complete the connection process.</Text>
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
  );
};

export default OAuthCallback;