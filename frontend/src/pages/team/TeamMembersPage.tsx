import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Spinner,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuDivider,
  IconButton,
  Badge,
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
  Select,
  FormErrorMessage,
  useDisclosure,
  HStack,
  Avatar,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiMoreVertical, FiPlus, FiUserPlus, FiMail, FiRefreshCw, FiTrash2 } from 'react-icons/fi';

import env from '../../config/env';
import { supabase } from '../../lib/supabase';

interface TeamMember {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invitation_status: 'active' | 'pending' | 'expired' | 'inactive' | string;
  invitation_token: string | null;
  invitation_expires_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  team_size: number;
  is_personal: boolean;
  avatar_url: string | null;
  created_by_user_id: string;
  created_by_email: string | null;
}

interface InviteFormData {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  display_name?: string;
  message?: string;
}

interface ResendInviteData {
  member_id: string;
  custom_message?: string;
}

const TeamMembersPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const toast = useToast();
  
  // Multiple modals
  const { 
    isOpen: isInviteModalOpen, 
    onOpen: onInviteModalOpen, 
    onClose: onInviteModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isResendModalOpen, 
    onOpen: onResendModalOpen, 
    onClose: onResendModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isConfirmDeleteOpen, 
    onOpen: onConfirmDeleteOpen, 
    onClose: onConfirmDeleteClose 
  } = useDisclosure();
  
  // Refs
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  // Entity state
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // Form data
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: 'member',
    display_name: '',
    message: '',
  });
  
  const [resendData, setResendData] = useState<ResendInviteData>({
    member_id: '',
    custom_message: '',
  });
  
  const [formErrors, setFormErrors] = useState<Partial<InviteFormData>>({});


  const fetchTeam = useCallback(async () => {
    try {
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${env.apiUrl}/teams/${teamId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching team: ${response.status}`);
      }

      const data = await response.json();
      setTeam(data);
      return data;
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: 'Error loading team',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      throw error;
    }
  }, [teamId, toast]);

  const fetchMembers = useCallback(async () => {
    try {
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Using "all=true" query parameter to get all members including pending, expired, and inactive
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members?all=true`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json', 
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        // If the "all" parameter isn't supported (in case you're using an older API version)
        // let's try to get each status type separately and combine them
        if (response.status === 400) {
          // Fallback to multiple requests if the API doesn't support "all" parameter
          const [activeResp, pendingResp] = await Promise.all([
            fetch(`${env.apiUrl}/teams/${teamId}/members`, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json', 
                'Authorization': token ? `Bearer ${token}` : '',
              },
            }),
            fetch(`${env.apiUrl}/teams/${teamId}/invitations`, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json', 
                'Authorization': token ? `Bearer ${token}` : '',
              },
            })
          ]);
          
          if (!activeResp.ok) {
            throw new Error(`Error fetching active members: ${activeResp.status}`);
          }
          
          // Get active members
          const activeData = await activeResp.json();
          let allMembers = activeData.members || [];
          
          // Try to get pending invitations if available
          if (pendingResp.ok) {
            const pendingData = await pendingResp.json();
            if (pendingData.invitations) {
              allMembers = [...allMembers, ...pendingData.invitations];
            }
          }
          
          setMembers(allMembers);
          return allMembers;
        }
        
        throw new Error(`Error fetching team members: ${response.status}`);
      }

      const data = await response.json();
      setMembers(data.members || []);
      return data.members;
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: 'Error loading team members',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      throw error;
    }
  }, [teamId, toast]);
  
  const fetchTeamAndMembers = useCallback(async () => {
    try {
      if (isRefreshing) {
        // Just refreshing data, don't show full loading spinner
        await Promise.all([fetchTeam(), fetchMembers()]);
      } else {
        setIsLoading(true);
        await Promise.all([fetchTeam(), fetchMembers()]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchTeam, fetchMembers, isRefreshing]);
  
  // Call fetchTeamAndMembers when component mounts or teamId changes
  useEffect(() => {
    if (teamId) {
      fetchTeamAndMembers();
    }
  }, [teamId, fetchTeamAndMembers]);
  
  // Memoized filtered lists to avoid recalculation on each render
  const activeMembers = useMemo(() => {
    return members.filter(member => member.invitation_status === 'active');
  }, [members]);
  
  const pendingInvitations = useMemo(() => {
    return members.filter(member => member.invitation_status === 'pending');
  }, [members]);
  
  const expiredInvitations = useMemo(() => {
    return members.filter(member => 
      member.invitation_status === 'expired' || 
      member.invitation_status === 'inactive'
    );
  }, [members]);
  
  // List of all email addresses (active, pending, expired) to prevent duplicates
  const allMemberEmails = useMemo(() => {
    return members
      .filter(member => member.email)
      .map(member => member.email?.toLowerCase() || '');
  }, [members]);
  
  // Handler for refreshing the data
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTeamAndMembers();
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
    if (formErrors[name as keyof InviteFormData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
    
    // If changing email, check for existing user on blur
    if (name === 'email' && value.trim() && value.includes('@')) {
      const errors = validateForm();
      if (errors.email) {
        setFormErrors(prev => ({ ...prev, email: errors.email }));
      }
    }
  };

  const validateForm = () => {
    const errors: Partial<InviteFormData> = {};
    
    if (!formData.email || !formData.email.trim()) {
      errors.email = 'Email is required';
      return errors; // Return early if no email to validate
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
      return errors; // Return early if invalid format
    }
    
    // Check if this email already exists in any state
    const normalizedEmail = formData.email.toLowerCase();
    if (allMemberEmails.includes(normalizedEmail)) {
      // Find the member to determine the exact error message
      const existingMember = members.find(
        m => m.email?.toLowerCase() === normalizedEmail
      );
      
      if (existingMember) {
        switch (existingMember.invitation_status) {
          case 'active':
            errors.email = 'This email is already an active member of the team';
            break;
          case 'pending':
            errors.email = 'This email already has a pending invitation';
            break;
          case 'expired':
            errors.email = 'This email has an expired invitation. Please resend the invitation instead.';
            break;
          case 'inactive':
            errors.email = 'This email was previously a member. Please reactivate or use a different email.';
            break;
          default:
            errors.email = 'This email already exists in the system';
        }
      } else {
        errors.email = 'This email is already associated with the team';
      }
    }
    
    // We don't validate role since it has a default value
    // and display_name and message are optional
    
    return errors;
  };
  
  // Handle resending an invitation
  const handleResendInvite = async () => {
    if (!selectedMemberId) return;
    
    try {
      setIsSubmitting(true);
      
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // In a real implementation, we would call a backend endpoint to resend the invitation
      // For now, let's simulate this by updating the invitation expiry date
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members/${selectedMemberId}/resend-invite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ 
          custom_message: resendData.custom_message 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to resend invitation: ${response.status}`);
      }
      
      await fetchMembers(); // Refresh the members list
      
      toast({
        title: 'Invitation resent',
        description: 'The invitation has been resent successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setResendData({ member_id: '', custom_message: '' });
      onResendModalClose();
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

  const handleInviteMember = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      
      // Special case: If there's an expired/inactive invitation, ask to reactivate
      const normalizedEmail = formData.email.toLowerCase();
      const existingMember = members.find(
        m => m.email?.toLowerCase() === normalizedEmail && 
             (m.invitation_status === 'expired' || m.invitation_status === 'inactive')
      );
      
      if (existingMember) {
        // Handle reactivation instead
        try {
          setIsSubmitting(true);
          await handleReactivateInvitation(existingMember.id);
          onInviteModalClose();
        } catch (error) {
          console.error('Error reactivating invitation:', error);
        } finally {
          setIsSubmitting(false);
        }
      }
      
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
        // Handle 409 Conflict (user already exists)
        if (response.status === 409) {
          const errorData = await response.json();
          
          // Check if error suggests this user already exists
          if (errorData.detail?.includes('already exists')) {
            setFormErrors({
              email: 'This email already exists in the database. Try logging out and back in to refresh the member data.'
            });
            return;
          }
          
          throw new Error(errorData.detail || 'User already exists with a different status');
        }
        
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to invite member: ${response.status}`);
      }

      // Get the response data and refresh the member list
      await response.json();
      
      // Refresh members list to ensure we have the latest data
      await fetchMembers();
      
      // Switch to the Pending Invitations tab
      setActiveTab(1);
      
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
      onInviteModalClose();
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

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
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
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update member role: ${response.status}`);
      }

      const updatedMember = await response.json();
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId ? updatedMember : member
        )
      );
      
      toast({
        title: 'Role updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating member role:', error);
      toast({
        title: 'Error updating role',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMemberId) return;
    
    try {
      // Get the session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members/${selectedMemberId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to remove member: ${response.status}`);
      }

      // Find the member we're removing to customize the message
      const memberToRemove = members.find(m => m.id === selectedMemberId);
      const isInvitation = memberToRemove?.invitation_status === 'pending' || 
                         memberToRemove?.invitation_status === 'expired';
      
      setMembers(prev => prev.filter(member => member.id !== selectedMemberId));
      
      toast({
        title: isInvitation ? 'Invitation canceled' : 'Member removed',
        description: isInvitation 
          ? `The invitation to ${memberToRemove?.email || 'user'} has been canceled.`
          : `${memberToRemove?.display_name || memberToRemove?.email || 'Member'} has been removed from the team.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reset selected member id
      setSelectedMemberId(null);
      onConfirmDeleteClose();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Function to open the delete confirmation dialog
  const confirmRemoveMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    onConfirmDeleteOpen();
  };
  
  // Function to open the resend invitation modal
  const openResendInviteModal = (memberId: string) => {
    setSelectedMemberId(memberId);
    setResendData({ 
      member_id: memberId,
      custom_message: '' 
    });
    onResendModalOpen();
  };
  
  // Function to handle resend form input changes
  const handleResendInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setResendData(prev => ({ ...prev, [name]: value }));
  };

  const renderRoleBadge = (role: string) => {
    let colorScheme = 'gray';
    
    switch (role) {
      case 'owner':
        colorScheme = 'purple';
        break;
      case 'admin':
        colorScheme = 'blue';
        break;
      case 'member':
        colorScheme = 'green';
        break;
      case 'viewer':
        colorScheme = 'teal';
        break;
    }
    
    return <Badge colorScheme={colorScheme}>{role}</Badge>;
  };

  const renderStatusBadge = (status: string) => {
    let colorScheme = 'gray';
    
    switch (status) {
      case 'active':
        colorScheme = 'green';
        break;
      case 'pending':
        colorScheme = 'yellow';
        break;
      case 'expired':
        colorScheme = 'red';
        break;
    }
    
    return <Badge colorScheme={colorScheme}>{status}</Badge>;
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

  // Active Members Table
  const renderActiveMembersTable = () => (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Member</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
            <Th width="80px">Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {activeMembers.length === 0 ? (
            <Tr>
              <Td colSpan={5} textAlign="center" py={4}>
                <Text>No active members found</Text>
              </Td>
            </Tr>
          ) : (
            activeMembers.map(member => (
              <Tr key={member.id}>
                <Td>
                  <HStack>
                    <Avatar 
                      size="sm" 
                      name={member.display_name || member.email || member.user_id} 
                    />
                    <Box>
                      <Text fontWeight="medium">{member.display_name || 'Unnamed User'}</Text>
                      <Text fontSize="sm" color="gray.500">{member.email}</Text>
                    </Box>
                  </HStack>
                </Td>
                <Td>{renderRoleBadge(member.role)}</Td>
                <Td>{renderStatusBadge(member.invitation_status)}</Td>
                <Td>
                  {new Date(member.created_at).toLocaleDateString()}
                </Td>
                <Td>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<FiMoreVertical />}
                      variant="ghost"
                      size="sm"
                      aria-label="More options"
                    />
                    <MenuList>
                      <MenuGroup title="Change Role:">
                        <MenuItem 
                          isDisabled={member.role === 'owner' || member.role === 'admin'}
                          onClick={() => handleUpdateMemberRole(member.id, 'admin')}
                        >
                          Set as Admin
                        </MenuItem>
                        <MenuItem 
                          isDisabled={member.role === 'owner' || member.role === 'member'}
                          onClick={() => handleUpdateMemberRole(member.id, 'member')}
                        >
                          Set as Member
                        </MenuItem>
                        <MenuItem 
                          isDisabled={member.role === 'owner' || member.role === 'viewer'}
                          onClick={() => handleUpdateMemberRole(member.id, 'viewer')}
                        >
                          Set as Viewer
                        </MenuItem>
                      </MenuGroup>
                      <MenuDivider />
                      <MenuItem 
                        onClick={() => confirmRemoveMember(member.id)}
                        isDisabled={member.role === 'owner'}
                        color="red.500"
                      >
                        Remove
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Box>
  );

  // Pending Invitations Table
  const renderPendingInvitationsTable = () => (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Invited Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Sent</Th>
            <Th>Expires</Th>
            <Th width="120px">Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pendingInvitations.length === 0 ? (
            <Tr>
              <Td colSpan={6} textAlign="center" py={4}>
                <Text>No pending invitations</Text>
              </Td>
            </Tr>
          ) : (
            pendingInvitations.map(member => (
              <Tr key={member.id}>
                <Td>
                  <Text fontWeight="medium">{member.email}</Text>
                </Td>
                <Td>{renderRoleBadge(member.role)}</Td>
                <Td>{renderStatusBadge(member.invitation_status)}</Td>
                <Td>
                  {new Date(member.created_at).toLocaleDateString()}
                </Td>
                <Td>
                  {member.invitation_expires_at ? 
                    new Date(member.invitation_expires_at).toLocaleDateString() : 
                    'N/A'}
                </Td>
                <Td>
                  <HStack spacing={1}>
                    <Tooltip label="Resend Invitation">
                      <IconButton
                        icon={<FiMail />}
                        size="sm"
                        aria-label="Resend invitation"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => openResendInviteModal(member.id)}
                      />
                    </Tooltip>
                    <Tooltip label="Cancel Invitation">
                      <IconButton
                        icon={<FiTrash2 />}
                        size="sm"
                        aria-label="Cancel invitation"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => confirmRemoveMember(member.id)}
                      />
                    </Tooltip>
                  </HStack>
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Box>
  );

  // Function to reactivate an inactive or expired invitation
  const handleReactivateInvitation = async (memberId: string) => {
    try {
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
          invitation_status: 'pending',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reactivate invitation: ${response.status}`);
      }

      // Refresh members list
      await fetchMembers();
      
      toast({
        title: 'Invitation reactivated',
        description: 'The invitation has been reactivated and will be resent',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error reactivating invitation:', error);
      toast({
        title: 'Error reactivating invitation',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Expired Invitations Table
  const renderExpiredInvitationsTable = () => (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Invited Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Sent</Th>
            <Th>Expired On</Th>
            <Th width="120px">Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {expiredInvitations.length === 0 ? (
            <Tr>
              <Td colSpan={6} textAlign="center" py={4}>
                <Text>No expired invitations</Text>
              </Td>
            </Tr>
          ) : (
            expiredInvitations.map(member => (
              <Tr key={member.id}>
                <Td>
                  <Text fontWeight="medium">{member.email}</Text>
                </Td>
                <Td>{renderRoleBadge(member.role)}</Td>
                <Td>{renderStatusBadge(member.invitation_status)}</Td>
                <Td>
                  {new Date(member.created_at).toLocaleDateString()}
                </Td>
                <Td>
                  {member.invitation_expires_at ? 
                    new Date(member.invitation_expires_at).toLocaleDateString() : 
                    'N/A'}
                </Td>
                <Td>
                  <HStack spacing={1}>
                    <Tooltip label="Reactivate Invitation">
                      <IconButton
                        icon={<FiRefreshCw />}
                        size="sm"
                        aria-label="Reactivate invitation"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => handleReactivateInvitation(member.id)}
                      />
                    </Tooltip>
                    <Tooltip label="Delete Invitation">
                      <IconButton
                        icon={<FiTrash2 />}
                        size="sm"
                        aria-label="Delete invitation"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => confirmRemoveMember(member.id)}
                      />
                    </Tooltip>
                  </HStack>
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Box>
  );

  return (
    <Container maxW="container.xl" py={6}>
      <Flex mb={6} alignItems="center" justifyContent="space-between">
        <HStack>
          <Button
            as={Link}
            to={`/dashboard/teams/${teamId}`}
            leftIcon={<FiArrowLeft />}
            variant="outline"
            mr={2}
          >
            Back
          </Button>
          <Heading size="lg">Team Members</Heading>
          <Badge colorScheme="purple" fontSize="md" ml={2}>
            {team.name}
          </Badge>
        </HStack>
        <HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            variant="ghost"
            onClick={handleRefresh}
            isLoading={isRefreshing}
          >
            Refresh
          </Button>
          <Button
            leftIcon={<FiUserPlus />}
            colorScheme="blue"
            onClick={onInviteModalOpen}
          >
            Invite Member
          </Button>
        </HStack>
      </Flex>

      <Tabs 
        isFitted 
        variant="enclosed" 
        colorScheme="blue" 
        index={activeTab} 
        onChange={setActiveTab}
        mb={6}
      >
        <TabList>
          <Tab>
            Active Members 
            <Badge ml={2} colorScheme="blue" borderRadius="full">
              {activeMembers.length}
            </Badge>
          </Tab>
          <Tab>
            Pending Invitations
            {pendingInvitations.length > 0 && (
              <Badge ml={2} colorScheme="yellow" borderRadius="full">
                {pendingInvitations.length}
              </Badge>
            )}
          </Tab>
          <Tab>
            Expired Invitations
            {expiredInvitations.length > 0 && (
              <Badge ml={2} colorScheme="red" borderRadius="full">
                {expiredInvitations.length}
              </Badge>
            )}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel p={0} pt={4}>
            {renderActiveMembersTable()}
          </TabPanel>
          <TabPanel p={0} pt={4}>
            {renderPendingInvitationsTable()}
          </TabPanel>
          <TabPanel p={0} pt={4}>
            {renderExpiredInvitationsTable()}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Invite Member Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={onInviteModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Invite Team Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isInvalid={!!formErrors.email} isRequired mb={4}>
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

            <FormControl mb={4}>
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

            <FormControl isInvalid={!!formErrors.role} isRequired mb={4}>
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
              <FormErrorMessage>{formErrors.role}</FormErrorMessage>
            </FormControl>

            <FormControl mb={2}>
              <FormLabel>Personal Message (Optional)</FormLabel>
              <Input
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Add a note to the invitation email"
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onInviteModalClose}>
              Cancel
            </Button>
            <Button
              leftIcon={<FiPlus />}
              colorScheme="blue"
              onClick={handleInviteMember}
              isLoading={isSubmitting}
            >
              Send Invitation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Resend Invitation Modal */}
      <Modal isOpen={isResendModalOpen} onClose={onResendModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Resend Invitation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              This will send a new invitation email to the recipient with a fresh invitation link.
            </Text>
            
            <FormControl mb={4}>
              <FormLabel>Personal Message (Optional)</FormLabel>
              <Input
                name="custom_message"
                value={resendData.custom_message}
                onChange={handleResendInputChange}
                placeholder="Add a note to the invitation email"
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onResendModalClose}>
              Cancel
            </Button>
            <Button
              leftIcon={<FiMail />}
              colorScheme="blue"
              onClick={handleResendInvite}
              isLoading={isSubmitting}
            >
              Resend Invitation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirmation Dialog for Removing Member/Invitation */}
      <AlertDialog
        isOpen={isConfirmDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onConfirmDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {members.find(m => m.id === selectedMemberId)?.invitation_status === 'pending' || 
               members.find(m => m.id === selectedMemberId)?.invitation_status === 'expired'
                ? 'Cancel Invitation'
                : 'Remove Member'}
            </AlertDialogHeader>

            <AlertDialogBody>
              {members.find(m => m.id === selectedMemberId)?.invitation_status === 'pending' || 
               members.find(m => m.id === selectedMemberId)?.invitation_status === 'expired'
                ? `Are you sure you want to cancel the invitation to ${members.find(m => m.id === selectedMemberId)?.email}?`
                : `Are you sure you want to remove ${members.find(m => m.id === selectedMemberId)?.display_name || members.find(m => m.id === selectedMemberId)?.email} from the team?`}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onConfirmDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleRemoveMember} ml={3}>
                {members.find(m => m.id === selectedMemberId)?.invitation_status === 'pending' || 
                 members.find(m => m.id === selectedMemberId)?.invitation_status === 'expired'
                  ? 'Cancel Invitation'
                  : 'Remove'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Container>
  );
};

export default TeamMembersPage;
