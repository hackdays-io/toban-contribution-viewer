import React, { useEffect, useState } from 'react'
import env from '../../config/env';
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
  HStack,
  VStack,
  Avatar,
  Badge,
  Icon,
  Spinner,
  Divider,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import { FiMessageSquare, FiRefreshCw } from 'react-icons/fi'

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

interface SlackUser {
  id: string
  slack_id: string
  name: string
  display_name: string | null
  real_name: string | null
  profile_image_url: string | null
}

interface ThreadViewProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  channelId: string
  threadTs: string
  parentMessage: SlackMessage | null
  users: Map<string, SlackUser>
}

/**
 * Component to display a thread conversation in a modal.
 */
const ThreadView: React.FC<ThreadViewProps> = ({
  isOpen,
  onClose,
  workspaceId,
  channelId,
  threadTs,
  parentMessage,
  users,
}) => {
  const [replies, setReplies] = useState<SlackMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [totalReplies, setTotalReplies] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const bgColor = useColorModeValue('gray.50', 'gray.700')
  const textBgColor = useColorModeValue('white', 'gray.800')
  const toast = useToast()

  // Fetch thread replies when the modal opens
  useEffect(() => {
    if (isOpen && threadTs) {
      fetchThreadReplies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, threadTs])

  /**
   * Format date and time in a user-friendly way.
   */
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime)
    return date.toLocaleString()
  }

  /**
   * Get user information for a message.
   */
  const getUserInfo = (userId: string | null) => {
    if (!userId) return { name: 'Unknown User', avatar: null }
    const user = users.get(userId)

    // Choose the best name to display in this order of preference
    const displayName =
      user?.display_name || user?.real_name || user?.name || 'Unknown User'

    return {
      name: displayName,
      avatar: user?.profile_image_url,
    }
  }

  /**
   * Fetch thread replies from the API.
   */
  const fetchThreadReplies = async () => {
    try {
      setIsLoading(true)
      const limit = 1000 // Increased limit to get more replies
      const url = `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/${channelId}/threads/${threadTs}?limit=${limit}`
      
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(
          `Error fetching thread replies: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()
      
      setReplies(data.replies || [])
      setTotalReplies(data.total_replies || 0)
      setHasMore(data.has_more || false)
    } catch (error) {
      console.error('Error fetching thread replies:', error)
      toast({
        title: 'Error',
        description: 'Failed to load thread replies',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  /**
   * Refresh thread replies.
   */
  const refreshThreadReplies = () => {
    setIsRefreshing(true)
    fetchThreadReplies() // No parameter needed anymore
  }

  /**
   * Render the parent message.
   */
  const renderParentMessage = () => {
    if (!parentMessage) return null

    const user = getUserInfo(parentMessage.user_id)

    return (
      <Box
        p={4}
        bg={bgColor}
        borderRadius="md"
        borderWidth="1px"
        borderColor={borderColor}
        width="100%"
      >
        <HStack spacing={4} align="start">
          <Avatar size="sm" name={user.name} src={user.avatar || undefined} />
          <Box flex="1">
            <HStack mb={1}>
              <Text fontWeight="bold">{user.name}</Text>
              <Text fontSize="sm" color="gray.500">
                {formatDateTime(parentMessage.message_datetime)}
              </Text>
              {parentMessage.is_edited && (
                <Badge size="sm" colorScheme="gray">
                  Edited
                </Badge>
              )}
            </HStack>
            <Text>{parentMessage.text}</Text>

            {/* Reactions */}
            {parentMessage.reaction_count > 0 && (
              <Text fontSize="sm" color="gray.500" mt={1}>
                {parentMessage.reaction_count}{' '}
                {parentMessage.reaction_count === 1 ? 'reaction' : 'reactions'}
              </Text>
            )}
          </Box>
        </HStack>
      </Box>
    )
  }

  /**
   * Render a single thread reply.
   */
  const renderThreadReply = (message: SlackMessage) => {
    const user = getUserInfo(message.user_id)

    return (
      <Box key={message.id} py={2} width="100%">
        <HStack spacing={4} align="start">
          <Avatar size="sm" name={user.name} src={user.avatar || undefined} />
          <Box flex="1">
            <HStack mb={1}>
              <Text fontWeight="bold">{user.name}</Text>
              <Text fontSize="sm" color="gray.500">
                {formatDateTime(message.message_datetime)}
              </Text>
              {message.is_edited && (
                <Badge size="sm" colorScheme="gray">
                  Edited
                </Badge>
              )}
            </HStack>
            <Text>{message.text}</Text>

            {/* Reactions */}
            {message.reaction_count > 0 && (
              <Text fontSize="sm" color="gray.500" mt={1}>
                {message.reaction_count}{' '}
                {message.reaction_count === 1 ? 'reaction' : 'reactions'}
              </Text>
            )}
          </Box>
        </HStack>
      </Box>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxWidth={{ base: '95%', md: '800px' }}>
        <ModalHeader>Thread</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          {isLoading && !isRefreshing ? (
            <Box display="flex" justifyContent="center" py={8}>
              <Spinner size="xl" color="purple.500" thickness="4px" />
            </Box>
          ) : (
            <VStack spacing={4} align="stretch">
              {/* Parent message */}
              {renderParentMessage()}

              {/* Divider with count */}
              <Box position="relative" my={2}>
                <Divider borderColor={borderColor} />
                <Text
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  bg={textBgColor}
                  px={2}
                  fontSize="sm"
                  color="gray.500"
                >
                  <Icon as={FiMessageSquare} mr={1} />
                  {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
                </Text>
              </Box>

              {/* Thread replies */}
              {replies.length > 0 ? (
                <VStack spacing={2} align="stretch" divider={<Divider />}>
                  {replies.map(renderThreadReply)}
                </VStack>
              ) : (
                <Box textAlign="center" py={4}>
                  <Text>No replies in this thread</Text>
                </Box>
              )}

              {/* Has more indicator */}
              {hasMore && (
                <Box textAlign="center" py={2}>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    colorScheme="purple" 
                    mb={2}
                    onClick={() => {
                      // Load more replies by increasing the limit
                      // Now uses the same fetchThreadReplies function for consistency
                      fetchThreadReplies();
                    }}
                  >
                    Load More Replies
                  </Button>
                  {hasMore && (
                    <Text fontSize="sm" color="gray.500">
                      Some replies couldn't be loaded. View the full thread in Slack.
                    </Text>
                  )}
                </Box>
              )}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            leftIcon={<Icon as={FiRefreshCw} />}
            colorScheme="purple"
            onClick={refreshThreadReplies}
            isLoading={isRefreshing}
            mr={3}
          >
            Refresh
          </Button>
          
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ThreadView
