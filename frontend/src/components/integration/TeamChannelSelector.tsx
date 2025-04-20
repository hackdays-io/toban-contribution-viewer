import React, { useState, useEffect } from 'react';
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
  useToast
} from '@chakra-ui/react';
import { FiSearch, FiSettings, FiCheck, FiBarChart2 } from 'react-icons/fi';
import { ResourceType } from '../../lib/integrationService';
import useIntegration from '../../context/useIntegration';

interface TeamChannelSelectorProps {
  integrationId: string;
}

/**
 * Component for selecting channels for analysis in team integrations
 */
const TeamChannelSelector: React.FC<TeamChannelSelectorProps> = ({ integrationId }) => {
  const toast = useToast();
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
    fetchSelectedChannels
  } = useIntegration();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  
  // UI colors
  const tableBg = useColorModeValue('white', 'gray.800');
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700');
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700');
  
  // Filter to only show Slack channels
  const channels = currentResources.filter(
    resource => resource.resource_type === ResourceType.SLACK_CHANNEL
  );
  
  // Apply search filter
  const filteredChannels = searchQuery 
    ? channels.filter(channel => 
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels;

  // Load resources and selected channels when component mounts
  useEffect(() => {
    if (integrationId) {
      // Fetch both resources and selected channels
      const loadData = async () => {
        try {
          await fetchResources(integrationId, [ResourceType.SLACK_CHANNEL]);
          await fetchSelectedChannels(integrationId);
        } catch (err) {
          console.error("Error loading channel data:", err);
          toast({
            title: 'Error loading channels',
            description: err instanceof Error 
              ? `Error: ${err.message}` 
              : 'There was an error loading the channel selection data.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      
      loadData();
    }
  }, [integrationId, fetchResources, fetchSelectedChannels, toast]);
  
  // Initialize selected channels from context
  useEffect(() => {
    if (channels.length > 0) {
      setSelectedChannels(prev => {
        const newSelectedChannels = new Set<string>();
        channels.forEach(channel => {
          if (isChannelSelectedForAnalysis(channel.id)) {
            newSelectedChannels.add(channel.id);
          }
        });
        return newSelectedChannels;
      });
    }
  }, [channels, isChannelSelectedForAnalysis]);

  // Use standard array instead of Set for state to ensure proper React state updates
  // Convert to array for easier debugging and state management
  useEffect(() => {
    console.log('Current selected channels array:', Array.from(selectedChannels));
  }, [selectedChannels]);
  
  // Direct, simplified checkbox handler
  const handleSelectChannel = (channelId: string) => {
    console.log('Handling select channel:', channelId);
    
    setSelectedChannels(prevSelected => {
      // Create copy of previous selected channels
      const newSelected = new Set(prevSelected);
      
      // Toggle selection
      if (newSelected.has(channelId)) {
        console.log('Removing channel from selection:', channelId);
        newSelected.delete(channelId);
      } else {
        console.log('Adding channel to selection:', channelId);
        newSelected.add(channelId);
      }
      
      console.log('New selection:', Array.from(newSelected));
      return newSelected;
    });
    
    // Force React to update with forceUpdate
    const checkbox = document.getElementById(`checkbox-${channelId}`) as HTMLInputElement;
    if (checkbox) {
      // Manually trigger change if needed
      console.log('Current checkbox checked state:', checkbox.checked);
      // Toggle manually if needed in extreme cases
      // checkbox.checked = !checkbox.checked;
    }
  };

  // Save selected channels to backend
  const handleSaveSelection = async () => {
    console.log('Saving channel selection to backend...');
    
    // Find channels to select (in local selection but not in context)
    const channelsToSelect: string[] = [];
    // Find channels to deselect (in context but not in local selection)
    const channelsToDeselect: string[] = [];
    
    // Determine which channels need to be selected or deselected
    channels.forEach(channel => {
      const isSelected = selectedChannels.has(channel.id);
      const wasSelected = isChannelSelectedForAnalysis(channel.id);
      
      console.log(`Channel ${channel.name} (${channel.id}):`, { isSelected, wasSelected });
      
      if (isSelected && !wasSelected) {
        console.log(`Adding ${channel.name} to selection list`);
        channelsToSelect.push(channel.id);
      } else if (!isSelected && wasSelected) {
        console.log(`Adding ${channel.name} to deselection list`);
        channelsToDeselect.push(channel.id);
      }
    });
    
    console.log('Channels to select:', channelsToSelect);
    console.log('Channels to deselect:', channelsToDeselect);
    
    // Perform API operations
    let success = true;
    
    // First handle selections
    if (channelsToSelect.length > 0) {
      console.log('Selecting channels:', channelsToSelect);
      success = await selectChannelsForAnalysis(integrationId, channelsToSelect);
      console.log('Selection result:', success);
    }
    
    // Then handle deselections
    if (success && channelsToDeselect.length > 0) {
      console.log('Deselecting channels:', channelsToDeselect);
      success = await deselectChannelsForAnalysis(integrationId, channelsToDeselect);
      console.log('Deselection result:', success);
    }
    
    // Refresh selected channels from backend after saving
    if (success) {
      console.log('Refreshing selected channels from backend...');
      await fetchSelectedChannels(integrationId);
    }
    
    // Show success or error toast
    if (success) {
      toast({
        title: 'Selection saved',
        description: 'Your channel selection has been saved successfully.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } else if (channelSelectionError) {
      toast({
        title: 'Error saving selection',
        description: channelSelectionError.message || 'An error occurred while saving your selection.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      clearChannelSelectionError();
    }
  };

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
        <Table variant="simple" bg={tableBg} borderRadius="lg" overflow="hidden">
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
                key={`row-${channel.id}`} 
                onClick={(e) => {
                  // Check if click target is the checkbox cell or a child of it
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-checkbox-cell="true"]')) {
                    // Skip if clicked in checkbox cell
                    return;
                  }
                  
                  console.log('Row clicked, toggling selection for:', channel.id);
                  handleSelectChannel(channel.id);
                }}
                cursor="pointer"
                _hover={{ bg: rowHoverBg }}
                bg={selectedChannels.has(channel.id) ? 'blue.50' : undefined}
                data-selected={selectedChannels.has(channel.id)}
              >
                <Td data-checkbox-cell="true">
                  <Box 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Checkbox cell clicked, toggling channel:', channel.id);
                      handleSelectChannel(channel.id);
                    }}
                    cursor="pointer"
                    p={1}
                    data-checkbox-cell="true"
                  >
                    <Checkbox
                      isChecked={selectedChannels.has(channel.id)}
                      colorScheme="blue"
                      id={`checkbox-${channel.id}`}
                      // No onChange handler - handle clicks at the Box level instead
                      // This prevents event bubbling issues
                    />
                  </Box>
                </Td>
                <Td fontWeight="medium">
                  <HStack>
                    <Text>{channel.name}</Text>
                    {channel.metadata?.is_private && (
                      <Tag size="sm" colorScheme="purple" borderRadius="full">
                        <TagLabel>Private</TagLabel>
                      </Tag>
                    )}
                  </HStack>
                </Td>
                <Td>
                  {channel.metadata?.num_members || 'Unknown'}
                </Td>
                <Td>
                  {channel.last_synced_at
                    ? new Date(channel.last_synced_at).toLocaleString()
                    : 'Never'}
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
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
                  {loadingResources ? 'Loading channels...' : 'No channels found'}
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
  );
};

export default TeamChannelSelector;