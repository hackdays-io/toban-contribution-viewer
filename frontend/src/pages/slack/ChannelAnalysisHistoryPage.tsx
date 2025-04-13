import React, { useEffect, useState } from 'react';
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  Heading,
  Icon,
  Spinner,
  Text,
  useToast,
  Card,
  CardHeader,
  CardBody,
  HStack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  SimpleGrid,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiChevronRight, FiArrowLeft, FiClock, FiFileText } from 'react-icons/fi';
import { Link, useParams, useNavigate } from 'react-router-dom';
import env from '../../config/env';

interface StoredAnalysisResponse {
  id: string;
  channel_id: string;
  channel_name: string;
  start_date: string;
  end_date: string;
  message_count: number;
  participant_count: number;
  thread_count: number;
  reaction_count: number;
  channel_summary: string;
  topic_analysis: string;
  contributor_insights: string;
  key_highlights: string;
  model_used: string;
  generated_at: string;
}

interface Channel {
  id: string;
  name: string;
  topic: string;
  purpose: string;
  is_archived: boolean;
  member_count: number;
  is_bot_member: boolean;
  is_selected_for_analysis: boolean;
}

const ChannelAnalysisHistoryPage: React.FC = () => {
  const { workspaceId, channelId } = useParams<{ workspaceId: string; channelId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [channel, setChannel] = useState<Channel | null>(null);
  const [analyses, setAnalyses] = useState<StoredAnalysisResponse[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<StoredAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);

  const highlightBg = useColorModeValue('purple.50', 'purple.900');
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  useEffect(() => {
    if (workspaceId && channelId) {
      fetchChannel();
      fetchAnalysisHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, channelId]);

  const fetchChannel = async () => {
    try {
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/${channelId}`
      );
      
      if (!response.ok) {
        throw new Error(`Error fetching channel: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setChannel(data);
    } catch (error) {
      console.error('Error fetching channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to load channel information',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const fetchAnalysisHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels/${channelId}/analyses`
      );
      
      if (!response.ok) {
        throw new Error(`Error fetching analyses: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalyses(data);
      
      if (data.length > 0) {
        setSelectedAnalysis(data[0]); // Select the most recent analysis by default
      }
    } catch (error) {
      console.error('Error fetching analysis history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analysis history',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisSelect = (analysis: StoredAnalysisResponse) => {
    setSelectedAnalysis(analysis);
    setCurrentTab(0); // Reset to summary tab when selecting a new analysis
  };

  const renderHistoryTable = () => {
    return (
      <Box overflowX="auto" mb={6}>
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Period</Th>
              <Th>Messages</Th>
              <Th>Model</Th>
              <Th>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {analyses.map((analysis) => (
              <Tr 
                key={analysis.id}
                bg={selectedAnalysis?.id === analysis.id ? highlightBg : undefined}
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
              >
                <Td>{formatDate(analysis.generated_at)}</Td>
                <Td>
                  {new Date(analysis.start_date).toLocaleDateString()} - {new Date(analysis.end_date).toLocaleDateString()}
                </Td>
                <Td>{analysis.message_count}</Td>
                <Td>
                  <Badge colorScheme="purple" fontSize="xs">
                    {analysis.model_used?.split('/').pop() || 'AI Model'}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="xs"
                    colorScheme="purple"
                    variant={selectedAnalysis?.id === analysis.id ? "solid" : "outline"}
                    onClick={() => handleAnalysisSelect(analysis)}
                  >
                    View
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    );
  };

  const renderAnalysisContent = () => {
    if (!selectedAnalysis) {
      return (
        <Box textAlign="center" py={10}>
          <Text>No analysis selected. Please select an analysis from the table above.</Text>
        </Box>
      );
    }

    return (
      <Tabs index={currentTab} onChange={setCurrentTab} colorScheme="purple" isLazy>
        <TabList>
          <Tab>Summary</Tab>
          <Tab>Topics</Tab>
          <Tab>Contributors</Tab>
          <Tab>Highlights</Tab>
        </TabList>
        
        <TabPanels>
          {/* Summary Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>Channel Summary</Heading>
              <Text whiteSpace="pre-wrap">{selectedAnalysis.channel_summary}</Text>
              
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mt={6}>
                <Stat>
                  <StatLabel>Messages</StatLabel>
                  <StatNumber>{selectedAnalysis.message_count}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Participants</StatLabel>
                  <StatNumber>{selectedAnalysis.participant_count}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Threads</StatLabel>
                  <StatNumber>{selectedAnalysis.thread_count}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Reactions</StatLabel>
                  <StatNumber>{selectedAnalysis.reaction_count}</StatNumber>
                </Stat>
              </SimpleGrid>
            </Box>
          </TabPanel>
          
          {/* Topics Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>Topic Analysis</Heading>
              <Text whiteSpace="pre-wrap">{selectedAnalysis.topic_analysis}</Text>
            </Box>
          </TabPanel>
          
          {/* Contributors Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>Contributor Insights</Heading>
              <Text whiteSpace="pre-wrap">{selectedAnalysis.contributor_insights}</Text>
            </Box>
          </TabPanel>
          
          {/* Highlights Panel */}
          <TabPanel>
            <Box>
              <Heading as="h3" size="md" mb={4}>Key Highlights</Heading>
              <Text whiteSpace="pre-wrap">{selectedAnalysis.key_highlights}</Text>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    );
  };

  return (
    <Box p={6} width="100%" maxWidth="1200px" mx="auto">
      {/* Breadcrumb navigation */}
      <Breadcrumb spacing="8px" separator={<Icon as={FiChevronRight} color="gray.500" />} mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard/analytics">
            Analytics
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard/analytics/slack">
            Slack
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>{channel?.name ? `#${channel.name} History` : 'Channel History'}</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">
          {channel?.name ? `#${channel.name} Analysis History` : 'Channel Analysis History'}
        </Heading>
        <HStack spacing={3}>
          <Button
            leftIcon={<Icon as={FiArrowLeft} />}
            onClick={() => navigate(`/dashboard/analytics/slack`)}
            variant="outline"
          >
            Back to Channels
          </Button>
          <Button
            leftIcon={<Icon as={FiClock} />}
            colorScheme="purple"
            onClick={() => navigate(`/dashboard/analytics/slack/channels/${workspaceId}/${channelId}/analyze`)}
          >
            New Analysis
          </Button>
        </HStack>
      </Flex>

      {isLoading ? (
        <Flex justify="center" align="center" minHeight="400px">
          <Spinner size="xl" color="purple.500" thickness="4px" />
        </Flex>
      ) : analyses.length === 0 ? (
        <Card>
          <CardBody>
            <Box textAlign="center" py={10}>
              <Icon as={FiFileText} boxSize={12} color="gray.400" mb={4} />
              <Heading as="h3" size="md" mb={2}>No Analysis History</Heading>
              <Text mb={6}>There are no saved analyses for this channel yet.</Text>
              <Button
                colorScheme="purple"
                onClick={() => navigate(`/dashboard/analytics/slack/channels/${workspaceId}/${channelId}/analyze`)}
              >
                Run Analysis
              </Button>
            </Box>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card mb={6} variant="outline">
            <CardHeader>
              <Heading size="md">Analysis History</Heading>
            </CardHeader>
            <CardBody>
              {renderHistoryTable()}
            </CardBody>
          </Card>

          <Card variant="outline">
            <CardHeader>
              <Heading size="md">Analysis Results</Heading>
              <Text color="gray.500" fontSize="sm" mt={1}>
                Generated on {selectedAnalysis ? formatDate(selectedAnalysis.generated_at) : ''}
              </Text>
            </CardHeader>
            <CardBody>
              {renderAnalysisContent()}
            </CardBody>
          </Card>
        </>
      )}
    </Box>
  );
};

export default ChannelAnalysisHistoryPage;
