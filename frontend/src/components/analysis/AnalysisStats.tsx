import React from 'react'
import {
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useColorModeValue,
} from '@chakra-ui/react'
import ErrorBoundary from '../../components/common/ErrorBoundary'

interface AnalysisStatsProps {
  analysis: {
    message_count?: number;
    participant_count?: number;
    thread_count?: number;
    reaction_count?: number;
  } | null;
  customStyles?: {
    statCard?: Record<string, any>;
  };
}

/**
 * Component for displaying analysis statistics
 */
const AnalysisStats: React.FC<AnalysisStatsProps> = ({ analysis, customStyles }) => {
  const cardBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const defaultStatCardStyle = {
    p: 4,
    borderRadius: 'md',
    boxShadow: 'sm',
    bg: cardBg,
    borderWidth: '1px',
    borderColor: borderColor,
    textAlign: 'center' as const,
  }

  const statCardStyle = customStyles?.statCard || defaultStatCardStyle

  return (
    <ErrorBoundary>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Stat sx={statCardStyle}>
          <StatLabel>Messages</StatLabel>
          <StatNumber>
            {typeof analysis?.message_count === 'number'
              ? analysis.message_count.toLocaleString()
              : '0'}
          </StatNumber>
          <StatHelpText>Total messages analyzed</StatHelpText>
        </Stat>

        <Stat sx={statCardStyle}>
          <StatLabel>Participants</StatLabel>
          <StatNumber>
            {typeof analysis?.participant_count === 'number'
              ? analysis.participant_count.toLocaleString()
              : '0'}
          </StatNumber>
          <StatHelpText>Unique contributors</StatHelpText>
        </Stat>

        <Stat sx={statCardStyle}>
          <StatLabel>Threads</StatLabel>
          <StatNumber>
            {typeof analysis?.thread_count === 'number'
              ? analysis.thread_count.toLocaleString()
              : '0'}
          </StatNumber>
          <StatHelpText>Conversation threads</StatHelpText>
        </Stat>

        <Stat sx={statCardStyle}>
          <StatLabel>Reactions</StatLabel>
          <StatNumber>
            {typeof analysis?.reaction_count === 'number'
              ? analysis.reaction_count.toLocaleString()
              : '0'}
          </StatNumber>
          <StatHelpText>Total emoji reactions</StatHelpText>
        </Stat>
      </SimpleGrid>
    </ErrorBoundary>
  )
}

export default AnalysisStats
