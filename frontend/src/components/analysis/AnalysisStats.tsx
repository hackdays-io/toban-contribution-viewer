import React from 'react'
import {
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react'

interface AnalysisStatsProps {
  analysis: {
    message_count?: number
    participant_count?: number
    thread_count?: number
    reaction_count?: number
  }
  isTeamAnalysis?: boolean | string
  customStyles?: {
    statCard?: Record<string, unknown>
    [key: string]: unknown
  }
}

/**
 * Component for displaying analysis statistics
 * Renders statistics section with messages, participants, threads, and reactions
 */
const AnalysisStats: React.FC<AnalysisStatsProps> = ({
  analysis,
  isTeamAnalysis,
  customStyles,
}) => {
  if (!analysis) return null

  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
      <Stat
        sx={
          customStyles?.statCard || {
            p: 4,
            borderRadius: 'md',
            boxShadow: 'sm',
          }
        }
      >
        <StatLabel>Messages</StatLabel>
        <StatNumber>
          {typeof analysis?.message_count === 'number'
            ? analysis.message_count.toLocaleString()
            : '0'}
        </StatNumber>
        <StatHelpText>Total messages analyzed</StatHelpText>
      </Stat>

      <Stat
        sx={
          customStyles?.statCard || {
            p: 4,
            borderRadius: 'md',
            boxShadow: 'sm',
          }
        }
      >
        <StatLabel>Participants</StatLabel>
        <StatNumber>
          {typeof analysis?.participant_count === 'number'
            ? analysis.participant_count.toLocaleString()
            : '0'}
        </StatNumber>
        <StatHelpText>
          {isTeamAnalysis ? 'Team members' : 'Unique contributors'}
        </StatHelpText>
      </Stat>

      <Stat
        sx={
          customStyles?.statCard || {
            p: 4,
            borderRadius: 'md',
            boxShadow: 'sm',
          }
        }
      >
        <StatLabel>Threads</StatLabel>
        <StatNumber>
          {typeof analysis?.thread_count === 'number'
            ? analysis.thread_count.toLocaleString()
            : '0'}
        </StatNumber>
        <StatHelpText>Conversation threads</StatHelpText>
      </Stat>

      <Stat
        sx={
          customStyles?.statCard || {
            p: 4,
            borderRadius: 'md',
            boxShadow: 'sm',
          }
        }
      >
        <StatLabel>Reactions</StatLabel>
        <StatNumber>
          {typeof analysis?.reaction_count === 'number'
            ? analysis.reaction_count.toLocaleString()
            : '0'}
        </StatNumber>
        <StatHelpText>Total emoji reactions</StatHelpText>
      </Stat>
    </SimpleGrid>
  )
}

export default AnalysisStats
