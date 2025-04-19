import React, { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  useToast,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  FormHelperText,
  FormErrorMessage,
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'
import env from '../../config/env'

interface Integration {
  id: string
  name: string
  service_type: string
  status: string
  metadata?: Record<string, unknown>
}

interface ReconnectIntegrationProps {
  integration: Integration
  isOpen: boolean
  onClose: () => void
}

const ReconnectIntegration: React.FC<ReconnectIntegrationProps> = ({
  integration,
  isOpen,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [clientIdError, setClientIdError] = useState('')
  const [clientSecretError, setClientSecretError] = useState('')

  const toast = useToast()

  const validateForm = (): boolean => {
    let isValid = true

    // Validate client ID
    if (!clientId.trim()) {
      setClientIdError('Client ID is required')
      isValid = false
    } else {
      setClientIdError('')
    }

    // Validate client secret
    if (!clientSecret.trim()) {
      setClientSecretError('Client Secret is required')
      isValid = false
    } else {
      setClientSecretError('')
    }

    return isValid
  }

  const handleReconnect = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // Build URL with query parameters for client_id and client_secret
      const url = new URL(`${env.apiUrl}/slack/oauth-url`)
      url.searchParams.append('client_id', clientId)
      url.searchParams.append('client_secret', clientSecret)

      // Make the request to get the OAuth URL
      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to get Slack authorization URL')
      }

      const data = await response.json()

      // Store information in session storage for the OAuth callback
      sessionStorage.setItem('slack_client_id', clientId)
      sessionStorage.setItem('slack_client_secret', clientSecret)
      sessionStorage.setItem('slack_integration_name', integration.name)
      // Important: store the integration ID to indicate this is a reconnection
      sessionStorage.setItem('slack_integration_id', integration.id)

      // Close the modal before redirecting
      onClose()

      // Redirect to Slack OAuth page
      window.location.href = data.url
    } catch (error) {
      console.error('Error getting OAuth URL:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to initialize OAuth flow',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Reconnect {integration.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="flex-start">
            <Text>
              This integration needs to be reconnected because the
              authentication token has expired or been revoked.
            </Text>

            <Text fontWeight="bold">
              Please provide your Slack app credentials to reconnect.
            </Text>

            {/* Client ID Field */}
            <FormControl isRequired isInvalid={!!clientIdError}>
              <FormLabel htmlFor="client-id">Client ID</FormLabel>
              <Input
                id="client-id"
                placeholder="Enter your Slack Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
              {clientIdError ? (
                <FormErrorMessage>{clientIdError}</FormErrorMessage>
              ) : (
                <FormHelperText>
                  Find this in your Slack App's Basic Information page
                </FormHelperText>
              )}
            </FormControl>

            {/* Client Secret Field */}
            <FormControl isRequired isInvalid={!!clientSecretError}>
              <FormLabel htmlFor="client-secret">Client Secret</FormLabel>
              <InputGroup>
                <Input
                  id="client-secret"
                  type={showClientSecret ? 'text' : 'password'}
                  placeholder="Enter your Slack Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={
                      showClientSecret
                        ? 'Hide client secret'
                        : 'Show client secret'
                    }
                    icon={showClientSecret ? <ViewOffIcon /> : <ViewIcon />}
                    variant="ghost"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    size="sm"
                  />
                </InputRightElement>
              </InputGroup>
              {clientSecretError ? (
                <FormErrorMessage>{clientSecretError}</FormErrorMessage>
              ) : (
                <FormHelperText>
                  Keep this confidential. Found in your Slack App's Basic
                  Information page
                </FormHelperText>
              )}
            </FormControl>

            <Text fontSize="sm" color="gray.600">
              Reconnecting will initiate a new authentication flow with Slack.
              Any existing resources will be preserved.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleReconnect}
            isLoading={isLoading}
          >
            Reconnect
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ReconnectIntegration
