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
  FormControl,
  FormLabel,
  Input,
  HStack,
  VStack,
  Divider,
  SimpleGrid,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Switch,
  FormHelperText,
} from '@chakra-ui/react';
import { FiChevronRight, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { Link, useParams, useNavigate } from 'react-router-dom';
import env from '../../config/env';

interface AnalysisResponse {
  analysis_id: string;
  channel_id: string;
  channel_name: string;
  period: {
    start: string;
    end: string;
  };
  stats: {
    message_count: number;
    participant_count: number;
    thread_count: number;
    reaction_count: number;
  };
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
  type: string;
  topic?: string;
  purpose?: string;
}

interface Workspace {
  id: string;
  name: string;
  slack_id: string;
  domain?: string;
}

/**
 * Page component for analyzing a Slack channel and displaying results.
 */
const ChannelAnalysisPage: React.FC = () => {
  const { workspaceId, channelId } = useParams<{ workspaceId: string; channelId: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInfoLoading, setIsInfoLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeThreads, setIncludeThreads] = useState(true);
  const [includeReactions, setIncludeReactions] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format date for input fields
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
  }, []);

  // Fetch workspace and channel info
  useEffect(() => {
    if (workspaceId && channelId) {
      fetchWorkspaceAndChannelInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, channelId]);

  /**
   * Fetch workspace and channel information.
   */
  const fetchWorkspaceAndChannelInfo = async () => {
    try {
      setIsInfoLoading(true);
      
      // Fetch workspace info
      const workspaceResponse = await fetch(`${env.apiUrl}/slack/workspaces`);
      
      if (workspaceResponse.ok) {
        const workspacesData = await workspaceResponse.json();
        const matchedWorkspace = workspacesData.workspaces.find(
          (w: Workspace) => w.id === workspaceId
        );
        if (matchedWorkspace) {
          setWorkspace(matchedWorkspace);
        }
      }
      
      // Fetch channel info
      const channelResponse = await fetch(
        `${env.apiUrl}/slack/workspaces/${workspaceId}/channels`
      );
      
      if (channelResponse.ok) {
        const channelsData = await channelResponse.json();
        const matchedChannel = channelsData.channels.find(
          (c: Channel) => c.id === channelId
        );
        if (matchedChannel) {
          setChannel(matchedChannel);
        }
      }
    } catch (error) {
      console.error('Error fetching info:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workspace or channel information',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsInfoLoading(false);
    }
  };

  /**
   * Run channel analysis with current settings.
   */
  const runAnalysis = async () => {
    if (!workspaceId || !channelId) {
      toast({
        title: 'Error',
        description: 'Missing workspace or channel ID',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsLoading(true);
      setAnalysis(null);
      
      // Format date parameters
      const startDateParam = startDate ? new Date(startDate).toISOString() : '';
      const endDateParam = endDate ? new Date(endDate).toISOString() : '';
      
      // Build the URL with all parameters
      const url = new URL(`${env.apiUrl}/slack/workspaces/${workspaceId}/channels/${channelId}/analyze`);
      
      if (startDateParam) {
        url.searchParams.append('start_date', startDateParam);
      }
      
      if (endDateParam) {
        url.searchParams.append('end_date', endDateParam);
      }
      
      url.searchParams.append('include_threads', includeThreads.toString());
      url.searchParams.append('include_reactions', includeReactions.toString());
      
      // Make the API request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const analysisData = await response.json();
      setAnalysis(analysisData);
      
      toast({
        title: 'Analysis Complete',
        description: 'Channel analysis has been completed successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error during analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze channel',
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format text with paragraphs.
   */
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <Text key={index} mb={2}>
        {paragraph}
      </Text>
    ));
  };

  /**
   * Render analysis parameters form.
   */
  const renderAnalysisForm = () => {
    return (
      <Card mb={6}>
        <CardHeader>
          <Heading size="md">Analysis Parameters</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Start Date</FormLabel>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>End Date</FormLabel>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FormControl>
            </HStack>
            
            <HStack spacing={6}>
              <FormControl display="flex" alignItems="center">
                <Switch
                  id="include-threads"
                  isChecked={includeThreads}
                  onChange={(e) => setIncludeThreads(e.target.checked)}
                  colorScheme="purple"
                  mr={2}
                />
                <FormLabel htmlFor="include-threads" mb={0}>
                  Include Thread Replies
                </FormLabel>
              </FormControl>
              
              <FormControl display="flex" alignItems="center">
                <Switch
                  id="include-reactions"
                  isChecked={includeReactions}
                  onChange={(e) => setIncludeReactions(e.target.checked)}
                  colorScheme="purple"
                  mr={2}
                />
                <FormLabel htmlFor="include-reactions" mb={0}>
                  Include Reactions
                </FormLabel>
              </FormControl>
            </HStack>
            
            <FormControl>
              <FormHelperText>
                Select a date range and options for analysis. A larger date range will take longer to analyze.
              </FormHelperText>
            </FormControl>
            
            <Divider />
            
            <Button
              leftIcon={<Icon as={FiRefreshCw} />}
              colorScheme="purple"
              onClick={runAnalysis}
              isLoading={isLoading}
              loadingText="Analyzing..."
            >
              Run Analysis
            </Button>
          </VStack>
        </CardBody>
      </Card>
    );
  };

  /**
   * Render analysis results.
   */
  const renderAnalysisResults = () => {
    if (!analysis) return null;
    
    return (
      <Box mt={8}>
        <Heading as="h2" size="lg" mb={4}>
          Analysis Results
        </Heading>
        
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
          <Stat>
            <StatLabel>Messages</StatLabel>
            <StatNumber>{analysis.stats.message_count}</StatNumber>
            <StatHelpText>Total messages analyzed</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Participants</StatLabel>
            <StatNumber>{analysis.stats.participant_count}</StatNumber>
            <StatHelpText>Unique contributors</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Threads</StatLabel>
            <StatNumber>{analysis.stats.thread_count}</StatNumber>
            <StatHelpText>Conversation threads</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Reactions</StatLabel>
            <StatNumber>{analysis.stats.reaction_count}</StatNumber>
            <StatHelpText>Total emoji reactions</StatHelpText>
          </Stat>
        </SimpleGrid>
        
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Card>
            <CardHeader>
              <Heading size="md">Channel Summary</Heading>
            </CardHeader>
            <CardBody>
              {formatText(analysis.channel_summary)}
            </CardBody>
          </Card>
          
          <Card>
            <CardHeader>
              <Heading size="md">Topic Analysis</Heading>
            </CardHeader>
            <CardBody>
              {formatText(analysis.topic_analysis)}
            </CardBody>
          </Card>
          
          <Card>
            <CardHeader>
              <Heading size="md">Contributor Insights</Heading>
            </CardHeader>
            <CardBody>
              {formatText(analysis.contributor_insights)}
            </CardBody>
          </Card>
          
          <Card>
            <CardHeader>
              <Heading size="md">Key Highlights</Heading>
            </CardHeader>
            <CardBody>
              {formatText(analysis.key_highlights)}
            </CardBody>
          </Card>
        </SimpleGrid>
        
        <Box mt={4} p={3} borderRadius="md" bg="gray.50">
          <HStack spacing={2}>
            <Text fontWeight="bold" fontSize="sm">
              Analysis period:
            </Text>
            <Text fontSize="sm">
              {formatDate(analysis.period.start)} to {formatDate(analysis.period.end)}
            </Text>
          </HStack>
          
          <HStack spacing={2}>
            <Text fontWeight="bold" fontSize="sm">
              Model:
            </Text>
            <Text fontSize="sm">{analysis.model_used}</Text>
          </HStack>
          
          <HStack spacing={2}>
            <Text fontWeight="bold" fontSize="sm">
              Generated:
            </Text>
            <Text fontSize="sm">
              {new Date(analysis.generated_at).toLocaleString()}
            </Text>
          </HStack>
        </Box>
      </Box>
    );
  };

  return (
    <Box p={4}>
      {/* Breadcrumb navigation */}
      <Breadcrumb
        spacing="8px"
        separator={<Icon as={FiChevronRight} color="gray.500" />}
        mb={6}
      >
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
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
          <BreadcrumbLink>Channel Analysis</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Back button */}
      <Button
        leftIcon={<Icon as={FiArrowLeft} />}
        mb={6}
        onClick={() => navigate('/dashboard/analytics/slack')}
        variant="outline"
        colorScheme="purple"
      >
        Back to Slack Analytics
      </Button>

      {isInfoLoading ? (
        <Flex height="200px" justify="center" align="center">
          <Spinner size="xl" color="purple.500" thickness="4px" />
        </Flex>
      ) : (
        <>
          <Box mb={6}>
            <Heading as="h1" size="xl">
              Channel Analysis
            </Heading>
            <HStack mt={2} spacing={2}>
              <Text fontWeight="bold">{workspace?.name}</Text>
              <Text>&gt;</Text>
              <Text>#{channel?.name}</Text>
              <Badge colorScheme={channel?.type === 'public' ? 'green' : 'orange'}>
                {channel?.type}
              </Badge>
            </HStack>
            {channel?.topic && (
              <Text color="gray.600" mt={1}>
                Topic: {channel.topic}
              </Text>
            )}
          </Box>

          {/* Analysis form */}
          {renderAnalysisForm()}

          {/* Loading state */}
          {isLoading && (
            <Flex justify="center" align="center" my={10} direction="column">
              <Spinner size="xl" color="purple.500" thickness="4px" mb={4} />
              <Text>Analyzing channel messages... This may take a minute.</Text>
            </Flex>
          )}

          {/* Analysis results */}
          {analysis && renderAnalysisResults()}
        </>
      )}
    </Box>
  );
};

export default ChannelAnalysisPage;
