import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Container,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Spinner,
  Stack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../context/useAuth';
import { supabase } from '../../lib/supabase';
import env from '../../config/env';

interface UserProfileForm {
  name: string;
}

/**
 * Edit profile page component
 * Allows users to update their profile information
 */
const EditProfilePage: React.FC = () => {
  const { user, teamContext } = useAuth();
  const [formData, setFormData] = useState<UserProfileForm>({
    name: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const toast = useToast();
  
  // Function to update display name in all team memberships
  const updateTeamMemberships = async (name: string) => {
    try {
      if (!user) return;
      
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Track successful and failed updates
      const results = {
        success: 0,
        failed: 0,
      };
      
      // Update display name for each team the user is a member of
      const updatePromises = teamContext.teams.map(async (team) => {
        try {
          // First get ALL member records for this team (including pending/inactive ones)
          // that match the current user's ID
          const memberResponse = await fetch(`${env.apiUrl}/teams/${team.id}/members?status=all`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            },
          });
          
          // If status=all parameter isn't supported by the API, fallback to the standard endpoint
          if (!memberResponse.ok) {
            const standardResponse = await fetch(`${env.apiUrl}/teams/${team.id}/members`, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
              },
            });
            
            if (!standardResponse.ok) {
              console.error(`Failed to get members for team ${team.id}: ${standardResponse.status}`);
              results.failed++;
              return;
            }
            
            const members = await standardResponse.json();
            return processMembers(members, team.id);
          }
          
          const members = await memberResponse.json();
          return processMembers(members, team.id);
          
        } catch (error) {
          console.error(`Error updating membership for team ${team.id}:`, error);
          results.failed++;
        }
      });
      
      // Helper function to process members and update display names
      async function processMembers(members: { members?: Array<{ id?: string; user_id?: string }> } | Array<{ id?: string; user_id?: string }>, teamId: string) {
        // Find all memberships for the current user (there could be multiple with different statuses)
        let userMembers = [];
        
        if (Array.isArray(members)) {
          userMembers = members.filter(m => m.user_id === user?.id);
        } else if (members && Array.isArray(members.members)) {
          userMembers = members.members.filter(m => m.user_id === user?.id);
        } else {
          console.error(`Unexpected members format for team ${teamId}`);
          results.failed++;
          return;
        }
        
        if (userMembers.length === 0) {
          console.log(`No memberships found for user in team ${teamId}`);
          return;
        }
        
        // Update each membership
        for (const membership of userMembers) {
          if (!membership.id) continue;
          
          try {
            const updateResponse = await fetch(`${env.apiUrl}/teams/${teamId}/members/${membership.id}`, {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
              },
              body: JSON.stringify({
                display_name: name,
              }),
            });
            
            if (!updateResponse.ok) {
              const errorText = await updateResponse.text();
              console.error(`Failed to update display name for membership ${membership.id}: ${updateResponse.status}`, errorText);
              results.failed++;
            } else {
              results.success++;
              console.log(`Successfully updated display name for membership ${membership.id} in team ${teamId}`);
            }
          } catch (error) {
            console.error(`Error updating display name for membership ${membership.id}:`, error);
            results.failed++;
          }
        }
      }
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      console.log(`Team membership updates complete. Success: ${results.success}, Failed: ${results.failed}`);
      
      // Return results for potential use in the calling function
      return results;
      
    } catch (error) {
      console.error('Error updating team memberships:', error);
      // We don't want to throw here as it would prevent the profile update from completing
      // Just log the error and continue
    }
  };

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Load profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        if (user) {
          // Initialize form with user data
          setFormData({
            name: user.user_metadata?.name || user.user_metadata?.full_name || '',
          });
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        toast({
          title: 'Error loading profile',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when field is changed
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Update user metadata in Supabase
      const { error } = await supabase.auth.updateUser({
        data: {
          name: formData.name.trim(),
        },
      });
      
      if (error) {
        throw error;
      }
      
      // Also update display name in all team memberships
      // This ensures the name is consistent across teams
      const results = await updateTeamMemberships(formData.name.trim());
      
      // Check for partial failures in team membership updates
      if (results && results.failed > 0) {
        if (results.success > 0) {
          // Some updates succeeded, some failed
          toast({
            title: 'Profile updated with warnings',
            description: `Your profile was updated, but name changes in ${results.failed} teams failed to sync. Team administrators will still see your previous name in those teams.`,
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        } else {
          // All team membership updates failed
          toast({
            title: 'Profile updated with warnings',
            description: 'Your profile was updated, but the changes failed to sync with your team memberships. Team administrators will still see your previous name.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        }
      } else {
        // All successful or no teams to update
        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully across all your teams',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Navigate back to profile page
      navigate('/dashboard/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error updating profile',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard/profile');
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minHeight="500px">
        <Spinner size="xl" color="purple.500" thickness="4px" />
      </Flex>
    );
  }

  return (
    <Container maxW="container.md" py={8}>
      <Card variant="outline" bg={cardBg} borderColor={borderColor}>
        <CardHeader>
          <Heading size="lg">Edit Profile</Heading>
        </CardHeader>
        <Divider />
        <CardBody>
          <form onSubmit={handleSubmit}>
            <Stack spacing={6}>
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel>Name</FormLabel>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                />
                <FormErrorMessage>{errors.name}</FormErrorMessage>
              </FormControl>
              
              {/* Future: Add more fields like bio, social links, etc. */}
            </Stack>
          </form>
        </CardBody>
        <CardFooter>
          <Flex justify="space-between" width="100%">
            <Button
              leftIcon={<FiArrowLeft />}
              variant="ghost"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              leftIcon={<FiSave />}
              colorScheme="purple"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          </Flex>
        </CardFooter>
      </Card>
    </Container>
  );
};

export default EditProfilePage;
