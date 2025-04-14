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
} from '@chakra-ui/react';
import { FiMail, FiRefreshCw } from 'react-icons/fi';
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

  return (
    <>
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

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Resend Invitation</ModalHeader>
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
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              leftIcon={<FiMail />}
              colorScheme="blue"
              onClick={handleResendInvite}
              isLoading={isSubmitting}
            >
              {isExpired ? 'Send New Invitation' : 'Resend Invitation'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default React.memo(TeamInvitationResender);
