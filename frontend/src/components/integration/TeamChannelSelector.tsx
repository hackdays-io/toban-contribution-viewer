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
  Tooltip,
  Heading,
  Collapse,
  Badge,
} from '@chakra-ui/react'
import {
  FiSearch,
  FiSettings,
  FiCheck,
  FiBarChart2,
  FiClock,
  FiTrash2,
  FiCheckCircle,
} from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const {
    currentResources,
    loadingResources,
    fetchResources,
    isChannelSelectedForAnalysis,
    selectChannelsForAnalysis,
    loadingChannelSelection,
    channelSelectionError,
    clearChannelSelectionError,
    fetchSelectedChannels,
  } = useIntegration()

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
  const [selectedSearchQuery, setSelectedSearchQuery] = useState('')

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

  // Track if we've done initial load and data fetching - use refs to avoid re-renders
  const didInitialLoadRef = React.useRef(false)
  const didInitialFetchRef = React.useRef(false)

  // Track if a save is in progress
  const [isSaving, setIsSaving] = useState(false)

  // Only load resources and selected channels once when component mounts
  useEffect(() => {
    if (!integrationId || didInitialFetchRef.current) return
    
    // Mark as fetched immediately to prevent duplicate calls
    didInitialFetchRef.current = true
    
    console.log('🔄 INITIALIZATION: Fetching resources and selected channels (ONCE)')
    
    const loadData = async () => {
      try {
        // Reset the selection initialization flag
        didInitialLoadRef.current = false
        
        // First fetch channels
        await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL])
        
        // Then fetch selected channels ONLY ONCE - pass true to skip redundant resource fetch
        await fetchSelectedChannels(integrationId, true) // Skip duplicate resource fetch
        
        console.log('✅ INITIALIZATION: Fetched resources and selected channels')
      } catch (err) {
        console.error('❌ Error loading channel data:', err)
        // Reset fetch flag on error to allow retry
        didInitialFetchRef.current = false
      }
    }

    loadData()
    // Only depend on stable references
  }, [integrationId, fetchResources, fetchSelectedChannels])

  // Set up selection state when currentResources change - only once after resources are loaded
  useEffect(() => {
    // Skip if we've already initialized selections
    if (didInitialLoadRef.current) {
      return;
    }
    
    // Only process if we have channels to work with
    if (channels.length === 0) {
      return;
    }
    
    // This will only run once after initial fetch completes
    console.log('🔄 Setting up selection state for', channels.length, 'channels (ONE TIME ONLY)')
    
    // Process channels to find selected ones
    const selectedIds = channels
      .filter(channel => {
        // Check direct properties first
        if (channel.is_selected_for_analysis === true) {
          return true;
        }
        
        // Then check metadata
        if (channel.metadata?.is_selected_for_analysis === true) {
          return true;
        }
        
        // Finally check context method
        return isChannelSelectedForAnalysis(channel.id);
      })
      .map(channel => channel.id);
    
    console.log(`📋 Found ${selectedIds.length} selected channels`);
    
    // Set selected channel IDs
    setSelectedChannelIds(selectedIds);
    
    // Mark as initialized to prevent running again
    didInitialLoadRef.current = true;
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.length]) // Only depend on channels.length to detect when channels are available

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

  // Handle select all (filtered channels only)
  const handleSelectAll = () => {
    const filteredIds = filteredChannels.map((channel) => channel.id)
    setSelectedChannelIds((prev) => {
      // Add all filtered channel IDs that aren't already in the selection
      const newSelection = [...prev]
      filteredIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id)
        }
      })
      return newSelection
    })
  }

  // Handle deselect all (filtered channels only)
  const handleDeselectAll = () => {
    const filteredIds = filteredChannels.map((channel) => channel.id)
    setSelectedChannelIds((prev) =>
      prev.filter((id) => !filteredIds.includes(id))
    )
  }

  // Save selected channels to backend
  const handleSaveSelection = async () => {
    if (isSaving) return // Prevent double-saves

    console.log('💾 SAVE: Saving channel selection')
    console.log('📋 Current selection to save:', selectedChannelIds)

    try {
      setIsSaving(true)

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

        console.log('✅ Save complete')
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
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box>
      <Flex mb={3} justifyContent="space-between" alignItems="center">
        <Heading size="md">Channel Manager</Heading>

        <Button
          colorScheme="blue"
          leftIcon={<FiCheck />}
          onClick={handleSaveSelection}
          isLoading={isSaving || loadingChannelSelection}
          isDisabled={loadingResources}
        >
          Save Selection
        </Button>
      </Flex>

      {/* Selected Channels Panel */}
      <Collapse in={selectedChannelIds.length > 0} animateOpacity>
        <Box
          mb={6}
          borderWidth="1px"
          borderRadius="lg"
          p={4}
          bg={useColorModeValue('white', 'gray.800')}
        >
          <Flex alignItems="center" mb={3} justifyContent="space-between">
            <HStack>
              <FiCheckCircle color="green" />
              <Heading size="md">
                Selected Channels ({selectedChannelIds.length})
              </Heading>
            </HStack>
            <Badge
              colorScheme="green"
              fontSize="sm"
              px={2}
              py={1}
              borderRadius="full"
            >
              {selectedChannelIds.length} selected
            </Badge>
          </Flex>

          <InputGroup size="sm" mb={3} maxW="300px">
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Filter selected channels..."
              value={selectedSearchQuery}
              onChange={(e) => setSelectedSearchQuery(e.target.value)}
              size="sm"
            />
          </InputGroup>

          <Box overflowX="auto" maxH="300px" overflowY="auto">
            <Table size="sm" variant="simple">
              <Thead bg={tableHeaderBg}>
                <Tr>
                  <Th>Channel</Th>
                  <Th>Members</Th>
                  <Th width="100px">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(() => {
                  const filteredSelectedChannels = channels
                    .filter((channel) =>
                      selectedChannelIds.includes(channel.id)
                    )
                    .filter(
                      (channel) =>
                        selectedSearchQuery === '' ||
                        channel.name
                          .toLowerCase()
                          .includes(selectedSearchQuery.toLowerCase())
                    )

                  if (filteredSelectedChannels.length === 0) {
                    return (
                      <Tr>
                        <Td colSpan={3} textAlign="center" py={4}>
                          {selectedSearchQuery
                            ? 'No selected channels match your filter'
                            : 'No channels selected'}
                        </Td>
                      </Tr>
                    )
                  }

                  return filteredSelectedChannels.map((channel) => (
                    <Tr key={`selected-${channel.id}`}>
                      <Td fontWeight="medium">
                        <HStack>
                          <Text>{channel.name}</Text>
                          {channel.metadata?.is_private === true && (
                            <Tag
                              size="sm"
                              colorScheme="purple"
                              borderRadius="full"
                            >
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
                        <Tooltip label="Remove from selection">
                          <IconButton
                            aria-label="Remove from selection"
                            icon={<FiTrash2 />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleSelectChannel(channel.id)}
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))
                })()}
              </Tbody>
            </Table>
          </Box>
        </Box>
      </Collapse>

      <Box mt={6}>
        <Flex mb={3} justifyContent="space-between" alignItems="center">
          <Heading size="md">All Channels</Heading>

          {selectedChannelIds.length > 0 && (
            <Text color="blue.600" fontWeight="medium">
              {selectedChannelIds.length} channel
              {selectedChannelIds.length !== 1 ? 's' : ''} selected
            </Text>
          )}
        </Flex>

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

          <HStack spacing={2}>
            <Button
              size="xs"
              onClick={handleSelectAll}
              variant="outline"
              colorScheme="blue"
              isDisabled={filteredChannels.length === 0}
            >
              Select All
            </Button>
            <Button
              size="xs"
              onClick={handleDeselectAll}
              variant="outline"
              colorScheme="red"
              isDisabled={
                filteredChannels.length === 0 ||
                !filteredChannels.some((c) => selectedChannelIds.includes(c.id))
              }
            >
              Deselect All
            </Button>
          </HStack>
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
                      <Tooltip label="Analyze channel">
                        <IconButton
                          aria-label="Analyze channel"
                          icon={<FiBarChart2 />}
                          size="sm"
                          variant="ghost"
                          colorScheme="blue"
                          onClick={() =>
                            navigate(
                              `/dashboard/integrations/${integrationId}/channels/${channel.id}/analyze`
                            )
                          }
                        />
                      </Tooltip>
                      <Tooltip label="Analysis history">
                        <IconButton
                          aria-label="Analysis history"
                          icon={<FiClock />}
                          size="sm"
                          variant="ghost"
                          colorScheme="teal"
                          onClick={() =>
                            navigate(
                              `/dashboard/integrations/${integrationId}/channels/${channel.id}/history`
                            )
                          }
                        />
                      </Tooltip>
                      <Tooltip label="Channel settings">
                        <IconButton
                          aria-label="Channel settings"
                          icon={<FiSettings />}
                          size="sm"
                          variant="ghost"
                          title="Settings"
                        />
                      </Tooltip>
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
      </Box>

      <Flex justifyContent="flex-end" mt={4}>
        <Button
          colorScheme="blue"
          leftIcon={<FiCheck />}
          onClick={handleSaveSelection}
          isLoading={isSaving || loadingChannelSelection}
          isDisabled={loadingResources}
        >
          Save Selection
        </Button>
      </Flex>
    </Box>
  )
}

export default TeamChannelSelector
