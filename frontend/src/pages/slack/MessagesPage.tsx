import React, { useEffect, useState } from 'react';
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Spinner,
  Flex,
  Button,
  Icon,
  useToast,
} from '@chakra-ui/react';
import { FiChevronRight, FiArrowLeft } from 'react-icons/fi';
import { Link, useParams, useNavigate } from 'react-router-dom';
import MessageList from '../../components/slack/MessageList';

interface Channel {
  id: string;
  name: string;
  type: string;
}

/**
 * Page component to display messages from a Slack channel.
 */
const MessagesPage: React.FC = () => {
  const { workspaceId, channelId } = useParams<{ workspaceId: string; channelId: string }>();
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    // Verify that workspaceId and channelId are defined
    if (!workspaceId || !channelId) {
      toast({
        title: 'Error',
        description: 'Missing workspace or channel ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/dashboard/slack/workspaces');
      return;
    }

    // Fetch workspace and channel data
    fetchWorkspaceAndChannel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, channelId]);

  /**
   * Fetch both workspace and channel data in parallel.
   */
  const fetchWorkspaceAndChannel = async () => {
    try {
      setIsLoading(true);

      // If we need detailed channel info
      const channelResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/channels?id=${channelId}`
      );

      if (!channelResponse.ok) {
        throw new Error('Failed to fetch channel information');
      }

      const channelData = await channelResponse.json();
      const channelInfo = channelData.channels.find((c: Channel) => c.id === channelId) || null;
      setChannel(channelInfo);

      // If we need workspace info
      const workspaceResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}`
      );

      if (!workspaceResponse.ok) {
        throw new Error('Failed to fetch workspace information');
      }

      const workspaceData = await workspaceResponse.json();
      setWorkspaceName(workspaceData.workspace.name || 'Slack Workspace');
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Flex height="100%" justify="center" align="center" p={8}>
        <Spinner size="xl" color="purple.500" thickness="4px" />
      </Flex>
    );
  }

  return (
    <Box p={4}>
      {/* Breadcrumb navigation */}
      <Breadcrumb
        spacing="8px"
        separator={<Icon as={FiChevronRight} color="gray.500" />}
        mb={6}
      >
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard/slack/workspaces">
            Workspaces
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink
            as={Link}
            to={`/dashboard/slack/workspaces/${workspaceId}/channels`}
          >
            {workspaceName}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>
            {channel?.name ? `#${channel.name}` : 'Channel Messages'}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Back button */}
      <Button
        leftIcon={<Icon as={FiArrowLeft} />}
        mb={6}
        onClick={() => navigate(`/dashboard/slack/workspaces/${workspaceId}/channels`)}
        variant="outline"
        colorScheme="purple"
      >
        Back to Channels
      </Button>

      {/* Message list */}
      {workspaceId && channelId && (
        <MessageList
          workspaceId={workspaceId}
          channelId={channelId}
          channelName={channel?.name}
        />
      )}
    </Box>
  );
};

export default MessagesPage;
