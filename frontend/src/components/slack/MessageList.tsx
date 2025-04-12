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
      console.log('[DEBUG] fetchMessages called');
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

      console.log('[DEBUG] Fetching messages from:', url);
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Error response:', errorText);
        throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[DEBUG] Received ${data.messages?.length || 0} messages from API`);
      
      // Log a sample of the messages for debugging
      if (data.messages && data.messages.length > 0) {
        console.log('[DEBUG] First message sample:', JSON.stringify(data.messages[0]));
      }
      
      setMessages(data.messages || []);
      setPagination(data.pagination || null);
      
      // Extract user IDs from messages to fetch user data
      const userIds = new Set<string>();
      if (data.messages) {
        data.messages.forEach((message: SlackMessage, index: number) => {
          if (message.user_id) {
            userIds.add(message.user_id);
            console.log(`[DEBUG] Message ${index} has user_id: ${message.user_id}`);
          } else {
            console.log(`[DEBUG] Message ${index} has no user_id`);
          }
        });
      }
      
      console.log(`[DEBUG] Found ${userIds.size} unique user IDs from messages`);
      console.log('[DEBUG] User IDs:', JSON.stringify(Array.from(userIds)));
      
      // Fetch user data for the messages
      if (userIds.size > 0) {
        console.log('[DEBUG] Calling fetchUserData with user IDs');
        await fetchUserData(Array.from(userIds));
      } else {
        console.log('[DEBUG] No user IDs to fetch');
      }
      
    } catch (error) {
      console.error('[DEBUG] Error in fetchMessages:', error);
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
   * Fetch user data for message authors from the API.
   */
  const fetchUserData = async (userIds: string[]) => {
    try {
      console.log(`[DEBUG] fetchUserData called with ${userIds.length} userIds:`, JSON.stringify(userIds));
      console.log(`[DEBUG] Current users Map has ${users.size} users`);
      
      // Log current users in the Map
      if (users.size > 0) {
        console.log('[DEBUG] First 3 users in the current Map:');
        let count = 0;
        users.forEach((user, id) => {
          if (count < 3) {
            console.log(`[DEBUG] User ${id}:`, JSON.stringify(user));
            count++;
          }
        });
      }
      
      // Filter out empty or undefined userIds
      const validUserIds = userIds.filter(id => id);
      console.log(`[DEBUG] ${validUserIds.length} valid userIds after filtering out empty/undefined values`);
      
      if (validUserIds.length === 0) {
        console.log('[DEBUG] No valid userIds to fetch, returning early');
        return;
      }
      
      // Extract only user IDs that we don't already have in our map
      const missingUserIds = validUserIds.filter(id => !users.has(id));
      console.log(`[DEBUG] Found ${missingUserIds.length} missing user IDs that need to be fetched`);
      
      // If we already have all the users, don't make an API call
      if (missingUserIds.length === 0) {
        console.log('[DEBUG] All user data already loaded, skipping API call');
        return;
      }
      
      // Create URL with query parameters for all user IDs
      const userIdsParam = missingUserIds.map(id => `user_ids=${encodeURIComponent(id)}`).join('&');
      const url = `${import.meta.env.VITE_API_URL}/slack/workspaces/${workspaceId}/users?${userIdsParam}`;
      
      console.log('[DEBUG] Fetching user data from:', url);
      console.log('[DEBUG] User IDs being fetched:', JSON.stringify(missingUserIds));
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Error fetching user data:', errorText);
        throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] Raw API response:', JSON.stringify(data));
      
      // Create a new Map to store merged user data (preserving existing entries)
      const newUsers = new Map<string, SlackUser>(users);
      console.log(`[DEBUG] Created new Map with ${newUsers.size} users (copied from existing Map)`);
      
      // Process the users from the API response
      let processedCount = 0;
      if (data.users && Array.isArray(data.users)) {
        console.log(`[DEBUG] Processing ${data.users.length} users from API response`);
        
        if (data.users.length === 0) {
          console.warn('[DEBUG] ⚠️ API returned empty users array despite valid request');
        }
        
        data.users.forEach((user: SlackUser) => {
          console.log(`[DEBUG] Processing user from API:`, JSON.stringify(user));
          
          if (user && user.id) {
            processedCount++;
            const oldUser = newUsers.get(user.id);
            if (oldUser) {
              console.log(`[DEBUG] Replacing existing user ${user.id} in Map`, {
                old: JSON.stringify(oldUser),
                new: JSON.stringify(user)
              });
            } else {
              console.log(`[DEBUG] Adding new user ${user.id} to Map`);
            }
            
            newUsers.set(user.id, user);
            console.log(`[DEBUG] User ${user.id} now has name: ${user.display_name || user.real_name || user.name || 'Unknown'}`);
          } else {
            console.warn('[DEBUG] ⚠️ Received user without ID from API:', user);
          }
        });
      } else {
        console.warn(`[DEBUG] ⚠️ API response did not contain users array:`, data);
      }
      
      console.log(`[DEBUG] Processed ${processedCount} users from API response`);
      
      // For any userIds not found in the API response, create placeholder users
      let placeholderCount = 0;
      missingUserIds.forEach(userId => {
        if (!newUsers.has(userId)) {
          placeholderCount++;
          console.log(`[DEBUG] Creating placeholder for missing user ${userId}`);
          
          // Use a more identifiable name for placeholders (including part of the ID)
          const placeholderUser: SlackUser = {
            id: userId,
            slack_id: '',
            name: `Missing (${userId.substring(0, 8)})`,  // Include part of UUID for easier debugging
            display_name: null,
            real_name: null,
            profile_image_url: null
          };
          newUsers.set(userId, placeholderUser);
          console.log(`[DEBUG] Added placeholder for ${userId} to Map`);
        }
      });
      
      console.log(`[DEBUG] Created ${placeholderCount} placeholder users for missing IDs`);
      console.log(`[DEBUG] Final Map has ${newUsers.size} users total`);
      
      // Check if any user IDs still have unknown names
      let unknownUsers = 0;
      let unknownList: string[] = [];
      newUsers.forEach((user, id) => {
        if (!user.name || (user.name === 'Unknown User' && !user.display_name && !user.real_name)) {
          unknownUsers++;
          unknownList.push(id);
          console.warn(`[DEBUG] ⚠️ User ${id} has no name data:`, JSON.stringify(user));
        }
      });
      
      if (unknownUsers > 0) {
        console.warn(`[DEBUG] ⚠️ ${unknownUsers} users still have unknown names after loading:`, unknownList);
      }
      
      // Verify that all requested IDs are in the Map
      const missingAfterFetch = validUserIds.filter(id => !newUsers.has(id));
      if (missingAfterFetch.length > 0) {
        console.error(`[DEBUG] ❌ ${missingAfterFetch.length} requested users still missing after fetch:`, missingAfterFetch);
      } else {
        console.log('[DEBUG] ✅ All requested users are now in the Map');
      }
      
      // Update the state with the new Map
      console.log('[DEBUG] Setting users state with new Map');
      setUsers(newUsers);
      
    } catch (error) {
      console.error('[DEBUG] Error in fetchUserData:', error);
      
      // Create placeholder users for all IDs if the API call fails
      const newUsers = new Map<string, SlackUser>(users);
      console.log(`[DEBUG] Error recovery: creating placeholders for missing users`);
      
      let recoveryCount = 0;
      userIds.forEach(userId => {
        if (userId && !newUsers.has(userId)) {
          recoveryCount++;
          const placeholderUser: SlackUser = {
            id: userId,
            slack_id: '',
            name: `Error (${userId.substring(0, 8)})`,  // Mark as error recovery
            display_name: null,
            real_name: null,
            profile_image_url: null
          };
          newUsers.set(userId, placeholderUser);
        }
      });
      
      console.log(`[DEBUG] Added ${recoveryCount} error recovery placeholders`);
      setUsers(newUsers);
    }
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
    console.log(`[DEBUG] getUserInfo called for userId: ${userId}`);
    
    if (!userId) {
      console.log(`[DEBUG] No userId provided, returning "Unknown User"`);
      return { name: 'Unknown User', avatar: null };
    }
    
    const user = users.get(userId);
    console.log(`[DEBUG] User data for ${userId}:`, user ? JSON.stringify(user) : 'NOT FOUND');
    
    if (!user) {
      console.warn(`[DEBUG] ⚠️ No user found for ID: ${userId}`);
      // Add the missing user ID to our user Map as a placeholder
      const placeholderUser: SlackUser = {
        id: userId,
        slack_id: '',
        name: `Missing (${userId.substring(0, 6)})`,
        display_name: null,
        real_name: null,
        profile_image_url: null
      };
      
      console.log(`[DEBUG] Adding placeholder for ${userId}:`, placeholderUser);
      
      // Clone the map to trigger a re-render
      const newUsers = new Map(users);
      newUsers.set(userId, placeholderUser);
      setUsers(newUsers);
      
      return { 
        name: placeholderUser.name, 
        avatar: null 
      };
    }
    
    // Choose the best name to display in this order of preference:
    // 1. display_name (what appears in Slack UI)
    // 2. real_name (full name if available)
    // 3. name (username/handle)
    // If none available, fallback to "Unknown User"
    const displayName = user.display_name || user.real_name || user.name || 'Unknown User';
    
    console.log(`[DEBUG] Returning display name: "${displayName}" for user ${userId}`);
    console.log(`[DEBUG] Name sources - display_name: "${user.display_name}", real_name: "${user.real_name}", name: "${user.name}"`);
    
    return {
      name: displayName,
      avatar: user.profile_image_url
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
