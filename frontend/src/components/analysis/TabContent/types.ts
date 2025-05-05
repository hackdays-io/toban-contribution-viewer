import { FC } from 'react'

export interface AnalysisResponse {
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

export interface Channel {
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

export interface TabContentProps {
  analysis: AnalysisResponse | null
  channel: Channel | null
  processedAnalysis: Record<string, unknown> | null
  reportResult: Record<string, unknown> | null
  isTeamAnalysis: boolean | string | undefined
  customStyles: Record<string, unknown>
  workspaceUuid?: string
}

export type TabContentComponent = FC<TabContentProps>
