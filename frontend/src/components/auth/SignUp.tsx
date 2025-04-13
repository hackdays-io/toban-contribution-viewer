import React, { useState, useEffect } from 'react';
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { signUp, isUsingMockClient } from '../../lib/supabase';
import env from '../../config/env';

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevModeAlert, setShowDevModeAlert] = useState(false);
  const toast = useToast();
  
  // Check if we're in development mode with mock authentication
  const isDevelopmentEnv = env.isDev || process.env.NODE_ENV === 'development';
  const isNgrokOrLocalhost = window.location.hostname.includes('ngrok') || 
                             window.location.hostname === 'localhost';
  const isMockEnvironment = isDevelopmentEnv && isNgrokOrLocalhost && isUsingMockClient();
  
  // Show development mode notice on component mount
  useEffect(() => {
    if (isMockEnvironment) {
      setShowDevModeAlert(true);
    }
  }, [isMockEnvironment]);

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
      // Check if we're using mock auth in development
      const isMockEnv = process.env.NODE_ENV === 'development' && 
                       (window.location.hostname.includes('ngrok') || 
                        window.location.hostname === 'localhost');
      
      if (isMockEnv) {
        // In development with mock auth, show a more helpful message
        toast({
          title: 'Development Mode',
          description: 'Signup functionality is mocked in development. Try any credentials or click "Sign Up".',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      } else {
        // Normal error handling in production
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to sign up',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={8} maxWidth="500px" borderWidth={1} borderRadius={8} boxShadow="lg" mx="auto" mt={10}>
      <VStack spacing={4} align="flex-start">
        <Heading as="h1" size="xl">Sign Up</Heading>
        
        {showDevModeAlert && (
          <Alert 
            status="info" 
            variant="solid" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            textAlign="center" 
            borderRadius="md"
          >
            <AlertIcon boxSize="24px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              Development Mode
            </AlertTitle>
            <AlertDescription maxWidth="sm">
              Authentication is mocked for local development. 
              You can use any credentials to sign up and will be automatically logged in.
            </AlertDescription>
            <Button 
              mt={4} 
              colorScheme="blue" 
              size="sm" 
              onClick={() => {
                signUp('dev@example.com', 'password');
              }}
            >
              Auto-Register as Dev User
            </Button>
          </Alert>
        )}

        <form onSubmit={handleSignUp} style={{ width: '100%' }}>
          <Stack spacing={4} width="100%">
            <FormControl id="email" isRequired={!isMockEnvironment}>
              <FormLabel>Email address</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isMockEnvironment ? "Any email works in dev mode" : "Enter your email"}
              />
            </FormControl>

            <FormControl id="password" isRequired={!isMockEnvironment}>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isMockEnvironment ? "Any password works in dev mode" : "Enter your password"}
              />
            </FormControl>

            <FormControl id="confirmPassword" isRequired={!isMockEnvironment}>
              <FormLabel>Confirm Password</FormLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isMockEnvironment ? "Any confirmation works" : "Confirm your password"}
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
