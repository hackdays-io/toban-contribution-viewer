import React, { useState } from 'react';
import { Button, Box, Heading, Text, VStack, useToast, Spinner } from '@chakra-ui/react';

/**
 * Component to connect a Slack workspace using OAuth.
 */
const ConnectWorkspace: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  /**
   * Initiates the OAuth flow by redirecting to Slack.
   */
  const connectWorkspace = async () => {
    try {
      setIsLoading(true);
      
      // Get OAuth URL from backend without a redirect URI (let the backend determine it)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/slack/oauth-url`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get Slack authorization URL');
      }
      
      const data = await response.json();
      
      // Redirect to Slack OAuth page
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting workspace:', error);
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