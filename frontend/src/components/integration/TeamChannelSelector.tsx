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
import { ServiceResource, ResourceType } from '../../lib/integrationService';
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
    clearChannelSelectionError
  } = useIntegration();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  
  // UI colors
  const tableBg = useColorModeValue('white', 'gray.800');
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700');
  
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
      fetchResources(integrationId, [ResourceType.SLACK_CHANNEL]);
    }
  }, [integrationId, fetchResources]);
  
  // Initialize selected channels from context
  useEffect(() => {
    const newSelectedChannels = new Set<string>();
    channels.forEach(channel => {
      if (isChannelSelectedForAnalysis(channel.id)) {
        newSelectedChannels.add(channel.id);
      }
    });
    setSelectedChannels(newSelectedChannels);
  }, [channels, isChannelSelectedForAnalysis]);

  // Handle checkbox change
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannels(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(channelId)) {
        newSelection.delete(channelId);
      } else {
        newSelection.add(channelId);
      }
      return newSelection;
    });
  };

  // Save selected channels to backend
  const handleSaveSelection = async () => {
    // Find channels to select (in local selection but not in context)
    const channelsToSelect: string[] = [];
    // Find channels to deselect (in context but not in local selection)
    const channelsToDeselect: string[] = [];
    
    // Determine which channels need to be selected or deselected
    channels.forEach(channel => {
      const isSelected = selectedChannels.has(channel.id);
      const wasSelected = isChannelSelectedForAnalysis(channel.id);
      
      if (isSelected && !wasSelected) {
        channelsToSelect.push(channel.id);
      } else if (!isSelected && wasSelected) {
        channelsToDeselect.push(channel.id);
      }
    });
    
    // Perform API operations
    let success = true;
    
    if (channelsToSelect.length > 0) {
      success = await selectChannelsForAnalysis(integrationId, channelsToSelect);
    }
    
    if (success && channelsToDeselect.length > 0) {
      success = await deselectChannelsForAnalysis(integrationId, channelsToDeselect);
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
              <Tr key={channel.id}>
                <Td>
                  <Checkbox
                    isChecked={selectedChannels.has(channel.id)}
                    onChange={() => handleSelectChannel(channel.id)}
                    colorScheme="blue"
                  />
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