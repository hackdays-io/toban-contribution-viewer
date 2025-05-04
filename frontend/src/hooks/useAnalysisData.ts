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
  const [reportResult, setReportResult] = useState<Record<string, unknown> | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingAnalyses, setPendingAnalyses] = useState<number>(0)

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
  }, [analysisId, currentIntegration, integrationId, isTeamCentricUrl, reportId, teamId, toast])

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

  /**
   * Checks the status of a cross-resource report and counts pending analyses
   */
  const checkReportStatus = useCallback(async () => {
    if (isTeamCentricUrl && (!teamId || !reportId)) return

    if (!isTeamCentricUrl && (!analysisId || !isTeamAnalysis)) return

    try {
      let effectiveTeamId = teamId
      const effectiveReportId = reportId || analysisId

      if (!effectiveTeamId) {
        effectiveTeamId = currentIntegration?.owner_team?.id

        if (!effectiveTeamId) {
          const integrationResult = await integrationService.getIntegration(
            integrationId ?? ''
          )

          if (!integrationService.isApiError(integrationResult)) {
            effectiveTeamId = integrationResult.owner_team.id
          } else {
            console.error(
              'Could not get team ID for status check',
              integrationResult
            )
            return
          }
        }
      }

      const reportStatus = await integrationService.getCrossResourceReport(
        effectiveTeamId,
        effectiveReportId || '',
        true // includeAnalyses=true to check individual resource analyses
      )

      if (integrationService.isApiError(reportStatus)) {
        console.error('Error checking report status:', reportStatus)
        return
      }

      if (
        reportStatus.resource_analyses &&
        Array.isArray(reportStatus.resource_analyses) &&
        reportStatus.resource_analyses.length > 0
      ) {
        const firstAnalysis = reportStatus.resource_analyses[0]
        console.log('FIRST ANALYSIS FIELD KEYS:', Object.keys(firstAnalysis))

        if (firstAnalysis.results) {
          console.log('RESULTS FIELD KEYS:', Object.keys(firstAnalysis.results))
        }
      }

      setReportResult(reportStatus)

      let pendingCount = 0
      let completedCount = 0

      if (
        reportStatus.resource_analyses &&
        Array.isArray(reportStatus.resource_analyses)
      ) {
        pendingCount = reportStatus.resource_analyses.filter(
          (analysis: Record<string, unknown>) => analysis.status === 'PENDING'
        ).length

        reportStatus.resource_analyses.forEach(
          (analysis: Record<string, unknown>, index: number) => {
            if (index === 0) {
              console.log('ANALYSIS DETAILS:', {
                id: analysis.id,
                resourceId: analysis.resource_id,
                resourceName: analysis.resource_name,
                status: analysis.status,
                hasParticipantCount: Boolean(analysis.participant_count),
                participantCount: analysis.participant_count,
                hasParticipants: Boolean(analysis.participants),
                participantsIsArray:
                  analysis.participants && Array.isArray(analysis.participants),
                participantsLength:
                  analysis.participants && Array.isArray(analysis.participants)
                    ? analysis.participants.length
                    : 0,
                keys: Object.keys(analysis),
              })
            }

            if (analysis.status === 'COMPLETED') {
              completedCount++
            }
          }
        )

        if (completedCount > 0 && analysis) {
          const updatedAnalysis = { ...analysis }

          const completedAnalyses = reportStatus.resource_analyses.filter(
            (a: Record<string, unknown>) => a.status === 'COMPLETED'
          )

          if (Array.isArray(completedAnalyses)) {
            completedAnalyses.forEach((a, index) => {
              if (index === 0) {
                console.log(
                  'RESOURCE ANALYSIS DEBUG - First analysis structure:',
                  {
                    hasResults: Boolean(a.results),
                    resultsKeys:
                      a.results && typeof a.results === 'object'
                        ? Object.keys(a.results as Record<string, unknown>)
                        : [],
                    hasMetadata:
                      a.results &&
                      typeof a.results === 'object' &&
                      (a.results as Record<string, unknown>).metadata
                        ? true
                        : false,
                    metadataKeys:
                      a.results &&
                      typeof a.results === 'object' &&
                      (a.results as Record<string, unknown>).metadata &&
                      typeof (a.results as Record<string, unknown>).metadata ===
                        'object'
                        ? Object.keys(
                            (a.results as Record<string, unknown>)
                              .metadata as Record<string, unknown>
                          )
                        : [],
                    hasMessageCount: Boolean(a.message_count),
                    hasParticipantCount: Boolean(a.participant_count),
                    resourceName: a.resource_name,
                  }
                )
              }
            })
          } else {
            console.warn(
              'completedAnalyses is not an array:',
              typeof completedAnalyses
            )
          }
          setAnalysis(updatedAnalysis)
        }
      }

      setPendingAnalyses(pendingCount)

      if (pendingCount > 0) {
        setTimeout(() => {
          checkReportStatus()
        }, 5000) // Check every 5 seconds
      } else {
        setIsRefreshing(false)

        if (isRefreshing) {
          fetchData()
        }
      }
    } catch (error) {
      console.error('Error checking report status:', error)
    }
  }, [
    analysisId,
    currentIntegration?.owner_team?.id,
    integrationId,
    isRefreshing,
    isTeamAnalysis,
    isTeamCentricUrl,
    teamId,
    reportId,
    fetchData,
    analysis,
  ])

  useEffect(() => {
    if (isTeamCentricUrl) {
      if (teamId && reportId) {
        fetchData()
        setIsRefreshing(true)
        checkReportStatus()
      }
    } else if (isTeamAnalysis) {
      if (integrationId && analysisId) {
        fetchData()
        setIsRefreshing(true)
        checkReportStatus()
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
