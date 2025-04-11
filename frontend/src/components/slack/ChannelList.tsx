import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
  Badge,
  Divider,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { FiSearch, FiRefreshCw, FiCheck, FiAlertTriangle, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { Link, useParams, useNavigate } from 'react-router-dom';

// Define types
interface Channel {
  id: string;
  slack_id: string;
  name: string;
  type: string;
  purpose: string;
  topic: string;
  member_count: number;
  is_archived: boolean;
  is_bot_member: boolean;
  is_selected_for_analysis: boolean;
  is_supported: boolean;
  last_sync_at: string | null;
}

interface PaginationInfo {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

interface ChannelResponse {
  channels: Channel[];
  pagination: PaginationInfo;
}

// Interface is used in syncChannels function when parsing API response

/**
 * Component to display and select Slack channels for analysis.
 */
const ChannelList: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  // State for channels and loading
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    page_size: 50,
    total_items: 0,
    total_pages: 0,
  });

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<{
    is_syncing: boolean;
    workspace_status: string;
    channel_count: number;
    last_channel_sync: string | null;
    last_workspace_sync: string | null;
    sync_time: string;
  } | null>(null);

  // Alert dialog for insufficient permissions
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Fetch channels when component loads or filters change
  useEffect(() => {
    fetchChannels();
  }, [pagination.page, typeFilter, includeArchived, workspaceId]);

  // Function to check sync status
  const checkSyncStatus = async () => {
    if (!workspaceId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/sync-status`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      const previousStatus = syncStatus;
      setSyncStatus(data);

      console.log("Sync status check:", data.is_syncing ? "SYNCING" : "NOT SYNCING",
        "Workspace status:", data.workspace_status,
        "Channel count:", data.channel_count);

      // Detect sync state changes
      if (data.is_syncing) {
        // If we're syncing, update UI and poll again
        setTimeout(checkSyncStatus, 5000);
        if (!isSyncing) {
          setIsSyncing(true);
        }
      } else {
        // If sync has completed (we were syncing but now we're not)
        const wasSyncing = isSyncing || (previousStatus && previousStatus.is_syncing);

        if (wasSyncing) {
          // Reset syncing state
          setIsSyncing(false);

          // Refresh the channel list
          await fetchChannels();

          // Show completion notification
          toast({
            title: 'Channel Sync Completed',
            description: `Successfully synced ${data.channel_count} channels.`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        } else {
          // Not syncing, just update state silently
          setIsSyncing(false);
        }
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      // On error, reset syncing state to be safe
      setIsSyncing(false);
    }
  };

  // Check sync status on load and when syncing status changes
  useEffect(() => {
    checkSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, fetchChannels]);

  // Convert type filter to API parameter
  const getTypeFilters = (): string[] | null => {
    switch(typeFilter) {
      case 'public':
        return ['public'];
      case 'private':
        return ['private'];
      case 'direct':
        return ['im', 'mpim'];
      case 'all':
      default:
        return null;
    }
  };

  /**
   * Fetch channels from the API
   */
  const fetchChannels = async () => {
    if (!workspaceId) return;

    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        include_archived: includeArchived.toString(),
      });

      const typeFilters = getTypeFilters();
      if (typeFilters) {
        typeFilters.forEach(type => queryParams.append('types', type));
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/channels?${queryParams}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }

      const data: ChannelResponse = await response.json();
      setChannels(data.channels);
      setPagination(data.pagination);

      // Initialize selected channels from those marked in the API
      const preselected = data.channels
        .filter(channel => channel.is_selected_for_analysis)
        .map(channel => channel.id);

      if (pagination.page === 1) {
        setSelectedChannels(preselected);
      } else {
        // When paginating, merge with existing selections
        setSelectedChannels(prev => {
          const newSelections = [...prev];
          preselected.forEach(id => {
            if (!newSelections.includes(id)) {
              newSelections.push(id);
            }
          });
          return newSelections;
        });
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load channels',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sync channels from Slack API with background processing and polling
   */
  const syncChannels = async () => {
    if (!workspaceId) return;

    setIsSyncing(true);

    try {
      // Show initial toast to indicate sync started
      toast({
        title: 'Syncing Channels',
        description: 'Starting channel synchronization. This may take several minutes for large workspaces.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });

      // Use query parameters for the endpoint
      const queryParams = new URLSearchParams({
        limit: '1000', // Maximum limit for efficiency
        sync_all_pages: '1', // Use 1 instead of true
        batch_size: '200', // Process in batches of 200 channels
      });

      // Start the background sync process
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/channels/sync?${queryParams}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.detail && errorData.detail.includes('missing_scope')) {
          throw new Error('Missing permissions. Your Slack app may need additional scopes like channels:read, groups:read, im:read, mpim:read');
        } else {
          throw new Error(errorData.detail || 'Failed to sync channels');
        }
      }

      const data = await response.json();

      // Show a toast indicating background processing started
      toast({
        title: 'Channel Sync Started',
        description: data.message || 'Channel synchronization is running in the background. The page will refresh periodically to show updated results.',
        status: 'info',
        duration: 7000,
        isClosable: true,
      });

      // Start checking sync status instead of simple polling
      checkSyncStatus();

      // Don't set isSyncing to false here, as we want to keep the syncing indicator
      // while the background process and polling are running

    } catch (error) {
      console.error('Error syncing channels:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync channels',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsSyncing(false);
    }
  };

  /**
   * Save selected channels for analysis
   */
  const saveSelectedChannels = async () => {
    if (!workspaceId) return;

    // Check if any selected channels don't have bot membership
    const nonMemberChannels = channels.filter(
      channel => selectedChannels.includes(channel.id) && !channel.is_bot_member
    );

    if (nonMemberChannels.length > 0) {
      onOpen(); // Open alert dialog
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/channels/select`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel_ids: selectedChannels,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save channel selection');
      }

      const data = await response.json();

      toast({
        title: 'Channels Selected',
        description: `Selected ${data.selected_count} channels for analysis`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Navigate to the next step
      navigate(`/dashboard/slack/workspaces/${workspaceId}`);
    } catch (error) {
      console.error('Error saving channel selection:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save channel selection',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle channel selection
   */
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  /**
   * Handle bulk selection
   */
  const handleSelectAll = (select: boolean) => {
    if (select) {
      // Only select visible channels on this page that are supported and have bot membership
      const selectableChannels = channels
        .filter(channel => channel.is_supported && channel.is_bot_member)
        .map(channel => channel.id);

      setSelectedChannels(prev => {
        const newSelection = [...prev];
        selectableChannels.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    } else {
      // Unselect all visible channels on this page
      const currentPageIds = channels.map(channel => channel.id);
      setSelectedChannels(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  /**
   * Filter channels by search term
   */
  const filteredChannels = channels.filter(channel => {
    if (searchTerm === '') return true;
    return channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           channel.purpose.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /**
   * Change page
   */
  const changePage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination({
        ...pagination,
        page: newPage,
      });
    }
  };

  /**
   * Format channel type for display
   */
  const formatChannelType = (type: string): string => {
    switch(type) {
      case 'public':
        return 'Public';
      case 'private':
        return 'Private';
      case 'im':
        return 'Direct Message';
      case 'mpim':
        return 'Group Message';
      default:
        return type;
    }
  };

  /**
   * Get color for channel type badge
   */
  const getChannelTypeColor = (type: string): string => {
    switch(type) {
      case 'public':
        return 'green';
      case 'private':
        return 'purple';
      case 'im':
      case 'mpim':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Box p={6} maxWidth="1200px" mx="auto">
      <HStack justifyContent="space-between" mb={6}>
        <Heading size="lg">Select Channels for Analysis</Heading>
        <Button
          as={Link}
          to={`/dashboard/slack/workspaces/${workspaceId}`}
          variant="outline"
        >
          Back to Workspace
        </Button>
      </HStack>

      <Divider mb={6} />

      {/* Filters and controls */}
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        mb={6}
        gap={4}
      >
        <HStack flex="2">
          <InputGroup maxW="400px">
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          <Select
            maxW="180px"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="direct">Direct Messages</option>
          </Select>

          <Checkbox
            isChecked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          >
            Include Archived
          </Checkbox>
        </HStack>

        <HStack flex="1" justify="flex-end" spacing={2}>
          <Button
            leftIcon={<Icon as={FiRefreshCw} />}
            colorScheme="purple"
            variant="outline"
            onClick={syncChannels}
            isLoading={isSyncing}
            loadingText="Syncing..."
          >
            Sync Channels
          </Button>
          <Button
            variant="ghost"
            onClick={() => fetchChannels()}
            isLoading={isLoading}
            title="Refresh channel list"
            aria-label="Refresh channel list"
          >
            <Icon as={FiRefreshCw} />
          </Button>
        </HStack>
      </Flex>

      {/* Channels table */}
      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
                  <Th width="50px">
                    <Checkbox
                      isChecked={filteredChannels.length > 0 && filteredChannels.every(channel =>
                        selectedChannels.includes(channel.id) || !channel.is_bot_member
                      )}
                      isIndeterminate={
                        filteredChannels.some(channel => selectedChannels.includes(channel.id)) &&
                        !filteredChannels.every(channel => selectedChannels.includes(channel.id) || !channel.is_bot_member)
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Purpose</Th>
                  <Th>Members</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={8}>
                      <Spinner size="md" color="purple.500" />
                    </Td>
                  </Tr>
                ) : filteredChannels.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={8}>
                      <VStack spacing={4}>
                        <Text color="gray.500">No channels found. You may need to sync channels from Slack first.</Text>
                        <Button
                          colorScheme="purple"
                          size="sm"
                          onClick={syncChannels}
                          isLoading={isSyncing}
                          leftIcon={<Icon as={FiRefreshCw} />}
                        >
                          Sync Channels from Slack
                        </Button>
                      </VStack>
                    </Td>
                  </Tr>
                ) : (
                  filteredChannels.map(channel => (
                    <Tr key={channel.id}>
                      <Td>
                        <Checkbox
                          isChecked={selectedChannels.includes(channel.id)}
                          onChange={() => handleSelectChannel(channel.id)}
                          isDisabled={!channel.is_bot_member}
                        />
                      </Td>
                      <Td>
                        <Text fontWeight="medium">#{channel.name}</Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={getChannelTypeColor(channel.type)}>
                          {formatChannelType(channel.type)}
                        </Badge>
                      </Td>
                      <Td>
                        <Text noOfLines={1}>{channel.purpose || "—"}</Text>
                      </Td>
                      <Td>{channel.member_count || "—"}</Td>
                      <Td>
                        {channel.is_archived ? (
                          <Badge colorScheme="gray">Archived</Badge>
                        ) : channel.is_bot_member ? (
                          <HStack>
                            <Icon as={FiCheck} color="green.500" />
                            <Text fontSize="sm" color="green.500">Bot Installed</Text>
                          </HStack>
                        ) : (
                          <HStack>
                            <Icon as={FiAlertTriangle} color="orange.500" />
                            <Text fontSize="sm" color="orange.500">Bot Not Installed</Text>
                          </HStack>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Box>

          {/* Pagination */}
          {!isLoading && pagination.total_pages > 1 && (
            <Flex justify="space-between" align="center" mt={6}>
              <Text color="gray.600">
                Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
                {Math.min(pagination.page * pagination.page_size, pagination.total_items)} of{' '}
                {pagination.total_items} channels
              </Text>
              <HStack>
                <Button
                  leftIcon={<Icon as={FiArrowLeft} />}
                  onClick={() => changePage(pagination.page - 1)}
                  isDisabled={pagination.page === 1}
                  size="sm"
                >
                  Previous
                </Button>
                <Text>{pagination.page} of {pagination.total_pages}</Text>
                <Button
                  rightIcon={<Icon as={FiArrowRight} />}
                  onClick={() => changePage(pagination.page + 1)}
                  isDisabled={pagination.page === pagination.total_pages}
                  size="sm"
                >
                  Next
                </Button>
              </HStack>
            </Flex>
          )}

      {/* Action buttons */}
      <Flex justify="flex-end" mt={8}>
        <HStack spacing={4}>
          <Button
            as={Link}
            to={`/dashboard/slack/workspaces/${workspaceId}`}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            colorScheme="purple"
            onClick={saveSelectedChannels}
            isLoading={isSaving}
            loadingText="Saving..."
            isDisabled={selectedChannels.length === 0}
          >
            Save Selection
          </Button>
        </HStack>
      </Flex>

      {/* Sync status and selected channels summary */}
      <Flex mt={6} gap={4} direction={{ base: 'column', md: 'row' }}>
        {/* Selected channels summary */}
        <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50" flex="1">
          <Heading size="sm" mb={2}>
            Selected Channels: {selectedChannels.length}
          </Heading>
          <Text fontSize="sm" color="gray.600">
            {selectedChannels.length === 0 ? (
              'No channels selected. Select channels to analyze from the list above.'
            ) : (
              `You've selected ${selectedChannels.length} channel${selectedChannels.length !== 1 ? 's' : ''} for analysis.`
            )}
          </Text>
        </Box>

        {/* Sync status information */}
        {syncStatus && (
          <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50" flex="1">
            <HStack mb={2} align="center">
              <Heading size="sm">Sync Status:</Heading>
              {syncStatus.is_syncing ? (
                <HStack>
                  <Spinner size="xs" color="purple.500" />
                  <Badge colorScheme="purple">Syncing</Badge>
                </HStack>
              ) : (
                <Badge colorScheme="green">Ready</Badge>
              )}
            </HStack>
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" color="gray.600">
                Total Channels: {syncStatus.channel_count}
              </Text>
              {syncStatus.last_channel_sync && (
                <Text fontSize="sm" color="gray.600">
                  Last Updated: {new Date(syncStatus.last_channel_sync).toLocaleString()}
                </Text>
              )}
              {syncStatus.is_syncing && (
                <Text fontSize="sm" color="purple.600" fontStyle="italic">
                  Channel sync is running in the background. The list will automatically update when complete.
                </Text>
              )}
            </VStack>
          </Box>
        )}
      </Flex>

      {/* Bot membership warning dialog */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Bot Not Installed In Some Channels
            </AlertDialogHeader>

            <AlertDialogBody>
              <Text mb={4}>
                Some of your selected channels don't have the Toban bot installed.
                The bot needs to be in the channel to analyze messages.
              </Text>
              <Text fontWeight="bold" mb={2}>Missing from:</Text>
              <VStack align="start" spacing={1} pl={4}>
                {channels
                  .filter(channel => selectedChannels.includes(channel.id) && !channel.is_bot_member)
                  .map(channel => (
                    <Text key={channel.id}>#{channel.name}</Text>
                  ))}
              </VStack>
              <Text mt={4}>
                Please invite the bot to these channels and try again, or remove them from your selection.
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Go Back
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ChannelList;
