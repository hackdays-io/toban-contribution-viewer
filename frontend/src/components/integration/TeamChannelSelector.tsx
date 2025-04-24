import React, { useState, useEffect, useMemo } from 'react'
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
  Select,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  VStack,
  RadioGroup,
  Radio,
  Stack,
} from '@chakra-ui/react'
import {
  FiSearch,
  FiCheck,
  FiBarChart2,
  FiClock,
  FiTrash2,
  FiCheckCircle,
  FiFilter,
  FiChevronDown,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { ResourceType, ServiceResource } from '../../lib/integrationService'
import useIntegration from '../../context/useIntegration'

// Type definitions
interface TeamChannelSelectorProps {
  integrationId: string
  multiSelect?: boolean
  onSelectionChange?: (selectedIds: string[]) => void
  initialSelection?: string[]
}

// Channel type filter options
enum ChannelType {
  ALL = 'all',
  PUBLIC = 'public',
  PRIVATE = 'private',
}

// Sort options for channels
enum SortOption {
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  MEMBERS_ASC = 'members_asc',
  MEMBERS_DESC = 'members_desc',
  LAST_SYNCED_ASC = 'last_synced_asc',
  LAST_SYNCED_DESC = 'last_synced_desc',
}

/**
 * Component for selecting channels for analysis in team integrations
 */
const TeamChannelSelector: React.FC<TeamChannelSelectorProps> = ({
  integrationId,
  multiSelect = false,
  onSelectionChange,
  initialSelection = [],
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
  const [channelTypeFilter, setChannelTypeFilter] = useState<ChannelType>(
    ChannelType.ALL
  )
  const [showArchived, setShowArchived] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.NAME_ASC)

  // UI colors
  const tableBg = useColorModeValue('white', 'gray.800')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700')
  const selectedBg = useColorModeValue('blue.50', 'blue.900')

  // Track if we've done initial load and data fetching - use refs to avoid re-renders
  const didInitialLoadRef = React.useRef(false)
  const didInitialFetchRef = React.useRef(false)

  // Track if a save is in progress
  const [isSaving, setIsSaving] = useState(false)

  // Filter to only show Slack channels
  const channels = useMemo(() => {
    return currentResources.filter(
      (resource) => resource.resource_type === ResourceType.SLACK_CHANNEL
    )
  }, [currentResources])

  // Only load resources and selected channels once when component mounts
  useEffect(() => {
    if (!integrationId || didInitialFetchRef.current) return

    // Mark as fetched immediately to prevent duplicate calls
    didInitialFetchRef.current = true

    console.log(
      '🔄 INITIALIZATION: Fetching resources and selected channels (ONCE)'
    )

    const loadData = async () => {
      try {
        // Reset the selection initialization flag
        didInitialLoadRef.current = false

        // First fetch channels
        await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL])

        // Then fetch selected channels ONLY ONCE
        await fetchSelectedChannels(integrationId)

        console.log(
          '✅ INITIALIZATION: Fetched resources and selected channels'
        )
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
      return
    }

    // Only process if we have channels to work with
    if (channels.length === 0) {
      return
    }

    // This will only run once after initial fetch completes
    console.log(
      '🔄 Setting up selection state for',
      channels.length,
      'channels (ONE TIME ONLY)'
    )

    // If we have initialSelection, use it
    if (initialSelection.length > 0) {
      console.log(
        `📋 Using provided initial selection: ${initialSelection.length} channels`
      )
      setSelectedChannelIds(initialSelection)
    } else {
      // Otherwise, process channels to find selected ones
      const selectedIds = channels
        .filter((channel) => {
          // Check direct properties first
          if (channel.is_selected_for_analysis === true) {
            return true
          }

          // Then check metadata
          if (channel.metadata?.is_selected_for_analysis === true) {
            return true
          }

          // Finally check context method
          return isChannelSelectedForAnalysis(channel.id)
        })
        .map((channel) => channel.id)

      console.log(`📋 Found ${selectedIds.length} selected channels`)

      // Set selected channel IDs
      setSelectedChannelIds(selectedIds)
    }

    // Mark as initialized to prevent running again
    didInitialLoadRef.current = true

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.length, initialSelection]) // Depend on channels.length and initialSelection

  // Apply all filters and sort options
  const filteredAndSortedChannels = useMemo(() => {
    // First, filter by archive status
    let result = showArchived
      ? channels
      : channels.filter((channel) => !channel.metadata?.is_archived)

    // Next, filter by channel type
    if (channelTypeFilter !== ChannelType.ALL) {
      result = result.filter((channel) => {
        const isPrivate = channel.metadata?.is_private === true
        return (channelTypeFilter === ChannelType.PRIVATE) === isPrivate
      })
    }

    // Then apply search query
    if (searchQuery) {
      result = result.filter((channel) =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Finally sort the filtered channels
    result = [...result].sort((a, b) => {
      // Helper function to safely get member count
      const getMemberCount = (channel: ServiceResource) => {
        return channel.metadata?.member_count !== undefined
          ? Number(channel.metadata.member_count)
          : -1
      }

      // Helper function to safely get last synced date
      const getLastSyncedTime = (channel: ServiceResource) => {
        return channel.last_synced_at
          ? new Date(channel.last_synced_at).getTime()
          : 0
      }

      switch (sortOption) {
        case SortOption.NAME_ASC:
          return a.name.localeCompare(b.name)
        case SortOption.NAME_DESC:
          return b.name.localeCompare(a.name)
        case SortOption.MEMBERS_ASC:
          return getMemberCount(a) - getMemberCount(b)
        case SortOption.MEMBERS_DESC:
          return getMemberCount(b) - getMemberCount(a)
        case SortOption.LAST_SYNCED_ASC:
          return getLastSyncedTime(a) - getLastSyncedTime(b)
        case SortOption.LAST_SYNCED_DESC:
          return getLastSyncedTime(b) - getLastSyncedTime(a)
        default:
          return 0
      }
    })

    return result
  }, [channels, searchQuery, channelTypeFilter, showArchived, sortOption])

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedChannels.length / pageSize)
  const paginatedChannels = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedChannels.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedChannels, currentPage, pageSize])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, channelTypeFilter, showArchived, sortOption, pageSize])

  // Handle checkbox change
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelIds((prev) => {
      // Ensure we're working with a fresh array
      const newSelection = [...prev]

      if (newSelection.includes(channelId)) {
        return newSelection.filter((id) => id !== channelId)
      } else {
        // In single select mode, replace the selection
        if (!multiSelect) {
          return [channelId]
        }
        // In multi-select mode, add to the selection
        return [...newSelection, channelId]
      }
    })
  }

  // Handle select all (filtered channels only)
  const handleSelectAll = () => {
    // In single select mode, we don't allow selecting all
    if (!multiSelect) return

    const filteredIds = paginatedChannels.map((channel) => channel.id)
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
    const filteredIds = paginatedChannels.map((channel) => channel.id)
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

  // Notify parent component when selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedChannelIds)
    }
  }, [selectedChannelIds, onSelectionChange])

  // Check if bot is installed in a channel
  const hasBotInstalled = (channel: ServiceResource) => {
    return channel.metadata?.has_bot === true
  }

  // Get selected channels data
  const selectedChannelsData = useMemo(() => {
    // First filter by selection and search term
    const filteredChannels = channels
      .filter((channel) => selectedChannelIds.includes(channel.id))
      .filter(
        (channel) =>
          selectedSearchQuery === '' ||
          channel.name.toLowerCase().includes(selectedSearchQuery.toLowerCase())
      )

    // Then apply the same sorting logic as the main channels table
    return [...filteredChannels].sort((a, b) => {
      // Helper function to safely get member count
      const getMemberCount = (channel: ServiceResource) => {
        return channel.metadata?.member_count !== undefined
          ? Number(channel.metadata.member_count)
          : -1
      }

      // Helper function to safely get last synced date
      const getLastSyncedTime = (channel: ServiceResource) => {
        return channel.last_synced_at
          ? new Date(channel.last_synced_at).getTime()
          : 0
      }

      switch (sortOption) {
        case SortOption.NAME_ASC:
          return a.name.localeCompare(b.name)
        case SortOption.NAME_DESC:
          return b.name.localeCompare(a.name)
        case SortOption.MEMBERS_ASC:
          return getMemberCount(a) - getMemberCount(b)
        case SortOption.MEMBERS_DESC:
          return getMemberCount(b) - getMemberCount(a)
        case SortOption.LAST_SYNCED_ASC:
          return getLastSyncedTime(a) - getLastSyncedTime(b)
        case SortOption.LAST_SYNCED_DESC:
          return getLastSyncedTime(b) - getLastSyncedTime(a)
        default:
          return 0
      }
    })
  }, [channels, selectedChannelIds, selectedSearchQuery, sortOption])

  // Column sorting handler
  const handleColumnSort = (column: 'name' | 'members' | 'lastSynced') => {
    switch (column) {
      case 'name':
        setSortOption(
          sortOption === SortOption.NAME_ASC
            ? SortOption.NAME_DESC
            : SortOption.NAME_ASC
        )
        break
      case 'members':
        setSortOption(
          sortOption === SortOption.MEMBERS_ASC
            ? SortOption.MEMBERS_DESC
            : SortOption.MEMBERS_ASC
        )
        break
      case 'lastSynced':
        setSortOption(
          sortOption === SortOption.LAST_SYNCED_ASC
            ? SortOption.LAST_SYNCED_DESC
            : SortOption.LAST_SYNCED_ASC
        )
        break
    }
  }

  // Get sort direction icon for column
  const getSortIcon = (column: 'name' | 'members' | 'lastSynced') => {
    switch (column) {
      case 'name':
        if (sortOption === SortOption.NAME_ASC) return <FiArrowUp />
        if (sortOption === SortOption.NAME_DESC) return <FiArrowDown />
        return null
      case 'members':
        if (sortOption === SortOption.MEMBERS_ASC) return <FiArrowUp />
        if (sortOption === SortOption.MEMBERS_DESC) return <FiArrowDown />
        return null
      case 'lastSynced':
        if (sortOption === SortOption.LAST_SYNCED_ASC) return <FiArrowUp />
        if (sortOption === SortOption.LAST_SYNCED_DESC) return <FiArrowDown />
        return null
      default:
        return null
    }
  }

  // Pagination controls
  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  return (
    <Box>
      <Flex mb={3} justifyContent="space-between" alignItems="center">
        <Heading size="md">
          {multiSelect
            ? 'Channel Selection (Multi-select)'
            : 'Channel Selection'}
        </Heading>

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

          <Flex mb={3} alignItems="center" wrap="wrap" gap={2}>
            <InputGroup size="sm" maxW="300px">
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
          </Flex>

          <Box overflowX="auto" maxH="300px" overflowY="auto">
            <Table size="sm" variant="simple">
              <Thead bg={tableHeaderBg}>
                <Tr>
                  <Th
                    cursor="pointer"
                    onClick={() => handleColumnSort('name')}
                    _hover={{ color: 'blue.500' }}
                  >
                    <HStack spacing={1}>
                      <Text>Channel</Text>
                      {getSortIcon('name')}
                    </HStack>
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleColumnSort('members')}
                    _hover={{ color: 'blue.500' }}
                  >
                    <HStack spacing={1}>
                      <Text>Members</Text>
                      {getSortIcon('members')}
                    </HStack>
                  </Th>
                  <Th width="120px">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {selectedChannelsData.length === 0 ? (
                  <Tr>
                    <Td colSpan={3} textAlign="center" py={4}>
                      {selectedSearchQuery
                        ? 'No selected channels match your filter'
                        : 'No channels selected'}
                    </Td>
                  </Tr>
                ) : (
                  selectedChannelsData.map((channel) => (
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
                          {channel.metadata?.is_archived === true && (
                            <Tag
                              size="sm"
                              colorScheme="gray"
                              borderRadius="full"
                            >
                              <TagLabel>Archived</TagLabel>
                            </Tag>
                          )}
                        </HStack>
                      </Td>
                      <Td>
                        {channel.metadata?.member_count !== undefined
                          ? Number(
                              channel.metadata.member_count
                            ).toLocaleString()
                          : 'Unknown'}
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          {hasBotInstalled(channel) && (
                            <>
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
                            </>
                          )}
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
                        </HStack>
                      </Td>
                    </Tr>
                  ))
                )}
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

        <VStack spacing={4} align="stretch" mb={4}>
          {/* Search and filter row */}
          <Flex
            justifyContent="space-between"
            alignItems="center"
            wrap="wrap"
            gap={2}
          >
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
              {/* Type Filter Menu */}
              <Menu closeOnSelect={false}>
                <MenuButton
                  as={Button}
                  rightIcon={<FiChevronDown />}
                  leftIcon={<FiFilter />}
                  size="sm"
                >
                  Filters
                </MenuButton>
                <MenuList p={2} minWidth="240px">
                  <VStack align="start" spacing={3} width="100%">
                    <Box width="100%">
                      <Text fontWeight="medium" mb={2}>
                        Channel Type
                      </Text>
                      <RadioGroup
                        onChange={(value) =>
                          setChannelTypeFilter(value as ChannelType)
                        }
                        value={channelTypeFilter}
                      >
                        <Stack direction="column">
                          <Radio value={ChannelType.ALL}>All</Radio>
                          <Radio value={ChannelType.PUBLIC}>Public</Radio>
                          <Radio value={ChannelType.PRIVATE}>Private</Radio>
                        </Stack>
                      </RadioGroup>
                    </Box>

                    <Box width="100%">
                      <Text fontWeight="medium" mb={2}>
                        Show Archived
                      </Text>
                      <Checkbox
                        isChecked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                      >
                        Include archived channels
                      </Checkbox>
                    </Box>
                  </VStack>
                </MenuList>
              </Menu>

              {/* Sort Menu */}
              <Menu>
                <MenuButton as={Button} rightIcon={<FiChevronDown />} size="sm">
                  Sort
                </MenuButton>
                <MenuList>
                  <MenuItem
                    onClick={() => setSortOption(SortOption.NAME_ASC)}
                    icon={<FiArrowUp />}
                    fontWeight={
                      sortOption === SortOption.NAME_ASC ? 'bold' : 'normal'
                    }
                  >
                    Name (A-Z)
                  </MenuItem>
                  <MenuItem
                    onClick={() => setSortOption(SortOption.NAME_DESC)}
                    icon={<FiArrowDown />}
                    fontWeight={
                      sortOption === SortOption.NAME_DESC ? 'bold' : 'normal'
                    }
                  >
                    Name (Z-A)
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem
                    onClick={() => setSortOption(SortOption.MEMBERS_ASC)}
                    icon={<FiArrowUp />}
                    fontWeight={
                      sortOption === SortOption.MEMBERS_ASC ? 'bold' : 'normal'
                    }
                  >
                    Members (Low to High)
                  </MenuItem>
                  <MenuItem
                    onClick={() => setSortOption(SortOption.MEMBERS_DESC)}
                    icon={<FiArrowDown />}
                    fontWeight={
                      sortOption === SortOption.MEMBERS_DESC ? 'bold' : 'normal'
                    }
                  >
                    Members (High to Low)
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem
                    onClick={() => setSortOption(SortOption.LAST_SYNCED_ASC)}
                    icon={<FiArrowUp />}
                    fontWeight={
                      sortOption === SortOption.LAST_SYNCED_ASC
                        ? 'bold'
                        : 'normal'
                    }
                  >
                    Last Synced (Oldest First)
                  </MenuItem>
                  <MenuItem
                    onClick={() => setSortOption(SortOption.LAST_SYNCED_DESC)}
                    icon={<FiArrowDown />}
                    fontWeight={
                      sortOption === SortOption.LAST_SYNCED_DESC
                        ? 'bold'
                        : 'normal'
                    }
                  >
                    Last Synced (Newest First)
                  </MenuItem>
                </MenuList>
              </Menu>

              {/* Select/Deselect Buttons */}
              <Button
                size="xs"
                onClick={handleSelectAll}
                variant="outline"
                colorScheme="blue"
                isDisabled={paginatedChannels.length === 0}
              >
                Select All
              </Button>
              <Button
                size="xs"
                onClick={handleDeselectAll}
                variant="outline"
                colorScheme="red"
                isDisabled={
                  paginatedChannels.length === 0 ||
                  !paginatedChannels.some((c) =>
                    selectedChannelIds.includes(c.id)
                  )
                }
              >
                Deselect All
              </Button>
            </HStack>
          </Flex>

          {/* Applied filters indicators */}
          {(channelTypeFilter !== ChannelType.ALL ||
            showArchived ||
            searchQuery) && (
            <Flex wrap="wrap" gap={2} alignItems="center">
              <Text fontSize="sm" color="gray.500">
                Active filters:
              </Text>

              {channelTypeFilter !== ChannelType.ALL && (
                <Tag size="sm" colorScheme="blue" borderRadius="full">
                  <TagLabel>
                    {channelTypeFilter === ChannelType.PRIVATE
                      ? 'Private Channels'
                      : 'Public Channels'}
                  </TagLabel>
                </Tag>
              )}

              {showArchived && (
                <Tag size="sm" colorScheme="gray" borderRadius="full">
                  <TagLabel>Including Archived</TagLabel>
                </Tag>
              )}

              {searchQuery && (
                <Tag size="sm" colorScheme="green" borderRadius="full">
                  <TagLabel>Search: "{searchQuery}"</TagLabel>
                </Tag>
              )}

              <Button
                size="xs"
                onClick={() => {
                  setChannelTypeFilter(ChannelType.ALL)
                  setShowArchived(false)
                  setSearchQuery('')
                }}
              >
                Clear Filters
              </Button>
            </Flex>
          )}
        </VStack>

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
                <Th
                  cursor="pointer"
                  onClick={() => handleColumnSort('name')}
                  _hover={{ color: 'blue.500' }}
                >
                  <HStack spacing={1}>
                    <Text>Channel Name</Text>
                    {getSortIcon('name')}
                  </HStack>
                </Th>
                <Th
                  cursor="pointer"
                  onClick={() => handleColumnSort('members')}
                  _hover={{ color: 'blue.500' }}
                >
                  <HStack spacing={1}>
                    <Text>Member Count</Text>
                    {getSortIcon('members')}
                  </HStack>
                </Th>
                <Th
                  cursor="pointer"
                  onClick={() => handleColumnSort('lastSynced')}
                  _hover={{ color: 'blue.500' }}
                >
                  <HStack spacing={1}>
                    <Text>Last Synced</Text>
                    {getSortIcon('lastSynced')}
                  </HStack>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {paginatedChannels.length === 0 ? (
                <Tr>
                  <Td colSpan={4} textAlign="center" py={4}>
                    {loadingResources
                      ? 'Loading channels...'
                      : 'No channels found matching your filters'}
                  </Td>
                </Tr>
              ) : (
                paginatedChannels.map((channel) => (
                  <Tr
                    key={channel.id}
                    _hover={{ bg: rowHoverBg }}
                    bg={
                      selectedChannelIds.includes(channel.id)
                        ? selectedBg
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
                          <Tag
                            size="sm"
                            colorScheme="purple"
                            borderRadius="full"
                          >
                            <TagLabel>Private</TagLabel>
                          </Tag>
                        )}
                        {channel.metadata?.is_archived === true && (
                          <Tag size="sm" colorScheme="gray" borderRadius="full">
                            <TagLabel>Archived</TagLabel>
                          </Tag>
                        )}
                      </HStack>
                    </Td>
                    <Td>
                      {channel.metadata?.member_count !== undefined
                        ? Number(channel.metadata.member_count).toLocaleString()
                        : 'Unknown'}
                    </Td>
                    <Td>
                      {channel.last_synced_at
                        ? new Date(channel.last_synced_at).toLocaleString()
                        : 'Never'}
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>

        {/* Pagination controls */}
        {filteredAndSortedChannels.length > 0 && (
          <Flex mt={4} justifyContent="space-between" alignItems="center">
            <HStack>
              <Text fontSize="sm">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(
                  currentPage * pageSize,
                  filteredAndSortedChannels.length
                )}{' '}
                of {filteredAndSortedChannels.length} channels
              </Text>
              <Select
                size="sm"
                width="80px"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </Select>
            </HStack>

            <HStack>
              <Button
                size="sm"
                onClick={handlePrevPage}
                isDisabled={currentPage === 1}
              >
                Previous
              </Button>
              <Text fontSize="sm">
                Page {currentPage} of {totalPages}
              </Text>
              <Button
                size="sm"
                onClick={handleNextPage}
                isDisabled={currentPage === totalPages}
              >
                Next
              </Button>
            </HStack>
          </Flex>
        )}
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
