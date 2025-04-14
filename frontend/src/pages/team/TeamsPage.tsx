import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  SimpleGrid,
  Badge,
  Spinner,
  useToast,
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  FormErrorMessage,
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiUsers, FiSettings, FiTrash2 } from 'react-icons/fi';

import env from '../../config/env';
import useAuth from '../../context/useAuth';
import { supabase } from '../../lib/supabase';

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  team_size: number;
  is_personal: boolean;
  created_by_user_id: string;
  created_by_email: string | null;
  team_metadata: Record<string, unknown>;
}

interface CreateTeamForm {
  name: string;
  slug: string;
  description: string;
}

const TeamsPage: React.FC = () => {
  useAuth(); // Auth context is used but no properties are currently needed
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [formData, setFormData] = useState<CreateTeamForm>({
    name: '',
    slug: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<CreateTeamForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);


  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Construct the authorization header
      const authHeader = token ? `Bearer ${token}` : '';
      
      const response = await fetch(`${env.apiUrl}/teams`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching teams: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: 'Error loading teams',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  // Call fetchTeams when component mounts
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Auto-generate slug from name if the slug field hasn't been manually edited
    if (name === 'name' && !formData.slug) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setFormData(prev => ({ ...prev, name: value, slug }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear any previous error for this field
    if (formErrors[name as keyof CreateTeamForm]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const errors: Partial<CreateTeamForm> = {};
    if (!formData.name.trim()) {
      errors.name = 'Team name is required';
    }
    if (!formData.slug.trim()) {
      errors.slug = 'Team slug is required';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    return errors;
  };

  const handleCreateTeam = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${env.apiUrl}/teams`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to create team: ${response.status}`);
      }

      const data = await response.json();
      setTeams(prev => [...prev, data]);
      
      toast({
        title: 'Team created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setFormData({ name: '', slug: '', description: '' });
      onClose();
      
      // Navigate to the new team
      navigate(`/dashboard/teams/${data.id}`);
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: 'Error creating team',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTeamCard = (team: Team) => {
    return (
      <Card key={team.id} variant="outline" size="md">
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">{team.name}</Heading>
            {team.is_personal && (
              <Badge colorScheme="purple">Personal</Badge>
            )}
          </Flex>
        </CardHeader>
        <CardBody>
          <Text color="gray.600" noOfLines={2} mb={4}>
            {team.description || 'No description provided.'}
          </Text>
          <HStack>
            <Text fontSize="sm" color="gray.500">
              Members: {team.team_size}
            </Text>
          </HStack>
        </CardBody>
        <Divider />
        <CardFooter>
          <HStack spacing={3}>
            <Button
              as={Link}
              to={`/dashboard/teams/${team.id}/members`}
              leftIcon={<FiUsers />}
              size="sm"
              variant="outline"
              colorScheme="blue"
            >
              Members
            </Button>
            <Button
              as={Link}
              to={`/dashboard/teams/${team.id}`}
              leftIcon={<FiSettings />}
              size="sm"
              variant="outline"
              colorScheme="blue"
            >
              Settings
            </Button>
            {!team.is_personal && (
              <Button
                leftIcon={<FiTrash2 />}
                size="sm"
                variant="outline"
                colorScheme="red"
                onClick={() => handleDeleteTeam(team.id)}
              >
                Delete
              </Button>
            )}
          </HStack>
        </CardFooter>
      </Card>
    );
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${env.apiUrl}/teams/${teamId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete team: ${response.status}`);
      }

      setTeams(prev => prev.filter(team => team.id !== teamId));
      
      toast({
        title: 'Team deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: 'Error deleting team',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };


  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">Teams</Heading>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          onClick={onOpen}
        >
          Create Team
        </Button>
      </Flex>

      {isLoading ? (
        <Flex justify="center" align="center" height="300px">
          <Spinner size="xl" color="blue.500" thickness="4px" />
        </Flex>
      ) : teams.length === 0 ? (
        <Box p={8} textAlign="center" borderWidth="1px" borderRadius="lg">
          <Heading size="md" mb={4}>No teams found</Heading>
          <Text mb={6}>Create your first team to start managing your workspaces.</Text>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="blue"
            onClick={onOpen}
          >
            Create Team
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {teams.map(renderTeamCard)}
        </SimpleGrid>
      )}

      {/* Create Team Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Team</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isInvalid={!!formErrors.name} isRequired>
                <FormLabel>Team Name</FormLabel>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter team name"
                />
                <FormErrorMessage>{formErrors.name}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!formErrors.slug} isRequired>
                <FormLabel>Team Slug</FormLabel>
                <Input
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  placeholder="team-slug"
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Used in URLs and identifiers
                </Text>
                <FormErrorMessage>{formErrors.slug}</FormErrorMessage>
              </FormControl>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of the team"
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleCreateTeam}
              isLoading={isSubmitting}
            >
              Create Team
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TeamsPage;
