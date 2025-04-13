import React, { useState, useEffect } from 'react';
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { signIn, signInWithGithub, signInWithGoogle, isUsingMockClient } from '../../lib/supabase';
import env from '../../config/env';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please enter both email and password',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await signIn(email, password);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'You have been logged in successfully!',
        status: 'success',
        duration: 3000,
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
          description: 'Login functionality is mocked in development. Try any credentials or click "Sign In".',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      } else {
        // Normal error handling in production
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to login',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    try {
      setLoading(true);
      const { error } = await signInWithGithub();
      if (error) throw error;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to login with GitHub',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to login with Google',
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
        <Heading as="h1" size="xl">Login</Heading>
        
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
              You can use any credentials to log in or simply click the Sign In button.
            </AlertDescription>
            <Button 
              mt={4} 
              colorScheme="blue" 
              size="sm" 
              onClick={() => {
                signIn('dev@example.com', 'password');
              }}
            >
              Auto-Login as Dev User
            </Button>
          </Alert>
        )}

        <form onSubmit={handleEmailLogin} style={{ width: '100%' }}>
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

            <Button
              colorScheme="blue"
              width="full"
              mt={4}
              type="submit"
              isLoading={loading}
            >
              Sign In
            </Button>
          </Stack>
        </form>

        <Divider my={6} />

        <Text width="100%" textAlign="center" mb={2}>Or continue with</Text>

        <Stack direction="row" spacing={4} width="100%">
          <Button
            width="full"
            onClick={handleGithubLogin}
            isLoading={loading}
            leftIcon={<Box as="span" fontSize="1.2em">🐱</Box>}
          >
            GitHub
          </Button>

          <Button
            width="full"
            onClick={handleGoogleLogin}
            isLoading={loading}
            leftIcon={<Box as="span" fontSize="1.2em">G</Box>}
          >
            Google
          </Button>
        </Stack>
      </VStack>
    </Box>
  );
};

export default Login;
