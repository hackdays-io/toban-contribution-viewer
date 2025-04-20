import React, { useState, useEffect } from 'react'
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  TagLabel,
  Text,
  IconButton,
  HStack,
  useColorModeValue,
  Checkbox,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  Flex,
  useToast,
} from '@chakra-ui/react'
import { FiSearch, FiSettings, FiCheck, FiBarChart2 } from 'react-icons/fi'
import { ResourceType } from '../../lib/integrationService'
import useIntegration from '../../context/useIntegration'

interface TeamChannelSelectorProps {
  integrationId: string
}

/**
 * Component for selecting channels for analysis in team integrations
 */
const TeamChannelSelector: React.FC<TeamChannelSelectorProps> = ({
  integrationId,
}) => {
  const toast = useToast()
  const {
    currentResources,
    loadingResources,
    fetchResources,
    isChannelSelectedForAnalysis,
    selectChannelsForAnalysis,
    deselectChannelsForAnalysis,
    loadingChannelSelection,
    channelSelectionError,
    clearChannelSelectionError,
    fetchSelectedChannels,
  } = useIntegration()

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])

  // UI colors
  const tableBg = useColorModeValue('white', 'gray.800')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700')

  // Filter to only show Slack channels
  const channels = currentResources.filter(
    (resource) => resource.resource_type === ResourceType.SLACK_CHANNEL
  )

  // Apply search filter
  const filteredChannels = searchQuery
    ? channels.filter((channel) =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels

  // Load resources and selected channels when component mounts
  useEffect(() => {
    if (integrationId) {
      const loadData = async () => {
        try {
          await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL])
          await fetchSelectedChannels(integrationId)
        } catch (err) {
          console.error('Error loading channel data:', err)
        }
      }

      loadData()
    }
  }, [integrationId, fetchResources, fetchSelectedChannels])

  // We'll use a simpler approach: load selection once on mount,
  // then only update when explicitly intended (after saves or refreshes)
  const [initialized, setInitialized] = useState(false)

  // Load initial selection only once when component mounts and channels are available
  useEffect(() => {
    if (!initialized && channels.length > 0 && !loadingResources) {
      console.log('🔄 INITIALIZATION: Loading initial channel selection')

      // Fetch selected channels from backend
      fetchSelectedChannels(integrationId).then(() => {
        console.log('✅ Initial fetch complete')
        setInitialized(true)
      })
    }
  }, [
    initialized,
    channels.length,
    integrationId,
    fetchSelectedChannels,
    loadingResources,
  ])

  // When selectedChannels changes in context, update our local state
  useEffect(() => {
    if (initialized && channels.length > 0) {
      console.log('🔄 SYNC: Updating selection from context state')

      // Get IDs of selected channels from context
      const contextSelection = channels
        .filter((channel) => isChannelSelectedForAnalysis(channel.id))
        .map((channel) => channel.id)

      console.log('📋 Selected channel IDs:', contextSelection)

      // Update our local state
      setSelectedChannelIds(contextSelection)
    }
  }, [initialized, channels, isChannelSelectedForAnalysis])

  // Handle checkbox change
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelIds((prev) => {
      // Ensure we're working with a fresh array
      const newSelection = [...prev]

      if (newSelection.includes(channelId)) {
        return newSelection.filter((id) => id !== channelId)
      } else {
        return [...newSelection, channelId]
      }
    })
  }

  // Save selected channels to backend
  const handleSaveSelection = async () => {
    console.log('💾 SAVE: Saving channel selection')

    // Instead of calculating diffs, we'll set entire selection at once
    try {
      // Show loading toast
      const loadingToastId = toast({
        title: 'Saving selection...',
        status: 'loading',
        duration: null,
        isClosable: false,
      })

      // Simply select all channels in our current UI selection
      const success = await selectChannelsForAnalysis(
        integrationId,
        selectedChannelIds
      )

      // Close loading toast
      toast.close(loadingToastId)

      if (success) {
        // Success feedback
        toast({
          title: 'Selection saved',
          description: 'Your channel selection has been saved successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })

        // Explicitly fetch the latest selection to update the context
        await fetchSelectedChannels(integrationId)

        console.log('✅ Save complete, fetched latest selection')
      } else {
        // Error feedback
        toast({
          title: 'Error saving selection',
          description:
            channelSelectionError?.message || 'Failed to save your selection.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        clearChannelSelectionError()
      }
    } catch (error) {
      console.error('❌ Error in handleSaveSelection:', error)

      // Error feedback
      toast({
        title: 'Error saving selection',
        description:
          'An unexpected error occurred while saving your selection.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  return (
    <Box>
      <Flex mb={4} justifyContent="space-between" alignItems="center">
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <FiSearch color="gray.300" />
          </InputLeftElement>
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        <Button
          colorScheme="blue"
          leftIcon={<FiCheck />}
          onClick={handleSaveSelection}
          isLoading={loadingChannelSelection}
          isDisabled={loadingResources}
        >
          Save Selection
        </Button>
      </Flex>

      <Box overflowX="auto">
        <Table
          variant="simple"
          bg={tableBg}
          borderRadius="lg"
          overflow="hidden"
        >
          <Thead bg={tableHeaderBg}>
            <Tr>
              <Th width="50px">Select</Th>
              <Th>Channel Name</Th>
              <Th>Member Count</Th>
              <Th>Last Synced</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredChannels.map((channel) => (
              <Tr
                key={channel.id}
                _hover={{ bg: rowHoverBg }}
                bg={
                  selectedChannelIds.includes(channel.id)
                    ? 'blue.50'
                    : undefined
                }
              >
                <Td width="50px">
                  <Checkbox
                    isChecked={selectedChannelIds.includes(channel.id)}
                    onChange={() => handleSelectChannel(channel.id)}
                    colorScheme="blue"
                    size="lg"
                  />
                </Td>
                <Td fontWeight="medium">
                  <HStack>
                    <Text>{channel.name}</Text>
                    {channel.metadata?.is_private === true && (
                      <Tag size="sm" colorScheme="purple" borderRadius="full">
                        <TagLabel>Private</TagLabel>
                      </Tag>
                    )}
                  </HStack>
                </Td>
                <Td>
                  {channel.metadata?.num_members !== undefined
                    ? String(channel.metadata.num_members)
                    : 'Unknown'}
                </Td>
                <Td>
                  {channel.last_synced_at
                    ? new Date(channel.last_synced_at).toLocaleString()
                    : 'Never'}
                </Td>
                <Td>
                  <HStack spacing={1}>
                    <IconButton
                      aria-label="Analyze channel"
                      icon={<FiBarChart2 />}
                      size="sm"
                      variant="ghost"
                      title="View analysis"
                    />
                    <IconButton
                      aria-label="Channel settings"
                      icon={<FiSettings />}
                      size="sm"
                      variant="ghost"
                      title="Settings"
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
            {filteredChannels.length === 0 && (
              <Tr>
                <Td colSpan={5} textAlign="center" py={4}>
                  {loadingResources
                    ? 'Loading channels...'
                    : 'No channels found'}
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Flex justifyContent="flex-end" mt={4}>
        <Button
          colorScheme="blue"
          leftIcon={<FiCheck />}
          onClick={handleSaveSelection}
          isLoading={loadingChannelSelection}
          isDisabled={loadingResources}
        >
          Save Selection
        </Button>
      </Flex>
    </Box>
  )
}

export default TeamChannelSelector
