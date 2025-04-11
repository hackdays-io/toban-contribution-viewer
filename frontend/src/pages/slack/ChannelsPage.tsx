import React from 'react';
import { Box } from '@chakra-ui/react';
import ChannelList from '../../components/slack/ChannelList';

/**
 * Page for viewing and selecting Slack channels for analysis.
 */
const ChannelsPage: React.FC = () => {
  return (
    <Box py={4} px={2}>
      <ChannelList />
    </Box>
  );
};

export default ChannelsPage;