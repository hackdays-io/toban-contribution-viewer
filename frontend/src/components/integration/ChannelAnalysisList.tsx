import React, { FC } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { Link, useNavigate } from 'react-router-dom'
import { renderPlainText } from '../../utils/textRenderer'
import { ServiceResource } from '../../lib/integrationService'

interface ChannelAnalysisListProps {
  title: string
  reportResult: Record<string, unknown> | null
  currentResources: ServiceResource[]
  integrationId: string
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
  integrationId,
  filterFn = () => true,
  contentField,
  emptyMessage = 'No information available.',
}) => {
  const navigate = useNavigate()

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
            <CardHeader pb={1}>
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
                  {channelAnalysis.status === 'PENDING' ? (
                    <HStack spacing={1}>
                      <Text>PENDING</Text>
                      <Spinner size="xs" />
                    </HStack>
                  ) : (
                    channelAnalysis.status
                  )}
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody pt={2}>
              {channelAnalysis[contentField] ? (
                <Box className="analysis-content">
                  {/* Extract channel-specific integration_id if available */}
                  {renderPlainText(
                    typeof channelAnalysis[contentField] === 'string'
                      ? channelAnalysis[contentField].replace(
                          /(\d+\.\s)/g,
                          '\n$1'
                        )
                      : 'No content available',
                    channelAnalysis.workspace_uuid
                  )}
                </Box>
              ) : (
                <Text fontSize="sm" color="gray.500">
                  {emptyMessage}
                </Text>
              )}
              {channelAnalysis.status === 'COMPLETED' && (
                <Button
                  size="sm"
                  colorScheme="purple"
                  variant="outline"
                  mt={3}
                  onClick={() => {
                    const resourceId = String(channelAnalysis.resource_id)
                    const analysisId = String(channelAnalysis.id)
                    console.log('Channel analysis debug:', {
                      resourceId,
                      analysisId,
                    })

                    navigate(
                      `/dashboard/integrations/${integrationId}/channels/${resourceId}/analysis/${analysisId}`
                    )
                  }}
                >
                  View Full Analysis
                </Button>
              )}
            </CardBody>
          </Card>
        ))
      ) : (
        <Text fontSize="sm" color="gray.500" mt={4}>
          No completed channel analyses with {contentField.replace(/_/g, ' ')}{' '}
          information available.
        </Text>
      )}
    </>
  )
}

export default ChannelAnalysisList
