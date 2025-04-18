import React from 'react'
import {
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  Select,
  Box,
  Text,
} from '@chakra-ui/react'
import useAuth from '../../context/useAuth'

interface TeamSelectorProps {
  onChange?: (teamId: string) => void
  isRequired?: boolean
  hasError?: boolean
  errorMessage?: string
  helperText?: string
  label?: string
  mb?: number
  value?: string
}

/**
 * Dropdown component for selecting a team
 */
const TeamSelector: React.FC<TeamSelectorProps> = ({
  onChange,
  isRequired = true,
  hasError = false,
  errorMessage = 'Please select a team',
  helperText = 'Select a team to continue',
  label = 'Team',
  mb = 4,
  value,
}) => {
  const { teamContext } = useAuth()

  // Handle the change event
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e.target.value)
    }
  }

  return (
    <FormControl isRequired={isRequired} isInvalid={hasError} mb={mb}>
      <FormLabel>{label}</FormLabel>
      <Select
        placeholder="Select a team"
        value={value || teamContext.currentTeamId || ''}
        onChange={handleChange}
      >
        {teamContext.teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}{' '}
            {team.role === 'owner'
              ? '(Owner)'
              : team.role === 'admin'
                ? '(Admin)'
                : ''}
          </option>
        ))}
      </Select>
      {!hasError ? (
        <FormHelperText>{helperText}</FormHelperText>
      ) : (
        <FormErrorMessage>{errorMessage}</FormErrorMessage>
      )}

      {teamContext.teams.length === 0 && (
        <Box mt={2} p={2} bg="yellow.50" borderRadius="md">
          <Text fontSize="sm" color="yellow.800">
            You don't have any teams yet. Please create a team to continue.
          </Text>
        </Box>
      )}
    </FormControl>
  )
}

export default TeamSelector
