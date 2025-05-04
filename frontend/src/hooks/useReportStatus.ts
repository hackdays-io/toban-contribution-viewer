import React, { useState, useEffect, useCallback } from 'react'
import integrationService from '../lib/integrationService'

interface UseReportStatusParams {
  teamId?: string
  reportId?: string
  analysisId?: string
  integrationId?: string
  isTeamAnalysis: boolean
  isTeamCentricUrl: boolean
  currentIntegrationTeamId?: string
  fetchData: () => Promise<void>
  setAnalysis?: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>> // Preserve existing analysis update if needed
}

interface UseReportStatusResult {
  pendingAnalyses: number
  isRefreshing: boolean
  reportResult: Record<string, unknown> | null
  setReportResult: (result: Record<string, unknown> | null) => void
  checkReportStatus: () => Promise<void>
}

/**
 * Custom hook for handling report status checking logic
 * Extracts status checking logic from TeamAnalysisResultPage
 */
const useReportStatus = ({
  teamId,
  reportId,
  analysisId,
  integrationId,
  isTeamAnalysis,
  isTeamCentricUrl,
  currentIntegrationTeamId,
  fetchData,
  setAnalysis,
}: UseReportStatusParams): UseReportStatusResult => {
  const [reportResult, setReportResult] = useState<Record<string, unknown> | null>(null)
  const [pendingAnalyses, setPendingAnalyses] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

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
        effectiveTeamId = currentIntegrationTeamId

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

        if (completedCount > 0 && setAnalysis) {
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
    currentIntegrationTeamId,
    integrationId,
    isRefreshing,
    isTeamAnalysis,
    isTeamCentricUrl,
    teamId,
    reportId,
    fetchData,
    setAnalysis,
  ])

  useEffect(() => {
    const timeoutId: NodeJS.Timeout | null = null

    if (isRefreshing) {
      checkReportStatus()
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isRefreshing, checkReportStatus])

  return {
    pendingAnalyses,
    isRefreshing,
    reportResult,
    setReportResult,
    checkReportStatus,
  }
}

export default useReportStatus
