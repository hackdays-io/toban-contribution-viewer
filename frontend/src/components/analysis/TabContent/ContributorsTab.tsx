import React from 'react'
import { Card, CardBody } from '@chakra-ui/react'
import { renderPlainText } from '../../../utils/textRenderer'
import { TabContentProps } from './types'
import { ChannelAnalysisList } from '../../common'

/**
 * Tab content for contributors analysis
 */
const ContributorsTab: React.FC<TabContentProps> = ({
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
          {processedAnalysis?.fixedContributorInsights
            ? renderPlainText(
                processedAnalysis.fixedContributorInsights,
                String(channel?.metadata?.workspace_uuid || '')
              )
            : renderPlainText(
                analysis?.contributor_insights || 'No contributor insights available',
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
          integrationId=""
          contentField="contributor_insights"
          emptyMessage="No contributor insights available for individual channels."
        />
      )}
    </>
  )
}

export default ContributorsTab
