import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  VStack,
  Link as ChakraLink,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { signUp } from '../../lib/supabase';

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await signUp(email, password);

      if (error) throw error;

      // More detailed success message in development
      const isDev = import.meta.env.VITE_DEV_MODE === 'true';

      toast({
        title: 'Success',
        description: isDev
          ? 'Development mode: Email confirmation sent to Supabase. Please log in to your Supabase dashboard to view confirmation links or try signing in directly.'
          : 'Check your email for the confirmation link!',
        status: 'success',
        duration: 10000,
        isClosable: true,
      });
    } catch (error) {
      // Normal error handling
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign up',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={8} maxWidth="500px" borderWidth={1} borderRadius={8} boxShadow="lg" mx="auto" mt={10}>
      <VStack spacing={4} align="flex-start">
        <Heading as="h1" size="xl">Sign Up</Heading>
        
        {/* Development mode alert removed */}

        <form onSubmit={handleSignUp} style={{ width: '100%' }}>
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

            <FormControl id="confirmPassword" isRequired>
              <FormLabel>Confirm Password</FormLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
              />
            </FormControl>

            <Button
              colorScheme="blue"
              width="full"
              mt={4}
              type="submit"
              isLoading={loading}
            >
              Sign Up
            </Button>
          </Stack>
        </form>

        <Text mt={4}>
          Already have an account?{' '}
          <ChakraLink as={Link} to="/login" color="blue.500">
            Sign in
          </ChakraLink>
        </Text>
      </VStack>
    </Box>
  );
};

export default SignUp;
