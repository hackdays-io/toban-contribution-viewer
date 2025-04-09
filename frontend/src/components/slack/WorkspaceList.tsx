import React, { useEffect, useState } from 'react';
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
import { FiPlus, FiTrash2 } from 'react-icons/fi';

interface Workspace {
  id: string;
  slack_id: string;
  name: string;
  domain: string;
  is_connected: boolean;
  connection_status: string;
  last_connected_at: string;
  last_sync_at: string | null;
}

/**
 * Component to display and manage connected Slack workspaces.
 */
const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    try {
      setIsLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/slack/workspaces`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
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
   * Handles disconnecting a workspace.
   */
  const handleDisconnect = async () => {
    if (!selectedWorkspace) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/slack/workspaces/${selectedWorkspace.id}`,
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
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect workspace',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
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
              <HStack mb={2} justify="space-between">
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
              
              <Text color="gray.600" mb={3}>
                {workspace.domain ? `${workspace.domain}.slack.com` : `Workspace ${workspace.slack_id}`}
              </Text>
              
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