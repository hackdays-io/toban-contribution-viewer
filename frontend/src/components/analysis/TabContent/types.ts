import { FC } from 'react'

export interface TabContentProps {
  analysis: any
  channel: any
  processedAnalysis: any
  reportResult: Record<string, unknown> | null
  isTeamAnalysis: any
  customStyles: any
  workspaceUuid?: string
}

export type TabContentComponent = FC<TabContentProps>
