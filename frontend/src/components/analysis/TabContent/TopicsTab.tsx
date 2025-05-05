import React from 'react'
import { Card, CardBody } from '@chakra-ui/react'
import { renderPlainText } from '../../../utils/textRenderer'
import { TabContentProps } from './types'
import { ChannelAnalysisList } from '../../common'

/**
 * Tab content for topics analysis
 */
const TopicsTab: React.FC<TabContentProps> = ({
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
          {processedAnalysis?.fixedTopicAnalysis
            ? renderPlainText(
                processedAnalysis.fixedTopicAnalysis,
                String(channel?.metadata?.workspace_uuid || '')
              )
            : renderPlainText(
                analysis?.topic_analysis || 'No topic analysis available',
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
          integrationId=""
          contentField="topic_analysis"
          emptyMessage="No topic analyses available for individual channels."
        />
      )}
    </>
  )
}

export default TopicsTab
