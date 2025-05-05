import { useState, FC } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { FiArrowLeft } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import ErrorBoundary from '../../components/common/ErrorBoundary'
import { useAnalysisData } from '../../hooks'
import { AnalysisStats } from '../../components/analysis'
import { ServiceResource } from '../../lib/integrationService'
import { renderPlainText, extractSectionContent, isObviouslyNotJson } from '../../utils/textRenderer'

interface ChannelAnalysisListProps {
  title: string
  reportResult: Record<string, unknown> | null
  currentResources: ServiceResource[]
  filterFn?: (analysis: Record<string, unknown>) => boolean
  contentField: string
  emptyMessage?: string
  workspaceUuid?: string
}

/**
 * A reusable component for displaying individual channel analyses in the team analysis view
 */
const ChannelAnalysisList: FC<ChannelAnalysisListProps> = ({
  title,
  reportResult,
  currentResources,
  filterFn = () => true,
  contentField,
  emptyMessage = 'No information available.',
}) => {

  const filteredAnalyses =
    reportResult?.resource_analyses &&
    Array.isArray(reportResult.resource_analyses)
      ? reportResult.resource_analyses.filter(filterFn)
      : []

  if (
    !reportResult ||
    !reportResult.resource_analyses ||
    !Array.isArray(reportResult.resource_analyses) ||
    reportResult.resource_analyses.length === 0
  ) {
    return null
  }

  return (
    <>
      <Heading size="md" mb={3} mt={6}>
        {title}
      </Heading>
      {filteredAnalyses.length > 0 ? (
        filteredAnalyses.map((channelAnalysis) => (
          <Card
            key={channelAnalysis.id}
            variant="outline"
            mb={4}
            boxShadow="sm"
          >
            <CardBody pb={1}>
              <Flex justify="space-between" align="center">
                <Heading size="sm" color="purple.600">
                  {/* Try to get channel name from different sources with fallbacks */}
                  {channelAnalysis.results?.channel_name ||
                    channelAnalysis.channel_name ||
                    channelAnalysis.resource_name ||
                    currentResources.find(
                      (r) => r.id === channelAnalysis.resource_id
                    )?.name ||
                    `Channel ${channelAnalysis.resource_id.substring(0, 8)}...`}
                </Heading>
                <Badge
                  colorScheme={
                    channelAnalysis.status === 'COMPLETED'
                      ? 'green'
                      : channelAnalysis.status === 'FAILED'
                      ? 'red'
                      : 'yellow'
                  }
                >
                  {channelAnalysis.status}
                </Badge>
              </Flex>
              <Box mt={3}>
                {channelAnalysis.results && channelAnalysis.results[contentField]
                  ? renderPlainText(
                      channelAnalysis.results[contentField] as string,
                      ''
                    )
                  : emptyMessage}
              </Box>
            </CardBody>
          </Card>
        ))
      ) : (
        <Box p={4} borderWidth="1px" borderRadius="md" mb={4}>
          <Text>{emptyMessage}</Text>
        </Box>
      )}
    </>
  )
}

/**
 * Page component for displaying team or channel analysis results
 */
const TeamAnalysisResultPage: FC = () => {
  const {
    analysis,
    channel,
    isLoading,
    reportResult,
    isTeamAnalysis,
  } = useAnalysisData()

  const [activeTab, setActiveTab] = useState(0)
  const navigate = useNavigate()

  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const customStyles = {
    statCard: {
      bg: cardBg,
      borderRadius: 'lg',
      boxShadow: 'sm',
      p: 4,
      borderWidth: '1px',
      borderColor: borderColor,
      textAlign: 'center',
    },
    tabPanel: {
      p: 0,
      pt: 4,
    },
    backButton: {
      mb: 4,
      leftIcon: <FiArrowLeft />,
    },
  }

  /**
   * Extract missing fields from analysis data if needed
   */
  const extractMissingFields = (analysis: Record<string, any>) => {
    const hasEmptyFields =
      !analysis.topic_analysis ||
      !analysis.contributor_insights ||
      !analysis.key_highlights

    if (!hasEmptyFields) return null

    const isLikelyPlainText =
      typeof analysis.channel_summary === 'string' &&
      isObviouslyNotJson(analysis.channel_summary)

    if (!isLikelyPlainText) return null

    const extracted: Record<string, string> = {}

    if (!analysis.topic_analysis) {
      extracted.fixedTopicAnalysis = extractSectionContent(
        analysis.channel_summary,
        'Topics'
      )
    }

    if (!analysis.contributor_insights) {
      extracted.fixedContributorInsights = extractSectionContent(
        analysis.channel_summary,
        'Contributors'
      )
    }

    if (!analysis.key_highlights) {
      extracted.fixedKeyHighlights = extractSectionContent(
        analysis.channel_summary,
        'Highlights'
      )
    }

    return Object.keys(extracted).length > 0 ? extracted : null
  }

  const processedAnalysis = analysis
    ? { ...analysis, ...extractMissingFields(analysis) }
    : null

  const safeCustomStyles = {
    backButton: customStyles.backButton || {
      mb: 4,
      leftIcon: <FiArrowLeft />,
    },
    tabPanel: customStyles.tabPanel || {
      p: 0,
      pt: 4,
    },
  }

  if (isLoading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Loading analysis...</Text>
      </Box>
    )
  }

  return (
    <ErrorBoundary>
      <Box>
        {/* Back button */}
        <ErrorBoundary
          fallback={
            <Button onClick={() => navigate(-1)} mb={4}>
              Back
            </Button>
          }
        >
          <Button onClick={() => navigate(-1)} sx={safeCustomStyles.backButton}>
            Back
          </Button>
        </ErrorBoundary>

        {/* Statistics section */}
        <AnalysisStats analysis={analysis} customStyles={customStyles} />

        {/* Main content tabs */}
        <Tabs
          colorScheme="purple"
          variant="enclosed"
          onChange={setActiveTab}
          defaultIndex={activeTab}
        >
          <TabList>
            <Tab>Summary</Tab>
            <Tab>Topics</Tab>
            <Tab>Contributors</Tab>
            <Tab>Highlights</Tab>
          </TabList>

          <TabPanels>
            {/* Summary Tab */}
            <TabPanel sx={safeCustomStyles.tabPanel}>
              <Card variant="outline">
                <CardBody>
                  {processedAnalysis?.fixedChannelSummary
                    ? renderPlainText(
                        processedAnalysis.fixedChannelSummary,
                        String(channel?.metadata?.workspace_uuid || '')
                      )
                    : renderPlainText(
                        analysis?.channel_summary || 'No summary available',
                        String(channel?.metadata?.workspace_uuid || '')
                      )}
                </CardBody>
              </Card>

              {/* For team analysis, show individual channel summaries */}
              {isTeamAnalysis && reportResult && (
                <ChannelAnalysisList
                  title="Channel Summaries"
                  reportResult={reportResult}
                  currentResources={[]}
                  contentField="resource_summary"
                  emptyMessage="No channel summaries available."
                />
              )}
            </TabPanel>

            {/* Topics Tab */}
            <TabPanel sx={safeCustomStyles.tabPanel}>
              <Card variant="outline">
                <CardBody>
                  {processedAnalysis?.fixedTopicAnalysis
                    ? renderPlainText(
                        processedAnalysis.fixedTopicAnalysis,
                        String(channel?.metadata?.workspace_uuid || '')
                      )
                    : renderPlainText(
                        analysis?.topic_analysis ||
                          'No topic analysis available',
                        String(channel?.metadata?.workspace_uuid || '')
                      )}
                </CardBody>
              </Card>

              {/* For team analysis, show individual channel topic analyses */}
              {isTeamAnalysis && reportResult && (
                <ChannelAnalysisList
                  title="Channel Topic Analyses"
                  reportResult={reportResult}
                  currentResources={[]}
                  contentField="topic_analysis"
                  emptyMessage="No topic analyses available for individual channels."
                />
              )}
            </TabPanel>

            {/* Contributors Tab */}
            <TabPanel sx={safeCustomStyles.tabPanel}>
              <Card variant="outline">
                <CardBody>
                  {processedAnalysis?.fixedContributorInsights
                    ? renderPlainText(
                        processedAnalysis.fixedContributorInsights,
                        String(channel?.metadata?.workspace_uuid || '')
                      )
                    : renderPlainText(
                        analysis?.contributor_insights ||
                          'No contributor insights available',
                        String(channel?.metadata?.workspace_uuid || '')
                      )}
                </CardBody>
              </Card>

              {/* For team analysis, show individual channel contributor insights */}
              {isTeamAnalysis && reportResult && (
                <ChannelAnalysisList
                  title="Channel Contributor Insights"
                  reportResult={reportResult}
                  currentResources={[]}
                  contentField="contributor_insights"
                  emptyMessage="No contributor insights available for individual channels."
                />
              )}
            </TabPanel>

            {/* Highlights Tab */}
            <TabPanel sx={safeCustomStyles.tabPanel}>
              <Card variant="outline">
                <CardBody>
                  {processedAnalysis?.fixedKeyHighlights
                    ? renderPlainText(
                        processedAnalysis.fixedKeyHighlights,
                        String(channel?.metadata?.workspace_uuid || '')
                      )
                    : renderPlainText(
                        analysis?.key_highlights || 'No highlights available',
                        String(channel?.metadata?.workspace_uuid || '')
                      )}
                </CardBody>
              </Card>

              {/* For team analysis, show individual channel highlights */}
              {isTeamAnalysis && reportResult && (
                <ChannelAnalysisList
                  title="Channel Highlights"
                  reportResult={reportResult}
                  currentResources={[]}
                  contentField="key_highlights"
                  emptyMessage="No highlights available for individual channels."
                />
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </ErrorBoundary>
  )
}

export default TeamAnalysisResultPage
