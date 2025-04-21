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
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider,
} from '@chakra-ui/react'
import {
  FiSearch,
  FiSettings,
  FiCheck,
  FiBarChart2,
  FiClock,
  FiTrash2,
  FiCheckCircle,
  FiFilter,
  FiChevronDown,
  FiRefreshCw,
} from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { ResourceType } from '../../lib/integrationService'
import useIntegration from '../../context/useIntegration'

// Global tracker to prevent duplicate initialization across re-renders
// This ensures each integration is only initialized once per app session
const globalInitializationTracker = new Set<string>()

interface ResourcesAnalysisTabProps {
  integrationId: string
}

/**
 * Unified component that combines resource listing and channel selection for analysis
 */
const ResourcesAnalysisTab: React.FC<ResourcesAnalysisTabProps> = ({
  integrationId,
}) => {
  // =========== ONE-TIME INITIALIZATION - GUARANTEED ============
  // We use useLayoutEffect with highest priority at the top of the component
  // to ensure this runs exactly once before anything else
  // Get context functions before the layout effect
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
    syncResources,
  } = useIntegration();

  // Now we can reference those functions in our layout effect
  React.useLayoutEffect(() => {
    // This runs only once per component lifecycle
    console.log('🚀 STRICTLY ONE-TIME INITIALIZATION STARTING');
    
    // Only run data loading logic if we haven't already
    if (!globalInitializationTracker.has(integrationId)) {
      console.log(`🔄 First time loading data for integration ${integrationId}`);
      
      // Mark this integration ID as initialized immediately
      globalInitializationTracker.add(integrationId);
      
      // Load the data once at the beginning
      const initialize = async () => {
        try {
          // Sequential loading to avoid race conditions
          // Explicitly request BOTH channels and users
          await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER]);
          await fetchSelectedChannels(integrationId);
          
          // Successfully initialized, don't need to log here
        } catch (err) {
          console.error('❌ Error loading initial data:', err);
        }
      };
      
      initialize();
    } else {
      console.log(`🔍 Integration ${integrationId} already initialized - SKIPPING`);
    }
    
    return () => {
      // This code runs when component unmounts
      console.log(`🧹 Cleaning up initialization for ${integrationId}`);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Deliberately empty - this runs ONCE per component instance
  // ===============================================================
  
  const toast = useToast()
  const navigate = useNavigate()

  // State is managed by the Tabs component directly, no need for internal state

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
  const [selectedSearchQuery, setSelectedSearchQuery] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceType | 'all'>('all')

  // UI colors
  const tableBg = useColorModeValue('white', 'gray.800')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700')

  // Filter resources by type if filter is active
  const filteredByTypeResources = resourceTypeFilter === 'all' 
    ? currentResources 
    : currentResources.filter(resource => resource.resource_type === resourceTypeFilter)

  // Get channels (for selection functionality)
  const channels = currentResources.filter(
    (resource) => resource.resource_type === ResourceType.SLACK_CHANNEL
  )

  // Apply search filter
  const filteredResources = searchQuery
    ? filteredByTypeResources.filter((resource) =>
        resource.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByTypeResources

  // Filter channels for the channel selection tab
  const filteredChannels = searchQuery
    ? channels.filter((channel) =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels

  // Track if a save is in progress
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Track selections initialization 
  const selectionsInitialized = React.useRef(false)

  // Log resource counts once on first successful load only
  const didLogResourcesRef = React.useRef(false);
  useEffect(() => {
    // Only log once and only when we have data
    if (currentResources.length > 0 && !didLogResourcesRef.current) {
      didLogResourcesRef.current = true;
      
      const users = currentResources.filter(r => r.resource_type === ResourceType.SLACK_USER);
      const channels = currentResources.filter(r => r.resource_type === ResourceType.SLACK_CHANNEL);
      
      console.log('📊 RESOURCES LOADED SUCCESSFULLY:');
      console.log('🧑‍💻 SLACK_USERS:', users.length);
      console.log('📢 SLACK_CHANNELS:', channels.length);
      console.log('💬 TOTAL RESOURCES:', currentResources.length);
    }
  }, [currentResources]);
  
  // This effect ONLY sets up the selected channels after resources are loaded
  useEffect(() => {
    // Skip if we've already initialized selections or if there are no channels
    if (selectionsInitialized.current || currentResources.length === 0) {
      return;
    }
    
    // Only try to initialize selections if we have channel resources
    const availableChannels = currentResources.filter(
      resource => resource.resource_type === ResourceType.SLACK_CHANNEL
    );
    
    if (availableChannels.length === 0) {
      return;
    }
    
    console.log('📋 Initializing selection state with', availableChannels.length, 'channels');
    
    // Find selected channels
    const selectedIds = availableChannels
      .filter(channel => 
        channel.is_selected_for_analysis === true || 
        channel.metadata?.is_selected_for_analysis === true ||
        isChannelSelectedForAnalysis(channel.id)
      )
      .map(channel => channel.id);
    
    // Set selected channels once
    setSelectedChannelIds(selectedIds);
    console.log(`✅ Selection state initialized with ${selectedIds.length} selected channels`);
    selectionsInitialized.current = true;
    
  }, [currentResources, isChannelSelectedForAnalysis]);

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

  // Helper function to get readable resource type
  const getReadableResourceType = (type: ResourceType): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Handler for syncing resources
  const handleSyncResources = async () => {
    if (!integrationId) return

    setIsSyncing(true)
    
    try {
      // Call syncResources specifically requesting both channels AND users
      const success = await syncResources(
        integrationId, 
        [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER]
      );
      
      if (success === true) {
        // Get updated counts for the toast message
        const userCount = currentResources.filter(r => r.resource_type === ResourceType.SLACK_USER).length;
        const channelCount = currentResources.filter(r => r.resource_type === ResourceType.SLACK_CHANNEL).length;
        
        toast({
          title: 'Resources synced successfully',
          description: `Updated ${channelCount} channels and ${userCount} users`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        const errorMessage = 'Failed to sync resources';
        toast({
          title: 'Failed to sync resources',
          description: errorMessage,
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error) {
      toast({
        title: 'Error syncing resources',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Switching between tabs
  const handleTabChange = () => {
    // Reset search when switching tabs
    setSearchQuery('')
  }

  return (
    <Box>
      <Flex mb={4} justifyContent="space-between" alignItems="center">
        <HStack>
          <Heading size="md">Resources & Analysis</Heading>
          {selectedChannelIds.length > 0 && (
            <Badge 
              colorScheme="green"
              fontSize="sm" 
              px={2} 
              py={1} 
              borderRadius="full"
            >
              {selectedChannelIds.length} selected
            </Badge>
          )}
        </HStack>

        <HStack spacing={3}>
          <Button
            leftIcon={<FiRefreshCw />}
            onClick={handleSyncResources}
            isLoading={isSyncing}
            variant="outline"
            size="sm"
          >
            Sync
          </Button>
          
          <Button
            colorScheme="blue"
            leftIcon={<FiCheck />}
            onClick={handleSaveSelection}
            isLoading={isSaving || loadingChannelSelection}
            isDisabled={loadingResources}
          >
            Save Selection
          </Button>
        </HStack>
      </Flex>

      <Tabs id="resourceTabs" variant="enclosed" colorScheme="blue" onChange={handleTabChange} mb={4}>
        <TabList>
          <Tab>All Resources</Tab>
          <Tab>Selected for Analysis {selectedChannelIds.length > 0 && `(${selectedChannelIds.length})`}</Tab>
        </TabList>

        <TabPanels>
          {/* All Resources Tab */}
          <TabPanel p={0} pt={4}>
            <Flex mb={4} justifyContent="space-between" alignItems="center">
              <InputGroup maxW="400px">
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="gray.300" />
                </InputLeftElement>
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>

              <HStack spacing={2}>
                <Menu>
                  <MenuButton 
                    as={Button} 
                    rightIcon={<FiChevronDown />}
                    leftIcon={<FiFilter />}
                    variant="outline"
                    size="sm"
                  >
                    {resourceTypeFilter === 'all' 
                      ? 'All Types' 
                      : getReadableResourceType(resourceTypeFilter)}
                  </MenuButton>
                  <MenuList>
                    <MenuItem onClick={() => setResourceTypeFilter('all')}>
                      All Types
                    </MenuItem>
                    <Divider />
                    <MenuItem 
                      onClick={() => setResourceTypeFilter(ResourceType.SLACK_CHANNEL)}
                      icon={<FiCheck visibility={resourceTypeFilter === ResourceType.SLACK_CHANNEL ? 'visible' : 'hidden'} />}
                    >
                      Slack Channels
                    </MenuItem>
                    <MenuItem 
                      onClick={() => setResourceTypeFilter(ResourceType.SLACK_USER)}
                      icon={<FiCheck visibility={resourceTypeFilter === ResourceType.SLACK_USER ? 'visible' : 'hidden'} />}
                    >
                      Slack Users
                    </MenuItem>
                  </MenuList>
                </Menu>

                <Button
                  size="sm"
                  onClick={handleSelectAll}
                  variant="outline"
                  colorScheme="blue"
                  isDisabled={filteredChannels.length === 0}
                >
                  Select All Channels
                </Button>
                <Button
                  size="sm"
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
                    {/* Always show checkbox column if any channel resources are visible */}
                    <Th width="50px">Select</Th>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>{resourceTypeFilter === ResourceType.SLACK_CHANNEL ? 'Members' : 'External ID'}</Th>
                    <Th>Last Synced</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredResources.map((resource) => (
                    <Tr
                      key={resource.id}
                      _hover={{ bg: rowHoverBg }}
                      bg={
                        resource.resource_type === ResourceType.SLACK_CHANNEL && 
                        selectedChannelIds.includes(resource.id)
                          ? 'blue.50'
                          : undefined
                      }
                    >
                      <Td width="50px">
                        {resource.resource_type === ResourceType.SLACK_CHANNEL ? (
                          <Checkbox
                            isChecked={selectedChannelIds.includes(resource.id)}
                            onChange={() => handleSelectChannel(resource.id)}
                            colorScheme="blue"
                            size="lg"
                          />
                        ) : (
                          <Box width="20px" />
                        )}
                      </Td>
                      <Td fontWeight="medium">
                        <HStack>
                          <Text>{resource.name}</Text>
                          {resource.resource_type === ResourceType.SLACK_CHANNEL && 
                           resource.metadata?.is_private === true && (
                            <Tag size="sm" colorScheme="purple" borderRadius="full">
                              <TagLabel>Private</TagLabel>
                            </Tag>
                          )}
                        </HStack>
                      </Td>
                      <Td>
                        <Tag size="sm" colorScheme="blue" borderRadius="full">
                          <TagLabel>
                            {getReadableResourceType(
                              resource.resource_type as ResourceType
                            )}
                          </TagLabel>
                        </Tag>
                      </Td>
                      <Td>
                        {resource.resource_type === ResourceType.SLACK_CHANNEL
                          ? resource.metadata?.num_members !== undefined
                            ? String(resource.metadata.num_members)
                            : 'Unknown'
                          : (
                            <Text fontSize="sm" isTruncated maxW="200px">
                              {resource.external_id}
                            </Text>
                          )
                        }
                      </Td>
                      <Td>
                        {resource.last_synced_at
                          ? new Date(resource.last_synced_at).toLocaleString()
                          : 'Never'}
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          {resource.resource_type === ResourceType.SLACK_CHANNEL && (
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
                                      `/dashboard/integrations/${integrationId}/channels/${resource.id}/analyze`
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
                                      `/dashboard/integrations/${integrationId}/channels/${resource.id}/history`
                                    )
                                  }
                                />
                              </Tooltip>
                            </>
                          )}
                          <Tooltip label="Resource settings">
                            <IconButton
                              aria-label="Resource settings"
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
                  {filteredResources.length === 0 && (
                    <Tr>
                      <Td colSpan={6} textAlign="center" py={4}>
                        {loadingResources
                          ? 'Loading resources...'
                          : 'No resources found'}
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          {/* Selected Resources Tab */}
          <TabPanel p={0} pt={4}>
            {selectedChannelIds.length === 0 ? (
              <Box 
                borderWidth="1px" 
                borderRadius="lg" 
                p={6} 
                textAlign="center"
                bg={tableBg}
              >
                <Text mb={4}>No channels are currently selected for analysis.</Text>
                <Text mb={4}>
                  Select channels from the "All Resources" tab to enable analysis.
                </Text>
                <Button 
                  onClick={() => {
                    const tabsEl = document.getElementById('resourceTabs');
                    const firstTab = tabsEl?.querySelector('.chakra-tabs__tab');
                    if (firstTab) {
                      (firstTab as HTMLElement).click();
                    }
                  }}
                  colorScheme="blue"
                >
                  Go to All Resources
                </Button>
              </Box>
            ) : (
              <Box 
                borderWidth="1px" 
                borderRadius="lg" 
                p={4} 
                bg={tableBg}
              >
                <Flex alignItems="center" mb={3} justifyContent="space-between">
                  <HStack>
                    <FiCheckCircle color="green" />
                    <Heading size="md">
                      Selected for Analysis ({selectedChannelIds.length})
                    </Heading>
                  </HStack>
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
                        <Th>Last Synced</Th>
                        <Th width="150px">Actions</Th>
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
                              <Td colSpan={4} textAlign="center" py={4}>
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
                      })()}
                    </Tbody>
                  </Table>
                </Box>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

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

export default ResourcesAnalysisTab