import React, { useEffect, useState } from 'react'
import env from '../../config/env';
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
  // Avatar, // Removed after replacing with SlackUserDisplay
  Stack,
  StackDivider,
  FormControl,
  FormLabel,
  IconButton,
  Tooltip,
} from '@chakra-ui/react'
import {
  FiSearch,
  FiRefreshCw,
  FiMessageSquare,
  FiCalendar,
  FiMessageCircle,
} from 'react-icons/fi'

// Import ThreadView component
import ThreadView from './ThreadView'
import SlackUserDisplay, { SlackUserCacheProvider } from './SlackUserDisplay'
import MessageText from './MessageText'

// Define types
interface SlackMessage {
  id: string
  slack_id: string
  slack_ts: string
  text: string
  message_type: string
  subtype: string | null
  is_edited: boolean
  edited_ts: string | null
  has_attachments: boolean
  thread_ts: string | null
  is_thread_parent: boolean
  is_thread_reply: boolean
  reply_count: number
  reply_users_count: number
  reaction_count: number
  message_datetime: string
  channel_id: string
  user_id: string | null
  parent_id: string | null
}

// SlackUser interface removed as it's no longer needed here
// We now use the one from SlackUserDisplay component

interface PaginationInfo {
  has_more: boolean
  next_cursor: string | null
  page_size: number
  total_messages: number
}

interface MessageListProps {
  workspaceId: string
  channelId: string
  channelName?: string
}

/**
 * Component to display and filter Slack messages for a specific channel.
 */
const MessageList: React.FC<MessageListProps> = ({
  workspaceId,
  channelId,
  channelName,
}) => {
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [includeReplies] = useState(true)
  const toast = useToast()

  // Thread view state
  const [isThreadViewOpen, setIsThreadViewOpen] = useState(false)
  const [selectedThreadTs, setSelectedThreadTs] = useState<string>('')
  const [selectedThreadParent, setSelectedThreadParent] =
    useState<SlackMessage | null>(null)

  // Fetch initial messages when component mounts
  useEffect(() => {
    fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, channelId, cursor])

  /**
   * Fetch channel messages from the API.
   */
  const fetchMessages = async () => {
    try {
      setIsLoading(true)

      // Construct the URL with query parameters
      let url = `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/${channelId}/messages?include_replies=${includeReplies}`

      if (startDate) {
        // Create a date at the beginning of the selected day (00:00:00)
        const startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)
        url += `&start_date=${startDateTime.toISOString()}`
      }

      if (endDate) {
        // Create a date at the end of the selected day (23:59:59)
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        url += `&end_date=${endDateTime.toISOString()}`
      }

      if (cursor) {
        url += `&cursor=${cursor}`
      }

      // Fetch messages from API with CORS headers
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(
          `Failed to fetch messages: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      // Process messages from API response

      setMessages(data.messages || [])
      setPagination(data.pagination || null)

      // No longer need to extract user IDs to fetch user data here
      // User data is now handled by the SlackUserDisplay component
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // fetchUserData method removed as it's no longer needed
  // User data is now handled by the SlackUserDisplay component

  /**
   * Sync messages from Slack to the database.
   */
  const syncMessages = async () => {
    try {
      setIsSyncing(true)

      // Prepare dates with proper time boundaries
      let startDateTime = null
      let endDateTime = null

      if (startDate) {
        startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)
      }

      if (endDate) {
        endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
      }

      const dateRange = {
        start_date: startDateTime ? startDateTime.toISOString() : null,
        end_date: endDateTime ? endDateTime.toISOString() : null,
        include_replies: includeReplies,
        sync_threads: true, // Always sync threads
        thread_days: 30, // Sync last 30 days of threads by default
      }

      const syncUrl = `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/${channelId}/sync`
      // Start the sync process

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dateRange),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Sync error response:', errorText)
        throw new Error(
          `Failed to sync messages: ${response.status} ${response.statusText}`
        )
      }

      const result = await response.json() // Process response

      toast({
        title: 'Sync Started',
        description: result.sync_threads 
          ? 'Messages and thread replies are being synchronized in the background.' 
          : 'Messages are being synchronized in the background.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      })

      // Wait 3 seconds to give time for the sync to start
      setTimeout(() => {
        // Refetch messages to show the latest data
        fetchMessages()
      }, 3000)
    } catch (error) {
      console.error('Error syncing messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync messages',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  /**
   * Handle applying filters and search.
   */
  const applyFilters = () => {
    setCursor(null) // Reset pagination
    fetchMessages()
  }

  /**
   * Format date and time in a user-friendly way.
   */
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime)
    return date.toLocaleString()
  }


  /**
   * Load more messages when available.
   */
  const loadMore = () => {
    if (pagination?.next_cursor) {
      setCursor(pagination.next_cursor)
    }
  }

  /**
   * Open thread view modal for a specific thread.
   */
  const openThreadView = (message: SlackMessage) => {
    setSelectedThreadTs(message.slack_ts)
    setSelectedThreadParent(message)
    setIsThreadViewOpen(true)
  }

  /**
   * Get user information for a message.
   * Note: This function is no longer used since we're using SlackUserDisplay component
   */
  // const getUserInfo = (userId: string | null) => {
  //    name: displayName,
  //    avatar: user?.profile_image_url,
  //  }
  //}

  /**
   * Filter messages by search query (client-side filtering).
   */
  const filteredMessages = messages.filter((message) =>
    searchQuery
      ? message.text.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  return (
    <SlackUserCacheProvider workspaceId={workspaceId}>
      <Box p={6} width="100%" maxWidth="1000px" mx="auto">
        <HStack justifyContent="space-between" mb={6}>
          <Heading size="lg">
            {channelName ? `#${channelName} Messages` : 'Channel Messages'}
          </Heading>
          <HStack spacing={3}>
            <Button
              leftIcon={<Icon as={FiRefreshCw} />}
              colorScheme="purple"
              isLoading={isSyncing}
              onClick={() => {
                // Use the unified sync endpoint that handles both messages and threads
                syncMessages();
              }}
            >
              Sync Messages & Threads
            </Button>
          </HStack>
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
                  // We no longer need user info since we're using SlackUserDisplay
                  return (
                    <Box key={message.id} p={2}>
                      <HStack spacing={4} align="start" mb={2}>
                        <SlackUserDisplay 
                          userId={message.user_id || ''}
                          workspaceId={workspaceId}
                          showAvatar={true}
                          displayFormat="real_name"
                          fetchFromSlack={true}
                        />
                        <Box>
                          <HStack mb={1}>
                            <Text fontSize="sm" color="gray.500">
                              {formatDateTime(message.message_datetime)}
                            </Text>
                            {message.is_edited && (
                              <Badge size="sm" colorScheme="gray">
                                Edited
                              </Badge>
                            )}
                          </HStack>
                          <MessageText text={message.text} />

                          {/* Thread info */}
                          {message.is_thread_parent &&
                            message.reply_count > 0 && (
                              <HStack mt={1} spacing={2}>
                                <Text fontSize="sm" color="purple.500">
                                  <Icon as={FiMessageSquare} mr={1} />
                                  {message.reply_count}{' '}
                                  {message.reply_count === 1
                                    ? 'reply'
                                    : 'replies'}
                                </Text>
                                <Tooltip label="View thread">
                                  <IconButton
                                    aria-label="View thread"
                                    icon={<FiMessageCircle />}
                                    size="xs"
                                    colorScheme="purple"
                                    variant="ghost"
                                    onClick={() => openThreadView(message)}
                                  />
                                </Tooltip>
                              </HStack>
                            )}

                          {/* Reactions */}
                          {message.reaction_count > 0 && (
                            <Text fontSize="sm" color="gray.500" mt={1}>
                              {message.reaction_count}{' '}
                              {message.reaction_count === 1
                                ? 'reaction'
                                : 'reactions'}
                            </Text>
                          )}
                        </Box>
                      </HStack>
                    </Box>
                  )
                })}
              </Stack>
            </CardBody>
          </Card>

          {/* Pagination */}
          {pagination?.has_more && (
            <Flex justify="center" mt={6}>
              <Button onClick={loadMore} colorScheme="purple" variant="outline">
                Load More
              </Button>
            </Flex>
          )}
        </>
      )}
      {/* Thread View Modal */}
      <ThreadView
        isOpen={isThreadViewOpen}
        onClose={() => setIsThreadViewOpen(false)}
        workspaceId={workspaceId}
        channelId={channelId}
        threadTs={selectedThreadTs}
        parentMessage={selectedThreadParent}
      />
    </Box>
    </SlackUserCacheProvider>
  )
}

export default MessageList
