import React, { useState } from 'react'
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { signIn, signInWithGithub, signInWithGoogle } from '../../lib/supabase'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please enter both email and password',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    try {
      setLoading(true)
      const { error } = await signIn(email, password)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'You have been logged in successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      // Normal error handling
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to login',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGithubLogin = async () => {
    try {
      setLoading(true)
      const { error } = await signInWithGithub()
      if (error) throw error
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to login with GitHub',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const { error } = await signInWithGoogle()
      if (error) throw error
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to login with Google',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      p={8}
      maxWidth="500px"
      borderWidth={1}
      borderRadius={8}
      boxShadow="lg"
      mx="auto"
      mt={10}
    >
      <VStack spacing={4} align="flex-start">
        <Heading as="h1" size="xl">
          Login
        </Heading>

        {/* Development mode alert removed */}

        <form onSubmit={handleEmailLogin} style={{ width: '100%' }}>
          <Stack spacing={4} width="100%">
            <FormControl id="email" isRequired>
              <FormLabel>Email address</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </FormControl>

            <FormControl id="password" isRequired>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </FormControl>

            <Button
              colorScheme="blue"
              width="full"
              mt={4}
              type="submit"
              isLoading={loading}
              data-testid="email-login-button"
            >
              Sign In
            </Button>
          </Stack>
        </form>

        <Divider my={6} />

        <Text width="100%" textAlign="center" mb={2}>
          Or continue with
        </Text>

        <Stack direction="row" spacing={4} width="100%">
          <Button
            width="full"
            onClick={handleGithubLogin}
            isLoading={loading}
            leftIcon={
              <Box as="span" fontSize="1.2em">
                🐱
              </Box>
            }
          >
            GitHub
          </Button>

          <Button
            width="full"
            onClick={handleGoogleLogin}
            isLoading={loading}
            leftIcon={
              <Box as="span" fontSize="1.2em">
                G
              </Box>
            }
          >
            Google
          </Button>
        </Stack>
      </VStack>
    </Box>
  )
}

export default Login
