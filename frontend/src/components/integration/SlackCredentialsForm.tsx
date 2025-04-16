import React, { useEffect, useState } from 'react'
import {
  Box,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  Heading,
  FormHelperText,
  Text,
  Link,
  useToast,
  Alert,
  AlertIcon,
  HStack,
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react'
import { FiEye, FiEyeOff, FiExternalLink } from 'react-icons/fi'

interface SlackCredentialsFormProps {
  onSuccess: () => void
}

/**
 * Form for collecting Slack API credentials and storing them in localStorage
 */
const SlackCredentialsForm: React.FC<SlackCredentialsFormProps> = ({
  onSuccess,
}) => {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toast = useToast()

  // Load stored credentials if they exist
  useEffect(() => {
    const storedClientId = localStorage.getItem('slack_client_id')
    const storedClientSecret = localStorage.getItem('slack_client_secret')

    if (storedClientId) setClientId(storedClientId)
    if (storedClientSecret) setClientSecret(storedClientSecret)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate inputs
    if (!clientId) {
      setError('Client ID is required')
      return
    }

    // Slack Client IDs typically follow a specific format
    if (!clientId.includes('.')) {
      setError(
        'Client ID appears to be invalid. Slack Client IDs usually contain a period (.)'
      )
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Store credentials in localStorage
      localStorage.setItem('slack_client_id', clientId)
      if (clientSecret) {
        localStorage.setItem('slack_client_secret', clientSecret)
      }

      toast({
        title: 'Credentials saved',
        description: 'Your Slack API credentials have been saved',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Let the parent component know we're done
      onSuccess()
    } catch (err) {
      console.error('Error saving credentials:', err)
      setError('Failed to save credentials')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box>
      <Heading size="md" mb={4}>
        Slack App Credentials
      </Heading>

      <VStack mb={6} align="start" spacing={4}>
        <Text>
          To connect Slack, you'll need to create a Slack app and provide the
          Client ID. You can optionally save your Client Secret if you're using
          direct OAuth (without a backend handler).
        </Text>

        <Box
          borderWidth="1px"
          borderRadius="md"
          p={4}
          width="100%"
          bg="blue.50"
        >
          <Text fontWeight="bold" mb={2}>
            How to create a Slack app:
          </Text>
          <ol style={{ paddingLeft: '20px' }}>
            <li>
              Go to{' '}
              <Link
                href="https://api.slack.com/apps"
                isExternal
                color="blue.500"
              >
                https://api.slack.com/apps
              </Link>
            </li>
            <li>Click "Create New App" and select "From scratch"</li>
            <li>Give your app a name and select your workspace</li>
            <li>
              Under "OAuth & Permissions", add the redirect URL:{' '}
              {window.location.origin}/dashboard/integrations/oauth/slack
            </li>
            <li>
              Add the required scopes: channels:read, channels:history,
              users:read, groups:read
            </li>
            <li>
              Under "Basic Information", copy the Client ID and Client Secret
            </li>
            <li>Enter those values here and save</li>
          </ol>
        </Box>
      </VStack>

      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <FormControl>
            <FormLabel>Redirect URI (Copy this to your Slack App)</FormLabel>
            <Input
              value={`${window.location.origin}/dashboard/integrations/oauth/slack`}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              bg="gray.50"
            />
            <FormHelperText>
              Add this URL to the "Redirect URLs" section in your Slack App's
              OAuth & Permissions page
            </FormHelperText>
          </FormControl>

          <FormControl isRequired mt={4}>
            <FormLabel>Client ID</FormLabel>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="1234567890.1234567890"
            />
            <FormHelperText>
              Found in your Slack App configuration under "Basic Information"
            </FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>Client Secret (Optional)</FormLabel>
            <InputGroup>
              <Input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="abcd1234abcd1234abcd1234"
              />
              <InputRightElement>
                <IconButton
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                  icon={showSecret ? <FiEyeOff /> : <FiEye />}
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSecret(!showSecret)}
                />
              </InputRightElement>
            </InputGroup>
            <FormHelperText>
              Only needed for some integration features
            </FormHelperText>
          </FormControl>

          <HStack justify="space-between" mt={2}>
            <Link
              href="https://api.slack.com/apps"
              isExternal
              color="blue.500"
              fontSize="sm"
            >
              Create a Slack App{' '}
              <FiExternalLink style={{ display: 'inline' }} />
            </Link>

            <Button type="submit" colorScheme="blue" isLoading={isLoading}>
              Save & Continue
            </Button>
          </HStack>
        </VStack>
      </form>
    </Box>
  )
}

export default SlackCredentialsForm
