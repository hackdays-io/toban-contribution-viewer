import React, { useEffect, useState, useCallback } from 'react';
import env from '../../config/env';
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
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { FiSearch, FiRefreshCw, FiCheck, FiAlertTriangle, FiArrowLeft, FiArrowRight, FiMessageSquare } from 'react-icons/fi';
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

// Installation result type
interface BotInstallationResult {
  channel_id: string;
  name: string;
  status: 'success' | 'error';
  error_code?: string;
  error_message?: string;
}

interface BotInstallation {
  attempted_count: number;
  results: BotInstallationResult[];
}

interface SelectChannelsResponse {
  status: string;
  message: string;
  selected_count: number;
  selected_channels: Partial<Channel>[];
  bot_installation?: BotInstallation;
}

// Response type for sync operation
interface SyncResponse {
  status: string;
  message: string;
  created_count: number;
  updated_count: number;
  total_count: number;
}

/**
 * Component to display and select Slack channels for analysis.
 */
const ChannelList: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  // State for channels and loading
  const [allChannels, setAllChannels] = useState<Channel[]>([]); // Store all channels fetched from API
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [corsError, setCorsError] = useState(false);
  // Client-side pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    page_size: 50,
    total_items: 0,
    total_pages: 0,
  });
  
  // Detect if we're running in an environment that might have CORS issues
  const isNgrokOrRemote = window.location.hostname.includes('ngrok') || 
                         (!window.location.hostname.includes('localhost') && 
                          env.apiUrl.includes('localhost'));

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [installBot, setInstallBot] = useState(true);

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

  // No longer needed - we're handling filtering client-side

  /**
   * Fetch channels from the API - gets all channels at once for client-side filtering
   */
  const fetchChannels = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setCorsError(false);
    
    console.log("Fetching all channels for client-side filtering");

    try {
      // Request all channels in one go with a large page size
      // No pagination or filtering params - we'll handle everything client-side
      const queryParams = new URLSearchParams({
        page: '1',
        page_size: '1000', // Get up to 1000 channels at once
        include_archived: 'true', // Always include archived, we'll filter client-side
      });
      
      // Always request all channel types and filter client-side
      const allChannelTypes = ['public', 'private', 'im', 'mpim'];
      allChannelTypes.forEach(type => queryParams.append('types', type));
      
      console.log("Fetching all channels:", queryParams.toString());

      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels?${queryParams}`,
        {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': window.location.origin
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }

      const data: ChannelResponse = await response.json();
      setAllChannels(data.channels);
      
      // Set total items based on all channels retrieved
      setPagination(prevPagination => ({
        ...prevPagination,
        page: 1, // Reset to page 1 when fetching channels
        total_items: data.channels.length,
        total_pages: Math.ceil(data.channels.length / prevPagination.page_size),
      }));

      // Initialize selected channels from those marked in the API
      const preselected = data.channels
        .filter(channel => channel.is_selected_for_analysis)
        .map(channel => channel.id);

      setSelectedChannels(preselected);
    } catch (error) {
      console.error('Error fetching channels:', error);
      
      // Check if this is likely a CORS error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCorsError = errorMessage.includes('NetworkError') || 
                         errorMessage.includes('Failed to fetch') ||
                         errorMessage.includes('CORS');
      
      if (isCorsError && isNgrokOrRemote) {
        setCorsError(true);
        toast({
          title: 'CORS Error',
          description: 'Unable to connect to API due to CORS restrictions. This commonly happens when accessing the application through ngrok while the API is running on localhost.',
          status: 'error',
          duration: 10000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load channels',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  // We only depend on page, typeFilter, and includeArchived from state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, pagination.page, pagination.page_size, includeArchived, typeFilter, toast, isNgrokOrRemote]);

  // Function to check sync status
  const checkSyncStatus = async () => {
    if (!workspaceId) return;

    try {
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/sync-status`
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
        // If we're syncing, update UI and poll again, but with a longer interval
        // to reduce unnecessary requests
        setTimeout(checkSyncStatus, 10000);
        if (!isSyncing) {
          setIsSyncing(true);
        }
      } else {
        // If sync has completed (we were syncing but now we're not)
        const wasSyncing = isSyncing || (previousStatus && previousStatus.is_syncing);

        if (wasSyncing) {
          // Reset syncing state
          setIsSyncing(false);

          // Refresh the channel list only if we actually completed syncing
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

  // Fetch channels only once when component loads
  useEffect(() => {
    fetchChannels();
    console.log("Initial channel fetch on component mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Check sync status on load and when syncing status changes
  useEffect(() => {
    checkSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

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

      // Start the background sync process with explicit CORS headers
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/sync?${queryParams}`,
        { 
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': window.location.origin
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.detail && errorData.detail.includes('missing_scope')) {
          throw new Error('Missing permissions. Your Slack app may need additional scopes like channels:read, groups:read, im:read, mpim:read');
        } else {
          throw new Error(errorData.detail || 'Failed to sync channels');
        }
      }

      const data: SyncResponse = await response.json();

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
    const nonMemberChannels = allChannels.filter(
      channel => selectedChannels.includes(channel.id) && !channel.is_bot_member
    );

    if (nonMemberChannels.length > 0 && !installBot) {
      onOpen(); // Open alert dialog
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/select`,
        {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': window.location.origin
          },
          body: JSON.stringify({
            channel_ids: selectedChannels,
            install_bot: installBot,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save channel selection');
      }

      const data: SelectChannelsResponse = await response.json();

      // Create custom success message that includes bot installation results
      let successMessage = `Selected ${data.selected_count} channels for analysis`;

      if (data.bot_installation) {
        const successCount = data.bot_installation.results.filter((r: BotInstallationResult) => r.status === 'success').length;
        const failCount = data.bot_installation.results.filter((r: BotInstallationResult) => r.status === 'error').length;

        if (successCount > 0) {
          successMessage += `, bot installed in ${successCount} new channel${successCount !== 1 ? 's' : ''}`;
        }

        if (failCount > 0) {
          successMessage += `. Failed to install in ${failCount} channel${failCount !== 1 ? 's' : ''}.`;
        }
      }

      toast({
        title: 'Channels Selected',
        description: successMessage,
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
   * Handle bulk selection - only selects/deselects visible channels on the current page
   */
  const handleSelectAll = (select: boolean) => {
    if (select) {
      // Select all visible channels on this page that are supported
      const selectableChannels = paginatedChannels
        .filter(channel => channel.is_supported)
        .map(channel => channel.id);
        
      console.log(`Selecting ${selectableChannels.length} channels on current page`);

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
      const currentPageIds = paginatedChannels.map(channel => channel.id);
      console.log(`Unselecting ${currentPageIds.length} channels on current page`);
      setSelectedChannels(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  /**
   * Apply all filtering and pagination client-side
   */
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  
  // STEP 1: Apply all filters to allChannels
  const filteredChannels = allChannels.filter(channel => {
    // Filter by search term (if any)
    if (normalizedSearchTerm !== '') {
      const channelName = channel.name.toLowerCase();
      if (!channelName.includes(normalizedSearchTerm)) {
        return false;
      }
    }
    
    // Filter by channel type (if not "all")
    if (typeFilter !== 'all') {
      if (typeFilter === 'public' && channel.type !== 'public') return false;
      if (typeFilter === 'private' && channel.type !== 'private') return false;
      if (typeFilter === 'direct' && !['im', 'mpim'].includes(channel.type)) return false;
    }
    
    // Filter by archived status
    if (!includeArchived && channel.is_archived) {
      return false;
    }
    
    // Channel passed all filters
    return true;
  });
  
  // Debug logging
  console.log("Client-side filtering results:", {
    totalChannels: allChannels.length,
    filteredChannels: filteredChannels.length,
    searchTerm: normalizedSearchTerm || '(none)',
    typeFilter,
    includeArchived
  });
  
  // STEP 2: Calculate pagination based on filtered results
  const pageSize = pagination.page_size;
  const totalFilteredItems = filteredChannels.length;
  const totalFilteredPages = Math.max(1, Math.ceil(totalFilteredItems / pageSize));
  
  // Ensure current page is valid for the filtered results
  let currentPage = pagination.page;
  if (currentPage > totalFilteredPages) {
    currentPage = 1;
    // Reset pagination to page 1 if the current page is invalid
    if (pagination.page !== 1) {
      setPagination(prev => ({
        ...prev,
        page: 1
      }));
    }
  }
  
  // STEP 3: Get only the channels for the current page
  const paginatedChannels = filteredChannels.slice(
    (currentPage - 1) * pageSize, 
    currentPage * pageSize
  );

  /**
   * Change page - now handles all pagination client-side
   */
  const changePage = (newPage: number) => {
    console.log(`Changing page to ${newPage} (current: ${pagination.page}, totalPages: ${totalFilteredPages})`);
    
    // Simple client-side page change
    if (newPage >= 1 && newPage <= totalFilteredPages) {
      setPagination(prev => ({
        ...prev,
        page: newPage,
      }));
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
            <Button size="sm" colorScheme="blue" onClick={fetchChannels} mt={2}>
              Retry Connection
            </Button>
          </VStack>
        </Alert>
      )}

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
              onChange={(e) => {
                // Reset to page 1 when changing search term
                if (e.target.value !== searchTerm) {
                  setPagination(prev => ({
                    ...prev,
                    page: 1
                  }));
                }
                setSearchTerm(e.target.value);
              }}
            />
          </InputGroup>

          <Select
            maxW="180px"
            value={typeFilter}
            onChange={(e) => {
              // Reset to page 1 when changing type filter
              setPagination(prev => ({
                ...prev,
                page: 1
              }));
              setTypeFilter(e.target.value);
            }}
          >
            <option value="all">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="direct">Direct Messages</option>
          </Select>

          <Checkbox
            isChecked={includeArchived}
            onChange={(e) => {
              // Reset to page 1 when changing archive filter
              setPagination(prev => ({
                ...prev,
                page: 1
              }));
              setIncludeArchived(e.target.checked);
            }}
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
                      isChecked={paginatedChannels.length > 0 && paginatedChannels.every(channel =>
                        selectedChannels.includes(channel.id)
                      )}
                      isIndeterminate={
                        paginatedChannels.some(channel => selectedChannels.includes(channel.id)) &&
                        !paginatedChannels.every(channel => selectedChannels.includes(channel.id))
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Purpose</Th>
                  <Th>Members</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <Tr>
                    <Td colSpan={7} textAlign="center" py={8}>
                      <Spinner size="md" color="purple.500" />
                    </Td>
                  </Tr>
                ) : paginatedChannels.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} textAlign="center" py={8}>
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
                  paginatedChannels.map(channel => (
                    <Tr key={channel.id}>
                      <Td>
                        <Checkbox
                          isChecked={selectedChannels.includes(channel.id)}
                          onChange={() => handleSelectChannel(channel.id)}
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
                      <Td>
                        <Button
                          as={Link}
                          to={`/dashboard/slack/workspaces/${workspaceId}/channels/${channel.id}/messages`}
                          size="sm"
                          colorScheme="purple"
                          variant="outline"
                          leftIcon={<Icon as={FiMessageSquare} />}
                        >
                          View Messages
                        </Button>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Box>

          {/* Pagination - simplified for client-side only */}
          {!isLoading && totalFilteredPages > 1 && (
            <Flex justify="space-between" align="center" mt={6}>
              <Text color="gray.600">
                Showing {filteredChannels.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, totalFilteredItems)} of{' '}
                {totalFilteredItems} channels
              </Text>
              <HStack>
                <Button
                  leftIcon={<Icon as={FiArrowLeft} />}
                  onClick={() => changePage(currentPage - 1)}
                  isDisabled={currentPage === 1}
                  size="sm"
                >
                  Previous
                </Button>
                <Text>
                  {currentPage} of {totalFilteredPages}
                </Text>
                <Button
                  rightIcon={<Icon as={FiArrowRight} />}
                  onClick={() => changePage(currentPage + 1)}
                  isDisabled={currentPage === totalFilteredPages}
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
                {allChannels
                  .filter(channel => selectedChannels.includes(channel.id) && !channel.is_bot_member)
                  .map(channel => (
                    <Text key={channel.id}>#{channel.name}</Text>
                  ))}
              </VStack>
              <Text mt={4} mb={2}>
                Would you like to automatically install the bot in these channels?
              </Text>
              <Checkbox
                isChecked={installBot}
                onChange={(e) => setInstallBot(e.target.checked)}
                colorScheme="purple"
                size="lg"
                mt={2}
              >
                Auto-install bot in selected channels
              </Checkbox>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose} mr={3}>
                Cancel
              </Button>
              <Button
                colorScheme="purple"
                onClick={() => {
                  onClose();
                  if (installBot) {
                    saveSelectedChannels();
                  }
                }}
              >
                {installBot ? "Continue with Installation" : "Continue without Bot"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ChannelList;
