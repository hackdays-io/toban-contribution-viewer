import React, { useContext, useEffect, useState } from 'react'
import { Box, Button, Text, VStack, Code, Spinner, Alert, AlertIcon } from '@chakra-ui/react'
import IntegrationContext from '../../context/IntegrationContext'
import { WorkspaceIdResponse } from '../../lib/integrationService'

/**
 * Example component demonstrating how to retrieve workspace ID from a resource analysis ID
 * 
 * This component shows:
 * 1. How to access the IntegrationContext
 * 2. How to call the getWorkspaceIdForAnalysis method
 * 3. How to handle loading and error states
 * 4. How to display the retrieved workspace information
 */
interface WorkspaceIdFromAnalysisExampleProps {
  analysisId: string
}

const WorkspaceIdFromAnalysisExample: React.FC<WorkspaceIdFromAnalysisExampleProps> = ({
  analysisId
}) => {
  const integrationContext = useContext(IntegrationContext)
  
  const [workspaceData, setWorkspaceData] = useState<WorkspaceIdResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkspaceId = async () => {
    if (!analysisId) {
      setError('Analysis ID is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`Fetching workspace ID for analysis: ${analysisId}`)
      
      const result = await integrationContext.getWorkspaceIdForAnalysis(analysisId)
      
      if (result) {
        console.log('Workspace data retrieved:', result)
        setWorkspaceData(result)
      } else {
        setError('Failed to retrieve workspace data')
      }
    } catch (err) {
      console.error('Error fetching workspace ID:', err)
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (analysisId) {
      fetchWorkspaceId()
    }
  }, [analysisId])

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg" width="100%" maxWidth="600px">
      <VStack spacing={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold">Workspace ID from Analysis Example</Text>
        
        <Box>
          <Text fontWeight="medium">Analysis ID:</Text>
          <Code p={2} borderRadius="md" width="100%">
            {analysisId || 'No analysis ID provided'}
          </Code>
        </Box>

        {/* Manual fetch button */}
        <Button 
          colorScheme="blue" 
          onClick={fetchWorkspaceId} 
          isLoading={isLoading}
          isDisabled={!analysisId}
        >
          Fetch Workspace ID
        </Button>

        {/* Loading state */}
        {isLoading && (
          <Box textAlign="center" py={2}>
            <Spinner size="md" />
            <Text mt={2}>Loading workspace data...</Text>
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {/* Results display */}
        {workspaceData && (
          <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
            <Text fontWeight="bold" mb={2}>Workspace Information:</Text>
            <VStack align="stretch" spacing={2}>
              <Box>
                <Text fontWeight="medium">Workspace ID:</Text>
                <Code p={1}>{workspaceData.workspace_id}</Code>
              </Box>
              <Box>
                <Text fontWeight="medium">Slack Workspace ID:</Text>
                <Code p={1}>{workspaceData.slack_workspace_id}</Code>
              </Box>
              <Box>
                <Text fontWeight="medium">Workspace Name:</Text>
                <Code p={1}>{workspaceData.workspace_name || 'N/A'}</Code>
              </Box>
              <Box>
                <Text fontWeight="medium">Integration ID:</Text>
                <Code p={1}>{workspaceData.integration_id}</Code>
              </Box>
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  )
}

export default WorkspaceIdFromAnalysisExample
