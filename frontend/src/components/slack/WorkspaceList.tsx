import React, { useEffect, useState } from 'react';
import env from '../../config/env';
import {
  Box,
  Heading,
  Button,
  Text,
  VStack,
  HStack,
  Spinner,
  useToast,
  Badge,
  Divider,
  SimpleGrid,
  Icon,
  Flex,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiRefreshCw } from 'react-icons/fi';

interface Workspace {
  id: string;
  slack_id: string;
  name: string;
  domain: string;
  is_connected: boolean;
  connection_status: string;
  last_connected_at: string;
  last_sync_at: string | null;
  icon_url?: string;
  team_size?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Component to display and manage connected Slack workspaces.
 */
const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const toast = useToast();

  useEffect(() => {
    fetchWorkspaces();
    // fetchWorkspaces is defined inside the component and doesn't depend on any props or state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fetch connected workspaces from the API.
   */
  const fetchWorkspaces = async () => {
    const isNgrokOrLocalhost = window.location.hostname.includes('ngrok') || 
                               window.location.hostname === 'localhost';
    const isDevelopmentMode = env.isDev || process.env.NODE_ENV === 'development';
    const useDevelopmentWorkaround = isDevelopmentMode && isNgrokOrLocalhost;
    
    try {
      setIsLoading(true);
      
      // For development with ngrok, use a different CORS approach
      if (useDevelopmentWorkaround) {
        console.info('Using development mode CORS workaround for fetching workspaces');
        
        // Check if we're attempting to access localhost from a non-localhost domain
        const isAccessingLocalhost = env.apiUrl.includes('localhost') && window.location.hostname !== 'localhost';
        
        if (isAccessingLocalhost) {
          console.info('CORS workaround: Using mock workspaces data for development');
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Use mock data to prevent CORS errors in development
          const mockWorkspaces = [
            {
              id: 'mock-workspace-id',
              name: 'Mock Slack Workspace',
              team_id: 'T12345',
              team_name: 'Mock Team',
              team_domain: 'mockteam',
              bot_name: 'Toban Bot',
              is_connected: true,
              has_valid_token: true,
              channel_count: 5,
              connected_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
            }
          ];
          
          setWorkspaces(mockWorkspaces);
          return;
        }
      }
      
      // Standard API call
      try {
        const response = await fetch(`${env.apiUrl}/slack/workspaces`);

        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }

        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      } catch (networkError) {
        console.error('Network error fetching workspaces:', networkError);
        
        // If in development mode, provide a fallback
        if (useDevelopmentWorkaround) {
          console.info('CORS or network error in development mode. Using mock workspaces data.');
          
          // Use mock data to prevent CORS errors in development
          const mockWorkspaces = [
            {
              id: 'mock-workspace-id',
              name: 'Mock Slack Workspace',
              team_id: 'T12345',
              team_name: 'Mock Team',
              team_domain: 'mockteam',
              bot_name: 'Toban Bot',
              is_connected: true,
              has_valid_token: true,
              channel_count: 5,
              connected_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
            }
          ];
          
          setWorkspaces(mockWorkspaces);
          
          toast({
            title: 'Development Mode',
            description: 'Using mock workspace data due to CORS/network issues with localhost API.',
            status: 'info',
            duration: 5000,
            isClosable: true,
          });
          return;
        }
        
        // Otherwise show the error in production
        throw networkError;
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connected workspaces',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify a workspace token and refresh its metadata.
   */
  const refreshWorkspace = async (workspaceId: string) => {
    setIsRefreshing(workspaceId);
    
    const isNgrokOrLocalhost = window.location.hostname.includes('ngrok') || 
                             window.location.hostname === 'localhost';
    const isDevelopmentMode = env.isDev || process.env.NODE_ENV === 'development';
    const useDevelopmentWorkaround = isDevelopmentMode && isNgrokOrLocalhost;

    try {
      // For development with ngrok, check if we're trying to access localhost
      if (useDevelopmentWorkaround && env.apiUrl.includes('localhost') && 
          window.location.hostname !== 'localhost') {
        console.info('Using development mode CORS workaround for refreshing workspace');
          
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        toast({
          title: 'Development Mode',
          description: 'Workspace connection verified (mock)',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Refresh the workspace list with our mocks
        fetchWorkspaces();
        return;
      }
      
      // Standard API call
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/verify`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to verify workspace');
      }

      const data = await response.json();

      toast({
        title: 'Workspace Refreshed',
        description: data.message || 'Workspace metadata refreshed successfully',
        status: data.status === 'success' ? 'success' : 'warning',
        duration: 5000,
        isClosable: true,
      });

      // Refresh the workspace list
      fetchWorkspaces();
    } catch (error) {
      console.error('Error refreshing workspace:', error);
      
      // If network error in development mode, provide a fallback
      if (error instanceof Error && 
          (error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError') || 
           error.message.includes('CORS')) && 
          useDevelopmentWorkaround) {
        
        console.info('CORS or network error in development mode. Using mock refresh response.');
        
        toast({
          title: 'Development Mode',
          description: 'Workspace connection verified (mock)',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Refresh the workspace list with our mocks
        fetchWorkspaces();
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to refresh workspace',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setIsRefreshing(null);
    }
  };

  /**
   * Handles disconnecting a workspace.
   */
  const handleDisconnect = async () => {
    if (!selectedWorkspace) return;

    const isNgrokOrLocalhost = window.location.hostname.includes('ngrok') || 
                            window.location.hostname === 'localhost';
    const isDevelopmentMode = env.isDev || process.env.NODE_ENV === 'development';
    const useDevelopmentWorkaround = isDevelopmentMode && isNgrokOrLocalhost;

    try {
      // For development with ngrok, check if we're trying to access localhost
      if (useDevelopmentWorkaround && env.apiUrl.includes('localhost') && 
          window.location.hostname !== 'localhost') {
        console.info('Using development mode CORS workaround for disconnecting workspace');
          
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        toast({
          title: 'Development Mode',
          description: 'Workspace disconnected successfully (mock)',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Refresh the workspace list with our mocks (will show empty list since we "disconnected")
        setWorkspaces([]);
        onClose();
        return;
      }
      
      // Standard API call
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${selectedWorkspace.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to disconnect workspace');
      }

      toast({
        title: 'Workspace Disconnected',
        description: `${selectedWorkspace.name} has been disconnected successfully.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh the list
      fetchWorkspaces();
    } catch (error) {
      console.error('Error disconnecting workspace:', error);
      
      // If network error in development mode, provide a fallback
      if (error instanceof Error && 
          (error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError') || 
           error.message.includes('CORS')) && 
          useDevelopmentWorkaround) {
        
        console.info('CORS or network error in development mode. Using mock disconnect flow.');
        
        toast({
          title: 'Development Mode',
          description: 'Workspace disconnected successfully (mock)',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Remove the workspace from the list
        setWorkspaces([]);
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to disconnect workspace',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      onClose();
    }
  };

  /**
   * Opens the disconnect confirmation dialog.
   */
  const confirmDisconnect = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    onOpen();
  };

  return (
    <Box p={6} width="100%" maxWidth="900px" mx="auto">
      <HStack justifyContent="space-between" mb={6}>
        <Heading size="lg">Slack Workspaces</Heading>
        <Button
          as={Link}
          to="/dashboard/slack/connect"
          leftIcon={<Icon as={FiPlus} />}
          colorScheme="purple"
        >
          Connect Workspace
        </Button>
      </HStack>

      <Divider mb={6} />

      {isLoading ? (
        <Flex justify="center" align="center" minHeight="200px">
          <Spinner size="xl" color="purple.500" thickness="4px" />
        </Flex>
      ) : workspaces.length === 0 ? (
        <Box
          p={8}
          borderWidth="1px"
          borderRadius="lg"
          textAlign="center"
          bg="gray.50"
        >
          <Text fontSize="lg" mb={4}>
            No workspaces connected yet
          </Text>
          <Button
            as={Link}
            to="/dashboard/slack/connect"
            colorScheme="purple"
            leftIcon={<Icon as={FiPlus} />}
          >
            Connect Your First Workspace
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {workspaces.map((workspace) => (
            <Box
              key={workspace.id}
              p={5}
              borderWidth="1px"
              borderRadius="lg"
              position="relative"
            >
              <HStack mb={3} spacing={4} align="start">
                {workspace.icon_url ? (
                  <Box
                    width="48px"
                    height="48px"
                    borderRadius="md"
                    overflow="hidden"
                    flexShrink={0}
                  >
                    <img
                      src={workspace.icon_url}
                      alt={`${workspace.name} icon`}
                      width="100%"
                      height="100%"
                      style={{ objectFit: 'cover' }}
                      onError={(e) => {
                        // If image fails to load, replace with fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        // Force re-render to show fallback
                        if (target.parentElement) {
                          const fallback = document.createElement('div');
                          fallback.style.width = '100%';
                          fallback.style.height = '100%';
                          fallback.style.backgroundColor = '#E9D8FD'; // purple.100
                          fallback.style.color = '#805AD5'; // purple.600
                          fallback.style.display = 'flex';
                          fallback.style.alignItems = 'center';
                          fallback.style.justifyContent = 'center';
                          fallback.style.fontSize = '1.25rem';
                          fallback.style.fontWeight = 'bold';
                          fallback.innerText = workspace.name.charAt(0).toUpperCase();
                          target.parentElement.appendChild(fallback);
                        }
                      }}
                    />
                  </Box>
                ) : (
                  <Box
                    width="48px"
                    height="48px"
                    borderRadius="md"
                    bg="purple.100"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color="purple.600"
                    fontSize="xl"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    {workspace.name.charAt(0).toUpperCase()}
                  </Box>
                )}

                <Box flex="1">
                  <HStack mb={1} justify="space-between">
                    <Heading size="md">{workspace.name}</Heading>
                    <Badge
                      colorScheme={
                        workspace.is_connected
                          ? 'green'
                          : workspace.connection_status === 'error'
                          ? 'red'
                          : 'yellow'
                      }
                    >
                      {workspace.is_connected
                        ? 'Connected'
                        : workspace.connection_status === 'error'
                        ? 'Error'
                        : 'Disconnected'}
                    </Badge>
                  </HStack>

                  <Text color="gray.600" mb={1}>
                    {workspace.domain ? `${workspace.domain}.slack.com` : `Workspace ${workspace.slack_id}`}
                  </Text>

                  {workspace.team_size && (
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      Team size: {workspace.team_size} members
                    </Text>
                  )}
                </Box>
              </HStack>

              <VStack align="start" spacing={1} mb={4}>
                <Text fontSize="sm" color="gray.600">
                  Connected: {new Date(workspace.last_connected_at).toLocaleString()}
                </Text>
                {workspace.last_sync_at && (
                  <Text fontSize="sm" color="gray.600">
                    Last sync: {new Date(workspace.last_sync_at).toLocaleString()}
                  </Text>
                )}
              </VStack>

              <HStack spacing={4} mt={4}>
                <Button
                  size="sm"
                  variant="solid"
                  colorScheme="purple"
                  as={Link}
                  to={`/dashboard/slack/workspaces/${workspace.id}/channels`}
                >
                  Select Channels
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="purple"
                  leftIcon={<Icon as={FiRefreshCw} />}
                  isLoading={isRefreshing === workspace.id}
                  onClick={() => refreshWorkspace(workspace.id)}
                >
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="red"
                  leftIcon={<Icon as={FiTrash2} />}
                  onClick={() => confirmDisconnect(workspace)}
                >
                  Disconnect
                </Button>
              </HStack>
            </Box>
          ))}
        </SimpleGrid>
      )}

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Disconnect Workspace
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to disconnect{' '}
              <Text as="span" fontWeight="bold">
                {selectedWorkspace?.name}
              </Text>
              ? This will remove access to the workspace data.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDisconnect} ml={3}>
                Disconnect
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default WorkspaceList;
