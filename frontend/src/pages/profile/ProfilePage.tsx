import React, { useState, useEffect } from 'react'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Avatar,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Divider,
  Button,
  Flex,
  Container,
  Spinner,
  SimpleGrid,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react'
import { FiEdit, FiUsers } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../../context/useAuth'

interface UserProfile {
  id: string
  email: string
  name?: string
  avatar_url?: string
  last_sign_in_at?: string
  created_at?: string
}

/**
 * User profile page component
 * Displays user information and teams they belong to
 */
const ProfilePage: React.FC = () => {
  const { user, teamContext } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()

  const cardBg = useColorModeValue('white', 'gray.700')
  const borderColor = useColorModeValue('gray.200', 'gray.600')

  // Load profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true)
        // For now, use the user data from auth context
        // Later we can fetch additional profile data from an API
        if (user) {
          setProfile({
            id: user.id,
            email: user.email || '',
            name:
              user.user_metadata?.name || user.user_metadata?.full_name || '',
            avatar_url: user.user_metadata?.avatar_url,
            last_sign_in_at: user?.last_sign_in_at,
            created_at: user?.created_at,
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        toast({
          title: 'Error loading profile',
          description:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [user, toast])

  const handleEditProfile = () => {
    navigate('/dashboard/profile/edit')
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minHeight="500px">
        <Spinner size="xl" color="purple.500" thickness="4px" />
      </Flex>
    )
  }

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Profile header */}
        <Flex direction={{ base: 'column', md: 'row' }} gap={6} align="center">
          <Avatar
            size="2xl"
            name={profile?.name || profile?.email || 'User'}
            src={profile?.avatar_url}
            border="3px solid"
            borderColor="purple.500"
          />
          <VStack
            align={{ base: 'center', md: 'flex-start' }}
            spacing={2}
            flex={1}
          >
            <Heading size="xl">{profile?.name || 'User'}</Heading>
            <Text color="gray.500">{profile?.email}</Text>
            <HStack mt={2}>
              <Button
                leftIcon={<FiEdit />}
                colorScheme="purple"
                variant="outline"
                onClick={handleEditProfile}
              >
                Edit Profile
              </Button>
            </HStack>
          </VStack>
        </Flex>

        <Divider />

        {/* Profile details */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {/* Account information */}
          <Card variant="outline" bg={cardBg} borderColor={borderColor}>
            <CardHeader pb={0}>
              <Heading size="md">Account Information</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="medium">User ID</Text>
                  <Text fontFamily="mono" fontSize="sm">
                    {profile?.id}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontWeight="medium">Email</Text>
                  <Text>{profile?.email}</Text>
                </HStack>
                {profile?.created_at && (
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Account Created</Text>
                    <Text>
                      {new Date(profile.created_at).toLocaleDateString()}
                    </Text>
                  </HStack>
                )}
                {profile?.last_sign_in_at && (
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Last Sign In</Text>
                    <Text>
                      {new Date(profile.last_sign_in_at).toLocaleDateString()}
                    </Text>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Teams */}
          <Card variant="outline" bg={cardBg} borderColor={borderColor}>
            <CardHeader pb={0}>
              <Heading size="md">Your Teams</Heading>
            </CardHeader>
            <CardBody>
              {teamContext.teams.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Text mb={2}>You're not a member of any teams yet.</Text>
                  <Button
                    as={Link}
                    to="/dashboard/teams"
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                    leftIcon={<FiUsers />}
                  >
                    View Teams
                  </Button>
                </Box>
              ) : (
                <VStack spacing={4} align="stretch">
                  {teamContext.teams.map((team) => (
                    <HStack
                      key={team.id}
                      justify="space-between"
                      p={2}
                      borderWidth="1px"
                      borderRadius="md"
                    >
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold">{team.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          Slug: {team.slug}
                        </Text>
                      </VStack>
                      <Badge
                        colorScheme={
                          team.role === 'owner'
                            ? 'purple'
                            : team.role === 'admin'
                              ? 'blue'
                              : team.role === 'member'
                                ? 'green'
                                : 'gray'
                        }
                      >
                        {team.role}
                      </Badge>
                    </HStack>
                  ))}
                  <Button
                    as={Link}
                    to="/dashboard/teams"
                    size="sm"
                    colorScheme="purple"
                    variant="ghost"
                    leftIcon={<FiUsers />}
                  >
                    Manage Teams
                  </Button>
                </VStack>
              )}
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </Container>
  )
}

export default ProfilePage
