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
  channel,
  processedAnalysis,
  reportResult,
  isTeamAnalysis,
}) => {
  return (
    <>
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
          integrationId=""
          contentField="resource_summary"
          emptyMessage="No channel summaries available."
        />
      )}
    </>
  )
}

export default SummaryTab
