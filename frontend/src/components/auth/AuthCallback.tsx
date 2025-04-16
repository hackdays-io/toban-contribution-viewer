import React, { useEffect, useState } from 'react'
import { Center, Spinner, Text, VStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Handle the OAuth callback - this will extract the auth tokens from the URL
    const handleAuthCallback = async () => {
      try {
        // The hash contains the access token after OAuth login
        const { error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        // Redirect to the home page or dashboard after successful login
        navigate('/', { replace: true })
      } catch (err: unknown) {
        console.error('Error processing auth callback:', err)
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred'
        )
      }
    }

    handleAuthCallback()
  }, [navigate])

  if (error) {
    return (
      <Center h="100vh">
        <VStack spacing={4}>
          <Text color="red.500" fontSize="xl">
            Authentication Error
          </Text>
          <Text>{error}</Text>
        </VStack>
      </Center>
    )
  }

  return (
    <Center h="100vh">
      <VStack spacing={4}>
        <Spinner size="xl" thickness="4px" speed="0.65s" color="blue.500" />
        <Text fontSize="xl">Completing authentication...</Text>
      </VStack>
    </Center>
  )
}

export default AuthCallback
