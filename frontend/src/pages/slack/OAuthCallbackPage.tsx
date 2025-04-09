import React from 'react';
import { Box, Heading } from '@chakra-ui/react';
import { OAuthCallback } from '../../components/slack';

/**
 * Page for handling OAuth callback from Slack.
 */
const OAuthCallbackPage: React.FC = () => {
  return (
    <Box p={6}>
      <Heading size="xl" mb={8} textAlign="center">
        Connecting Slack Workspace
      </Heading>
      
      <OAuthCallback />
    </Box>
  );
};

export default OAuthCallbackPage;