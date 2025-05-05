import React from 'react'
import { Card, CardBody } from '@chakra-ui/react'
import { renderPlainText } from '../../../utils/textRenderer'
import { TabContentProps } from './types'
import { ChannelAnalysisList } from '../../common'

/**
 * Tab content for summary information
 */
const SummaryTab: React.FC<TabContentProps> = ({
  analysis,
  processedAnalysis,
  reportResult,
  isTeamAnalysis,
  workspaceUuid,
}) => {
  return (
    <>
      <Card variant="outline">
        <CardBody>
          {processedAnalysis?.fixedChannelSummary
            ? renderPlainText(
                processedAnalysis.fixedChannelSummary,
                String(workspaceUuid || '')
              )
            : renderPlainText(
                analysis?.channel_summary || 'No summary available',
                String(workspaceUuid || '')
              )}
        </CardBody>
      </Card>

      {/* For team analysis, show individual channel summaries */}
      {isTeamAnalysis && reportResult && (
        <ChannelAnalysisList
          title="Channel Summaries"
          reportResult={reportResult}
          currentResources={[]}
          integrationId=""
          contentField="resource_summary"
          emptyMessage="No channel summaries available."
        />
      )}
    </>
  )
}

export default SummaryTab
