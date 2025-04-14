import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Textarea,
  useToast,
  VStack,
  FormErrorMessage,
} from '@chakra-ui/react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiUsers } from 'react-icons/fi';

import env from '../../config/env';

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

const TeamDetailPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const toast = useToast();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  
  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');


  const fetchTeam = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${env.apiUrl}/teams/${teamId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching team: ${response.status}`);
      }

      const data = await response.json();
      setTeam(data);
      
      // Initialize form fields
      setName(data.name || '');
      setSlug(data.slug || '');
      setDescription(data.description || '');
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: 'Error loading team',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [teamId, toast]);
  
  // Call fetchTeam when component mounts or teamId changes
  useEffect(() => {
    if (teamId) {
      fetchTeam();
    }
  }, [teamId, fetchTeam]);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!name.trim()) {
      errors.name = 'Team name is required';
    }
    if (!slug.trim()) {
      errors.slug = 'Team slug is required';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`${env.apiUrl}/teams/${teamId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          slug,
          description: description || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to update team: ${response.status}`);
      }

      const updatedTeam = await response.json();
      setTeam(updatedTeam);
      
      toast({
        title: 'Team updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: 'Error updating team',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" height="50vh">
        <Spinner size="xl" color="blue.500" thickness="4px" />
      </Flex>
    );
  }

  if (!team) {
    return (
      <Box textAlign="center" py={10}>
        <Heading size="md">Team not found</Heading>
        <Button
          as={Link}
          to="/dashboard/teams"
          colorScheme="blue"
          mt={4}
          leftIcon={<FiArrowLeft />}
        >
          Back to Teams
        </Button>
      </Box>
    );
  }

  return (
    <Container maxW="container.lg" py={6}>
      <Flex mb={6} alignItems="center">
        <Button
          as={Link}
          to="/dashboard/teams"
          leftIcon={<FiArrowLeft />}
          variant="outline"
          mr={4}
        >
          Back
        </Button>
        <Heading size="lg">Team Settings</Heading>
      </Flex>

      <Tabs colorScheme="blue" isLazy>
        <TabList mb={4}>
          <Tab>General</Tab>
          <Tab>Members</Tab>
          <Tab>Integrations</Tab>
        </TabList>

        <TabPanels>
          {/* General Settings Tab */}
          <TabPanel>
            <Box borderWidth="1px" borderRadius="lg" p={6}>
              <VStack spacing={6} align="stretch">
                <FormControl isInvalid={!!formErrors.name} isRequired>
                  <FormLabel>Team Name</FormLabel>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formErrors.name) {
                        setFormErrors({ ...formErrors, name: '' });
                      }
                    }}
                  />
                  <FormErrorMessage>{formErrors.name}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!formErrors.slug} isRequired>
                  <FormLabel>Team Slug</FormLabel>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      if (formErrors.slug) {
                        setFormErrors({ ...formErrors, slug: '' });
                      }
                    }}
                    placeholder="team-slug"
                  />
                  <FormErrorMessage>{formErrors.slug}</FormErrorMessage>
                </FormControl>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the team"
                    rows={3}
                  />
                </FormControl>

                <Flex justifyContent="flex-end" mt={4}>
                  <Button
                    leftIcon={<FiSave />}
                    colorScheme="blue"
                    onClick={handleSave}
                    isLoading={isSaving}
                  >
                    Save Changes
                  </Button>
                </Flex>
              </VStack>
            </Box>
          </TabPanel>

          {/* Members Tab */}
          <TabPanel>
            <Box borderWidth="1px" borderRadius="lg" p={6}>
              <Flex justifyContent="space-between" alignItems="center" mb={4}>
                <Heading size="md">Team Members</Heading>
                <Button
                  as={Link}
                  to={`/dashboard/teams/${teamId}/members`}
                  colorScheme="blue"
                  leftIcon={<FiUsers />}
                >
                  Manage Members
                </Button>
              </Flex>
            </Box>
          </TabPanel>

          {/* Integrations Tab */}
          <TabPanel>
            <Box borderWidth="1px" borderRadius="lg" p={6}>
              <Heading size="md" mb={4}>Team Integrations</Heading>
              {/* Integrations content will go here in future implementation */}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
};

export default TeamDetailPage;
