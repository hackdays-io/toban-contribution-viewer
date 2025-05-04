/**
 * useAnalysisData Hook
 *
 * Custom hook for handling data fetching logic for TeamAnalysisResultPage
 * Extracts URL pattern detection, integration and resource fetching,
 * team analysis handling, channel analysis handling, and error handling
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useToast } from '@chakra-ui/react'
import useIntegration from '../context/useIntegration'
import integrationService from '../lib/integrationService'
import useReportStatus from './useReportStatus'

interface AnalysisResponse {
  id: string
  channel_id: string
  channel_name: string
  start_date: string
  end_date: string
  message_count: number
  participant_count: number
  thread_count: number
  reaction_count: number
  channel_summary: string
  topic_analysis: string
  contributor_insights: string
  key_highlights: string
  model_used: string
  generated_at: string
  team_id?: string
  report_id?: string
  is_unified_report?: boolean

  fixedChannelSummary?: string
  fixedTopicAnalysis?: string
  fixedContributorInsights?: string
  fixedKeyHighlights?: string
}

interface Channel {
  id: string
  integration_id: string
  resource_type: string
  external_id: string
  name: string
  metadata?: Record<string, unknown>
  last_synced_at?: string
  created_at: string
  updated_at: string
  is_selected_for_analysis?: boolean
  type: string
  topic?: string
  purpose?: string
}

/**
 * Custom hook for handling analysis data fetching
 */
const useAnalysisData = () => {
  const { integrationId, channelId, analysisId, teamId, reportId } = useParams<{
    integrationId: string
    channelId: string
    analysisId: string
    teamId: string
    reportId: string
  }>()

  const toast = useToast()

  const {
    currentResources,
    currentIntegration,
    fetchIntegration,
    fetchResources,
  } = useIntegration()

  const [channel, setChannel] = useState<Channel | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isTeamAnalysis =
    window.location.pathname.includes('/team-analysis/') ||
    window.location.pathname.includes('/teams/') ||
    (analysisId && !channelId) // If we have an analysisId but no channelId, it's likely a team analysis

  const isTeamCentricUrl = Boolean(teamId && reportId)

  let shareUrl = ''
  if (isTeamCentricUrl) {
    shareUrl = `${window.location.origin}/dashboard/teams/${teamId}/reports/${reportId}`
  } else if (isTeamAnalysis) {
    shareUrl = `${window.location.origin}/dashboard/integrations/${integrationId}/team-analysis/${analysisId}`
  } else {
    shareUrl = `${window.location.origin}/dashboard/integrations/${integrationId}/channels/${channelId}/analysis/${analysisId}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const initialFetchData = useCallback(async () => {
    console.log('Initial fetch data called')
  }, [])

  const {
    reportResult,
    pendingAnalyses,
    isRefreshing,
    setReportResult,
    setIsRefreshing,
    checkReportStatus,
  } = useReportStatus({
    teamId,
    reportId,
    analysisId,
    integrationId,
    isTeamAnalysis: Boolean(isTeamAnalysis),
    isTeamCentricUrl,
    currentIntegrationTeamId: currentIntegration?.owner_team?.id,
    fetchData: initialFetchData,
    analysis: analysis as Record<string, unknown> | null,
    setAnalysis: setAnalysis as (analysis: Record<string, unknown> | null) => void,
  })

  /**
   * Handle team analysis (cross-resource report)
   */
  const handleTeamAnalysis = useCallback(async () => {
    let effectiveTeamId
    let directIntegration = null
    let effectiveReportId

    if (isTeamCentricUrl && teamId) {
      effectiveTeamId = teamId
      effectiveReportId = reportId
    } else {
      if (currentIntegration) {
        effectiveTeamId = currentIntegration.owner_team.id
      } else {
        const integrationResult = await integrationService.getIntegration(
          integrationId ?? ''
        )

        if (!integrationService.isApiError(integrationResult)) {
          directIntegration = integrationResult
          effectiveTeamId = directIntegration.owner_team.id
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load integration data for analysis.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
          return
        }
      }

      effectiveReportId = analysisId
    }

    const crossResourceReport = await integrationService.getCrossResourceReport(
      effectiveTeamId,
      effectiveReportId ?? '',
      true // includeAnalyses=true to get all the resource analyses
    )

    if (integrationService.isApiError(crossResourceReport)) {
      console.error(
        'Error fetching cross-resource report:',
        crossResourceReport
      )
      toast({
        title: 'Error',
        description: `Failed to load team analysis: ${crossResourceReport.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    setReportResult(crossResourceReport)

    if (
      crossResourceReport.resource_analyses &&
      Array.isArray(crossResourceReport.resource_analyses) &&
      crossResourceReport.resource_analyses.length > 0
    ) {
      const firstAnalysis = crossResourceReport.resource_analyses[0] as Record<
        string,
        unknown
      >

      const reportDescription =
        crossResourceReport.description ||
        `Team analysis of ${crossResourceReport.resource_analyses.length} channels from ${crossResourceReport.date_range_start} to ${crossResourceReport.date_range_end}`

      const adaptedAnalysis: AnalysisResponse = {
        id: String(crossResourceReport.id || ''),
        channel_id: String(firstAnalysis.resource_id || ''),
        channel_name: String(
          crossResourceReport.title || 'Cross-resource Report'
        ),
        start_date: String(
          crossResourceReport.date_range_start || new Date().toISOString()
        ),
        end_date: String(
          crossResourceReport.date_range_end || new Date().toISOString()
        ),
        message_count: Number(crossResourceReport.total_messages || 0),
        participant_count: Number(crossResourceReport.total_participants || 0),
        thread_count: Number(crossResourceReport.total_threads || 0),
        reaction_count: Number(crossResourceReport.total_reactions || 0),
        channel_summary: String(reportDescription || ''),
        topic_analysis:
          'Multiple resource analysis - see individual analyses for details',
        contributor_insights:
          'Multiple resource analysis - see individual analyses for details',
        key_highlights:
          'Multiple resource analysis - see individual analyses for details',
        model_used: String(firstAnalysis.model_used || 'N/A'),
        generated_at: String(
          crossResourceReport.created_at || new Date().toISOString()
        ),
      }

      console.log('Created adapted analysis for team report:', adaptedAnalysis)
      setAnalysis(adaptedAnalysis)
    } else {
      toast({
        title: 'No Analyses Found',
        description:
          'This team analysis report does not contain any resource analyses.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })

      const emptyAnalysis: AnalysisResponse = {
        id: String(crossResourceReport.id || analysisId || ''),
        channel_id: '',
        channel_name: String(
          crossResourceReport.title || 'Cross-resource Report'
        ),
        start_date: String(
          crossResourceReport.date_range_start || new Date().toISOString()
        ),
        end_date: String(
          crossResourceReport.date_range_end || new Date().toISOString()
        ),
        message_count: Number(crossResourceReport.total_messages || 0),
        participant_count: Number(crossResourceReport.total_participants || 0),
        thread_count: Number(crossResourceReport.total_threads || 0),
        reaction_count: Number(crossResourceReport.total_reactions || 0),
        channel_summary: 'No analyses found for this team report.',
        topic_analysis: '',
        contributor_insights: '',
        key_highlights: '',
        model_used: 'N/A',
        generated_at: String(
          crossResourceReport.created_at || new Date().toISOString()
        ),
      }

      setAnalysis(emptyAnalysis)
    }
  }, [
    analysisId,
    currentIntegration,
    integrationId,
    isTeamCentricUrl,
    reportId,
    teamId,
    toast,
    setReportResult,
  ])

  /**
   * Handle channel analysis flow
   */
  const handleChannelAnalysis = useCallback(async () => {
    if (integrationId && channelId) {
      await fetchResources(integrationId)
      const channelResource = currentResources.find(
        (resource) => resource.id === channelId
      )
      if (channelResource) {
        setChannel(channelResource as Channel)
      }
    }

    if (!analysisId || analysisId === 'undefined') {
      console.error('Invalid or undefined analysis ID:', analysisId)
      throw new Error('Invalid analysis ID')
    }

    if (!isTeamAnalysis && (!channelId || channelId === 'undefined')) {
      console.error(
        'Invalid or undefined channel ID for channel analysis:',
        channelId
      )
      throw new Error('Invalid channel ID for channel analysis')
    }

    const analysisResult = await integrationService.getResourceAnalysis(
      integrationId || '',
      channelId || '',
      analysisId
    )

    if (integrationService.isApiError(analysisResult)) {
      throw new Error(`Error fetching analysis: ${analysisResult.message}`)
    }

    setAnalysis(analysisResult as unknown as AnalysisResponse)
  }, [
    analysisId,
    channelId,
    currentResources,
    fetchResources,
    integrationId,
    isTeamAnalysis,
  ])

  /**
   * Fetch analysis data from API
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true)

    try {
      if (integrationId) {
        try {
          await fetchIntegration(integrationId)
        } catch (error) {
          console.log(
            'Integration context fetch failed, will try direct API call:',
            error
          )
        }
      }

      if (isTeamAnalysis) {
        await handleTeamAnalysis()
      } else {
        await handleChannelAnalysis()
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load analysis data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    integrationId,
    isTeamAnalysis,
    fetchIntegration,
    handleTeamAnalysis,
    handleChannelAnalysis,
    toast,
  ])


  useEffect(() => {
    if (isTeamCentricUrl) {
      if (teamId && reportId) {
        fetchData()
        setIsRefreshing(true)
      }
    } else if (isTeamAnalysis) {
      if (integrationId && analysisId) {
        fetchData()
        setIsRefreshing(true)
      }
    } else {
      if (integrationId && channelId && analysisId) {
        fetchData()
      }
    }
  }, [
    integrationId,
    channelId,
    analysisId,
    teamId,
    reportId,
    isTeamAnalysis,
    isTeamCentricUrl,
    fetchData,
    setIsRefreshing,
  ])

  return {
    analysis,
    channel,
    isLoading,
    reportResult,
    pendingAnalyses,
    isRefreshing,

    isTeamAnalysis,
    isTeamCentricUrl,
    shareUrl,

    formatDate,
    formatDateTime,

    fetchData,
    checkReportStatus,

    setIsRefreshing,
  }
}

export default useAnalysisData
