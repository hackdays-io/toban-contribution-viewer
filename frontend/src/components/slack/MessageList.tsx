import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Text,
  useToast,
  VStack,
  Badge,
  Divider,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Stack,
  StackDivider,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { FiSearch, FiRefreshCw, FiMessageSquare, FiCalendar } from 'react-icons/fi';

// Define types
interface SlackMessage {
  id: string;
  slack_id: string;
  slack_ts: string;
  text: string;
  message_type: string;
  subtype: string | null;
  is_edited: boolean;
  edited_ts: string | null;
  has_attachments: boolean;
  thread_ts: string | null;
  is_thread_parent: boolean;
  is_thread_reply: boolean;
  reply_count: number;
  reply_users_count: number;
  reaction_count: number;
  message_datetime: string;
  channel_id: string;
  user_id: string | null;
  parent_id: string | null;
}

interface SlackUser {
  id: string;
  slack_id: string;
  name: string;
  display_name: string | null;
  real_name: string | null;
  profile_image_url: string | null;
}

interface PaginationInfo {
  has_more: boolean;
  next_cursor: string | null;
  page_size: number;
  total_messages: number;
}

interface MessageListProps {
  workspaceId: string;
  channelId: string;
  channelName?: string;
}

/**
 * Component to display and filter Slack messages for a specific channel.
 */
const MessageList: React.FC<MessageListProps> = ({ workspaceId, channelId, channelName }) => {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeReplies] = useState(true);
  const toast = useToast();
  const [users, setUsers] = useState<Map<string, SlackUser>>(new Map());

  // Fetch initial messages when component mounts
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, channelId, cursor]);

  /**
   * Fetch channel messages from the API.
   */
  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      
      // Construct the URL with query parameters
      let url = `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/channels/${channelId}/messages?include_replies=${includeReplies}`;
      
      if (startDate) {
        // Create a date at the beginning of the selected day (00:00:00)
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        url += `&start_date=${startDateTime.toISOString()}`;
      }
      
      if (endDate) {
        // Create a date at the end of the selected day (23:59:59)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        url += `&end_date=${endDateTime.toISOString()}`;
      }
      
      if (cursor) {
        url += `&cursor=${cursor}`;
      }

      // Log the URL being called (for debugging)
      console.log('Fetching messages from:', url);
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      setMessages(data.messages || []);
      setPagination(data.pagination || null);
      
      // Extract user IDs from messages to fetch user data
      const userIds = new Set<string>();
      data.messages.forEach((message: SlackMessage) => {
        if (message.user_id) {
          userIds.add(message.user_id);
        }
      });
      
      // Fetch user data for the messages
      if (userIds.size > 0) {
        await fetchUserData(Array.from(userIds));
      }
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch user data for message authors.
   */
  const fetchUserData = async (userIds: string[]) => {
    // This is a placeholder. In a real implementation, you would fetch user data 
    // from an API endpoint. For now, we'll create mock data.
    const newUsers = new Map<string, SlackUser>();
    
    userIds.forEach(userId => {
      // Create a mock user for demonstration purposes
      const mockUser: SlackUser = {
        id: userId,
        slack_id: `U${userId.substring(0, 8)}`,
        name: `user_${userId.substring(0, 5)}`,
        display_name: `User ${userId.substring(0, 5)}`,
        real_name: `User ${userId.substring(0, 5)}`,
        profile_image_url: null
      };
      
      newUsers.set(userId, mockUser);
    });
    
    setUsers(newUsers);
  };

  /**
   * Sync messages from Slack to the database.
   */
  const syncMessages = async () => {
    try {
      setIsSyncing(true);
      
      // Prepare dates with proper time boundaries
      let startDateTime = null;
      let endDateTime = null;
      
      if (startDate) {
        startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
      }
      
      if (endDate) {
        endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
      }
      
      const dateRange = {
        start_date: startDateTime ? startDateTime.toISOString() : null,
        end_date: endDateTime ? endDateTime.toISOString() : null,
        include_replies: includeReplies
      };
      
      const syncUrl = `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/channels/${channelId}/sync`;
      console.log('Syncing messages with:', syncUrl, dateRange);
      
      const response = await fetch(
        syncUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dateRange),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sync error response:', errorText);
        throw new Error(`Failed to sync messages: ${response.status} ${response.statusText}`);
      }

      await response.json(); // Process response but we don't need to use it
      
      toast({
        title: 'Sync Started',
        description: 'Messages are being synchronized in the background.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      
      // Wait 3 seconds to give time for the sync to start
      setTimeout(() => {
        // Refetch messages to show the latest data
        fetchMessages();
      }, 3000);
      
    } catch (error) {
      console.error('Error syncing messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync messages',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Handle applying filters and search.
   */
  const applyFilters = () => {
    setCursor(null); // Reset pagination
    fetchMessages();
  };

  /**
   * Format date and time in a user-friendly way.
   */
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleString();
  };

  // We're not using truncateText now, but keeping it commented for future use
  /*
  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  */

  /**
   * Load more messages when available.
   */
  const loadMore = () => {
    if (pagination?.next_cursor) {
      setCursor(pagination.next_cursor);
    }
  };

  /**
   * Get user information for a message.
   */
  const getUserInfo = (userId: string | null) => {
    if (!userId) return { name: 'Unknown User', avatar: null };
    const user = users.get(userId);
    return {
      name: user?.display_name || user?.real_name || user?.name || 'Unknown User',
      avatar: user?.profile_image_url
    };
  };

  /**
   * Filter messages by search query (client-side filtering).
   */
  const filteredMessages = messages.filter(message => 
    searchQuery ? message.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <Box p={6} width="100%" maxWidth="1000px" mx="auto">
      <HStack justifyContent="space-between" mb={6}>
        <Heading size="lg">
          {channelName ? `#${channelName} Messages` : 'Channel Messages'}
        </Heading>
        <Button
          leftIcon={<Icon as={FiRefreshCw} />}
          colorScheme="purple"
          isLoading={isSyncing}
          onClick={syncMessages}
        >
          Sync Messages
        </Button>
      </HStack>

      <Divider mb={6} />

      {/* Filters */}
      <VStack spacing={4} align="stretch" mb={6}>
        <HStack spacing={4}>
          <FormControl>
            <FormLabel>Start Date</FormLabel>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Icon as={FiCalendar} color="gray.500" />
              </InputLeftElement>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />
            </InputGroup>
          </FormControl>
          
          <FormControl>
            <FormLabel>End Date</FormLabel>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Icon as={FiCalendar} color="gray.500" />
              </InputLeftElement>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />
            </InputGroup>
          </FormControl>
        </HStack>
        
        <HStack spacing={4}>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="gray.500" />
            </InputLeftElement>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
            />
          </InputGroup>
          
          <Button colorScheme="purple" onClick={applyFilters}>
            Apply Filters
          </Button>
        </HStack>
      </VStack>

      {/* Messages List */}
      {isLoading ? (
        <Flex justify="center" align="center" minHeight="300px">
          <Spinner size="xl" color="purple.500" thickness="4px" />
        </Flex>
      ) : filteredMessages.length === 0 ? (
        <Box
          p={8}
          borderWidth="1px"
          borderRadius="lg"
          textAlign="center"
          bg="gray.50"
        >
          <Text fontSize="lg" mb={4}>
            No messages found
          </Text>
          <Button
            colorScheme="purple"
            leftIcon={<Icon as={FiRefreshCw} />}
            onClick={syncMessages}
            isLoading={isSyncing}
          >
            Sync Messages
          </Button>
        </Box>
      ) : (
        <>
          <Card>
            <CardHeader>
              <Heading size="md">Messages</Heading>
            </CardHeader>
            <CardBody>
              <Stack divider={<StackDivider />} spacing={4}>
                {filteredMessages.map((message) => {
                  const user = getUserInfo(message.user_id);
                  return (
                    <Box key={message.id} p={2}>
                      <HStack spacing={4} align="start" mb={2}>
                        <Avatar size="sm" name={user.name} src={user.avatar || undefined} />
                        <Box>
                          <HStack mb={1}>
                            <Text fontWeight="bold">{user.name}</Text>
                            <Text fontSize="sm" color="gray.500">
                              {formatDateTime(message.message_datetime)}
                            </Text>
                            {message.is_edited && (
                              <Badge size="sm" colorScheme="gray">Edited</Badge>
                            )}
                          </HStack>
                          <Text>{message.text}</Text>
                          
                          {/* Thread info */}
                          {message.is_thread_parent && message.reply_count > 0 && (
                            <Text fontSize="sm" color="purple.500" mt={1}>
                              <Icon as={FiMessageSquare} mr={1} />
                              {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                            </Text>
                          )}
                          
                          {/* Reactions */}
                          {message.reaction_count > 0 && (
                            <Text fontSize="sm" color="gray.500" mt={1}>
                              {message.reaction_count} {message.reaction_count === 1 ? 'reaction' : 'reactions'}
                            </Text>
                          )}
                        </Box>
                      </HStack>
                    </Box>
                  );
                })}
              </Stack>
            </CardBody>
          </Card>

          {/* Pagination */}
          {pagination?.has_more && (
            <Flex justify="center" mt={6}>
              <Button 
                onClick={loadMore} 
                colorScheme="purple" 
                variant="outline"
              >
                Load More
              </Button>
            </Flex>
          )}
        </>
      )}
    </Box>
  );
};

export default MessageList;
