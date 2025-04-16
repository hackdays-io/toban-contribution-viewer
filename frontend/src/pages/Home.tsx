import React from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import useAuth from '../context/useAuth'

const Home: React.FC = () => {
  const { user } = useAuth()
  const bgColor = useColorModeValue('gray.50', 'gray.800')

  return (
    <Box>
      <Box
        as="section"
        bg={bgColor}
        py={20}
        px={8}
        borderRadius="lg"
        textAlign="center"
      >
        <Container maxW="container.lg">
          <Heading as="h1" size="2xl" mb={4}>
            Toban Contribution Viewer
          </Heading>
          <Text fontSize="xl" mb={8} maxW="container.md" mx="auto">
            Visualize and track contributions across various platforms. Get
            insights into your team's activity and improve collaboration.
          </Text>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={4}
            justify="center"
          >
            {user ? (
              <Button
                as={RouterLink}
                to="/dashboard"
                colorScheme="blue"
                size="lg"
                fontWeight="bold"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  as={RouterLink}
                  to="/login"
                  colorScheme="blue"
                  size="lg"
                  fontWeight="bold"
                >
                  Login
                </Button>
                <Button
                  as={RouterLink}
                  to="/signup"
                  colorScheme="teal"
                  size="lg"
                  fontWeight="bold"
                >
                  Sign Up
                </Button>
              </>
            )}
          </Stack>
        </Container>
      </Box>

      <Box as="section" py={16} px={8}>
        <Container maxW="container.lg">
          <Heading as="h2" size="xl" mb={10} textAlign="center">
            Key Features
          </Heading>

          <Stack
            direction={{ base: 'column', md: 'row' }}
            spacing={10}
            justify="center"
            align="flex-start"
          >
            <Feature
              title="Integration"
              description="Connect with Slack, GitHub, and Notion to collect activity data across multiple platforms."
            />
            <Feature
              title="Analysis"
              description="AI-powered analysis identifies meaningful contributions and patterns in team communication."
            />
            <Feature
              title="Visualization"
              description="Interactive dashboards with customizable views to showcase team contributions."
            />
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

interface FeatureProps {
  title: string
  description: string
}

const Feature: React.FC<FeatureProps> = ({ title, description }) => {
  return (
    <Box
      bg={useColorModeValue('white', 'gray.700')}
      borderRadius="lg"
      boxShadow="md"
      p={6}
      width="100%"
    >
      <Heading as="h3" size="md" mb={4}>
        {title}
      </Heading>
      <Text color={useColorModeValue('gray.600', 'gray.300')}>
        {description}
      </Text>
    </Box>
  )
}

export default Home
