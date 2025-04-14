import React, { useState } from 'react';
import {
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
  Input,
  Text,
  useDisclosure,
  useToast,
  IconButton,
  Tooltip,
  HStack,
  Select,
} from '@chakra-ui/react';
import { FiMail, FiRefreshCw, FiEdit } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import env from '../../config/env';

interface TeamInvitationResenderProps {
  teamId: string;
  memberId: string;
  memberEmail: string;
  onSuccess: () => void;
  isExpired?: boolean;
}

/**
 * Component for resending team invitations
 */
const TeamInvitationResender: React.FC<TeamInvitationResenderProps> = ({ 
  teamId, 
  memberId,
  memberEmail,
  onSuccess,
  isExpired = false
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const handleResendInvite = async () => {
    try {
      setIsSubmitting(true);
      
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members/${memberId}/resend-invite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ 
          custom_message: customMessage 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to resend invitation: ${response.status}`);
      }
      
      toast({
        title: 'Invitation resent',
        description: `A new invitation has been sent to ${memberEmail}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setCustomMessage('');
      onClose();
      
      // Call the callback
      onSuccess();
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error resending invitation',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add manual status change functionality (for testing only)
  const [invitationStatus, setInvitationStatus] = useState('pending');
  
  const handleUpdateStatus = async () => {
    try {
      setIsSubmitting(true);
      
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members/${memberId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ 
          invitation_status: invitationStatus 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to update invitation status: ${response.status}`);
      }
      
      toast({
        title: 'Status updated',
        description: `Invitation status has been updated to ${invitationStatus}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Close modal
      onClose();
      
      // Call the callback
      onSuccess();
    } catch (error) {
      console.error('Error updating invitation status:', error);
      toast({
        title: 'Error updating status',
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
      <HStack spacing={2}>
        <Tooltip label="Resend Invitation">
          <IconButton
            icon={isExpired ? <FiRefreshCw /> : <FiMail />}
            size="sm"
            aria-label="Resend invitation"
            variant="ghost"
            colorScheme="blue"
            onClick={onOpen}
          />
        </Tooltip>
        
        {/* Debug button for testing - more visible */}
        <Tooltip label="Debug: Change Status">
          <Button
            leftIcon={<FiEdit />}
            size="sm"
            aria-label="Change invitation status"
            variant="outline"
            colorScheme="purple"
            onClick={() => {
              setInvitationStatus('pending');
              onOpen();
            }}
          >
            Debug
          </Button>
        </Tooltip>
      </HStack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Invitation Management</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              This will send a new invitation email to <strong>{memberEmail}</strong> with a fresh invitation link.
              {isExpired && ' The current invitation has expired.'}
            </Text>
            
            <FormControl mb={4}>
              <FormLabel>Personal Message (Optional)</FormLabel>
              <Input
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a note to the invitation email"
              />
            </FormControl>
            
            {/* Debug control - for testing only */}
            <FormControl 
              mb={4} 
              border="2px dashed purple" 
              p={3}
              bg="purple.50"
              borderRadius="md"
            >
              <FormLabel color="purple.700" fontWeight="bold">
                DEBUG MODE: Change Invitation Status
              </FormLabel>
              <Select
                value={invitationStatus}
                onChange={(e) => setInvitationStatus(e.target.value)}
                bg="white"
                border="1px solid purple"
                fontWeight="bold"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </Select>
              <Text fontSize="sm" color="purple.700" mt={2}>
                This feature allows direct manipulation of the invitation status 
                to simulate a user accepting or declining an invitation.
                Select "active" to simulate a user accepting the invitation.
              </Text>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              leftIcon={<FiMail />}
              colorScheme="blue"
              onClick={handleResendInvite}
              isLoading={isSubmitting && customMessage !== ''}
              mr={2}
            >
              {isExpired ? 'Send New Invitation' : 'Resend Invitation'}
            </Button>
            
            {/* Debug button - for testing only */}
            <Button
              leftIcon={<FiEdit />}
              colorScheme="purple"
              variant="solid"
              onClick={handleUpdateStatus}
              isLoading={isSubmitting && customMessage === ''}
              size="md"
            >
              DEBUG: Update Status
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default React.memo(TeamInvitationResender);
