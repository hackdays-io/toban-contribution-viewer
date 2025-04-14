import React, { useState } from 'react';
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Select,
  Text,
  useDisclosure,
  useToast,
  VStack,
  Textarea,
} from '@chakra-ui/react';
import { FiMail, FiPlus } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import env from '../../config/env';

interface InviteFormData {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  display_name?: string;
  message?: string;
}

interface TeamInvitationManagerProps {
  teamId: string;
  onInvitationSent: () => void;
  existingMemberEmails?: string[];
}

/**
 * Component for managing team invitations
 */
const TeamInvitationManager: React.FC<TeamInvitationManagerProps> = ({ 
  teamId, 
  onInvitationSent,
  existingMemberEmails = []
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: 'member',
    display_name: '',
    message: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<InviteFormData>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear any previous error for this field
    if (formErrors[name as keyof InviteFormData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const errors: Partial<InviteFormData> = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    // Check if this email is already a member
    if (existingMemberEmails.includes(formData.email.toLowerCase())) {
      errors.email = 'This email is already a team member or has a pending invitation';
    }
    
    return errors;
  };

  const handleInviteMember = async () => {
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
      
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/invite`, {
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
        throw new Error(errorData.detail || `Failed to invite member: ${response.status}`);
      }

      toast({
        title: 'Invitation sent successfully',
        description: `Invitation sent to ${formData.email}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setFormData({ 
        email: '', 
        role: 'member',
        display_name: '',
        message: ''
      });
      onClose();
      
      // Call the callback
      onInvitationSent();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast({
        title: 'Error sending invitation',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        leftIcon={<FiPlus />}
        colorScheme="blue"
        onClick={onOpen}
      >
        Invite Member
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Invite Team Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isInvalid={!!formErrors.email} isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                />
                <FormErrorMessage>{formErrors.email}</FormErrorMessage>
              </FormControl>

              <FormControl>
                <FormLabel>Name (Optional)</FormLabel>
                <Input
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  placeholder="Enter recipient's name"
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  This will be used when the user joins the team
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  <Box as="span" fontWeight="bold">Admin:</Box> Can manage team settings and members
                  <br />
                  <Box as="span" fontWeight="bold">Member:</Box> Can access all resources but can't manage the team
                  <br />
                  <Box as="span" fontWeight="bold">Viewer:</Box> Read-only access to resources
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Personal Message (Optional)</FormLabel>
                <Textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Add a note to the invitation email"
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
              leftIcon={<FiMail />}
              colorScheme="blue"
              onClick={handleInviteMember}
              isLoading={isSubmitting}
            >
              Send Invitation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default React.memo(TeamInvitationManager);
