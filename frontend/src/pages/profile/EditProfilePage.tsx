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

interface UserProfileForm {
  name: string;
}

/**
 * Edit profile page component
 * Allows users to update their profile information
 */
const EditProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<UserProfileForm>({
    name: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const toast = useToast();

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
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
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
