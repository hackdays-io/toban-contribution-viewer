import React, { useEffect, useState } from 'react';
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
  Card,
  CardHeader,
  CardBody,
  Select,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { FiChevronRight, FiArrowLeft, FiBarChart2, FiUsers, FiMessageSquare, FiTrendingUp } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import env from '../../config/env';

interface Workspace {
  id: string;
  name: string;
  slack_id: string;
  domain?: string;
  is_connected: boolean;
  connection_status: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  is_archived: boolean;
  num_members?: number;
  topic?: string;
  purpose?: string;
}

/**
 * Page component for Slack analytics features.
 */
const AnalyticsPage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [hasWorkspaces, setHasWorkspaces] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // Fetch workspaces on component mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Fetch channels when workspace is selected
  useEffect(() => {
    if (selectedWorkspace) {
      fetchChannels(selectedWorkspace);
    } else {
      setChannels([]);
    }
  }, [selectedWorkspace]);

  /**
   * Fetch Slack workspaces from the API.
   */
  const fetchWorkspaces = async () => {
    try {
      setIsLoadingWorkspaces(true);
      const response = await fetch(`${env.apiUrl}/slack/workspaces`);
      
      if (!response.ok) {
        throw new Error(`Error fetching workspaces: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
      setHasWorkspaces(data.workspaces && data.workspaces.length > 0);
      
      // Set the first workspace as selected if available
      if (data.workspaces && data.workspaces.length > 0) {
        setSelectedWorkspace(data.workspaces[0].id);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Slack workspaces',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  /**
   * Fetch channels for a specific workspace.
   */
  const fetchChannels = async (workspaceId: string) => {
    try {
      setIsLoadingChannels(true);
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels`
      );
      
      if (!response.ok) {
        throw new Error(`Error fetching channels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      // Filter out archived channels
      const activeChannels = (data.channels || []).filter(
        (channel: Channel) => !channel.is_archived
      );
      setChannels(activeChannels);
      
      // Set the first channel as selected if available
      if (activeChannels.length > 0) {
        setSelectedChannel(activeChannels[0].id);
      } else {
        setSelectedChannel('');
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Slack channels',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingChannels(false);
    }
  };

  /**
   * Handle channel analysis selection.
   */
  const handleAnalyzeChannel = () => {
    if (selectedWorkspace && selectedChannel) {
      navigate(`/dashboard/analytics/slack/channels/${selectedWorkspace}/${selectedChannel}/analyze`);
    } else {
      toast({
        title: 'Selection Required',
        description: 'Please select both a workspace and a channel to analyze',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Render the workspace and channel selection form.
   */
  const renderSelectionForm = () => {
    return (
      <Box p={6} borderWidth="1px" borderRadius="lg" bg="white">
        <Heading size="md" mb={4}>
          Select a channel to analyze
        </Heading>
        
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={6}>
          <FormControl>
            <FormLabel>Workspace</FormLabel>
            <Select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              placeholder="Select workspace"
              isDisabled={isLoadingWorkspaces || workspaces.length === 0}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </FormControl>
          
          <FormControl>
            <FormLabel>Channel</FormLabel>
            <Select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              placeholder="Select channel"
              isDisabled={isLoadingChannels || channels.length === 0 || !selectedWorkspace}
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </Select>
          </FormControl>
        </SimpleGrid>
        
        <Button
          colorScheme="purple"
          onClick={handleAnalyzeChannel}
          isDisabled={!selectedWorkspace || !selectedChannel}
          leftIcon={<Icon as={FiBarChart2} />}
        >
          Analyze Channel
        </Button>
      </Box>
    );
  };

  /**
   * Render analytics feature cards.
   */
  const renderFeatureCards = () => {
    return (
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
        <Card>
          <CardHeader>
            <HStack>
              <Icon as={FiMessageSquare} color="purple.500" boxSize={5} />
              <Heading size="md">Channel Analysis</Heading>
            </HStack>
          </CardHeader>
          <CardBody>
            <Text mb={4}>
              Get AI-powered insights about communication patterns, topic discussions,
              and contributor engagement in your Slack channels.
            </Text>
            <Text fontSize="sm" color="gray.600">
              • Channel summary and purpose identification
            </Text>
            <Text fontSize="sm" color="gray.600">
              • Main discussion topics and trends
            </Text>
            <Text fontSize="sm" color="gray.600">
              • Key contributor insights and participation patterns
            </Text>
            <Text fontSize="sm" color="gray.600">
              • Highlights of important conversations
            </Text>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <HStack>
              <Icon as={FiUsers} color="purple.500" boxSize={5} />
              <Heading size="md">Contributor Analysis</Heading>
            </HStack>
          </CardHeader>
          <CardBody>
            <Text mb={4}>
              Understand team member participation and contribution patterns 
              across channels and conversations.
            </Text>
            <Text fontSize="sm" color="gray.500">Coming soon</Text>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <HStack>
              <Icon as={FiTrendingUp} color="purple.500" boxSize={5} />
              <Heading size="md">Activity Trends</Heading>
            </HStack>
          </CardHeader>
          <CardBody>
            <Text mb={4}>
              Track changes in communication patterns, engagement levels,
              and discussion topics over time.
            </Text>
            <Text fontSize="sm" color="gray.500">Coming soon</Text>
          </CardBody>
        </Card>
      </SimpleGrid>
    );
  };

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
          <BreadcrumbLink as={Link} to="/dashboard/analytics">
            Analytics
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Slack Analytics</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Back button */}
      <Button
        leftIcon={<Icon as={FiArrowLeft} />}
        mb={6}
        onClick={() => navigate('/dashboard/analytics')}
        variant="outline"
        colorScheme="purple"
      >
        Back to Analytics
      </Button>

      <Heading as="h1" size="xl" mb={6}>
        Slack Analytics
      </Heading>

      {/* Loading state */}
      {isLoadingWorkspaces ? (
        <Flex height="200px" justify="center" align="center">
          <Spinner size="xl" color="purple.500" thickness="4px" />
        </Flex>
      ) : !hasWorkspaces ? (
        <Alert status="info" mb={6} borderRadius="md">
          <AlertIcon />
          <Box>
            <Text mb={2}>No Slack workspaces found.</Text>
            <Button
              as={Link}
              to="/dashboard/slack/connect"
              colorScheme="purple"
              size="sm"
            >
              Connect a Slack Workspace
            </Button>
          </Box>
        </Alert>
      ) : (
        <>
          {/* Analytics feature cards */}
          {renderFeatureCards()}
          
          {/* Workspace and channel selection */}
          {renderSelectionForm()}
        </>
      )}
    </Box>
  );
};

export default AnalyticsPage;
