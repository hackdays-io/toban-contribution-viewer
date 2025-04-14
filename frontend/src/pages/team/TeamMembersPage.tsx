import React, { useEffect, useState, useCallback } from 'react';
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
} from '@chakra-ui/react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiChevronDown, FiMoreVertical, FiPlus, FiUserPlus } from 'react-icons/fi';

import env from '../../config/env';

interface TeamMember {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invitation_status: string;
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
}

interface InviteFormData {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

const TeamMembersPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: 'member',
  });
  const [formErrors, setFormErrors] = useState<Partial<InviteFormData>>({});

  useEffect(() => {
    if (teamId) {
      fetchTeamAndMembers();
    }
  }, [teamId, fetchTeamAndMembers]);

  const fetchTeam = useCallback(async () => {
    try {
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
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
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
      setIsLoading(true);
      await Promise.all([fetchTeam(), fetchMembers()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTeam, fetchMembers]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
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
    
    if (!formData.role) {
      errors.role = 'Role is required';
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
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to invite member: ${response.status}`);
      }

      const newMember = await response.json();
      setMembers(prev => [...prev, newMember]);
      
      toast({
        title: 'Invitation sent successfully',
        description: `Invitation sent to ${formData.email}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setFormData({ email: '', role: 'member' });
      onClose();
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
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members/${memberId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
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

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    try {
      const response = await fetch(`${env.apiUrl}/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to remove member: ${response.status}`);
      }

      setMembers(prev => prev.filter(member => member.id !== memberId));
      
      toast({
        title: 'Member removed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error removing member',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
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
        </HStack>
        <Button
          leftIcon={<FiUserPlus />}
          colorScheme="blue"
          onClick={onOpen}
        >
          Invite Member
        </Button>
      </Flex>

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
            {members.length === 0 ? (
              <Tr>
                <Td colSpan={5} textAlign="center" py={4}>
                  <Text>No members found</Text>
                </Td>
              </Tr>
            ) : (
              members.map(member => (
                <Tr key={member.id}>
                  <Td>
                    <HStack>
                      <Avatar size="sm" name={member.display_name || member.email || member.user_id} />
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
                        <MenuItem isDisabled={member.role === 'owner'}>
                          <Menu>
                            <MenuButton width="100%" textAlign="left">
                              Change Role <FiChevronDown style={{ display: 'inline', marginLeft: '5px' }} />
                            </MenuButton>
                            <MenuList>
                              <MenuItem 
                                isDisabled={member.role === 'admin'}
                                onClick={() => handleUpdateMemberRole(member.id, 'admin')}
                              >
                                Admin
                              </MenuItem>
                              <MenuItem 
                                isDisabled={member.role === 'member'}
                                onClick={() => handleUpdateMemberRole(member.id, 'member')}
                              >
                                Member
                              </MenuItem>
                              <MenuItem 
                                isDisabled={member.role === 'viewer'}
                                onClick={() => handleUpdateMemberRole(member.id, 'viewer')}
                              >
                                Viewer
                              </MenuItem>
                            </MenuList>
                          </Menu>
                        </MenuItem>
                        <MenuItem 
                          onClick={() => handleRemoveMember(member.id)}
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

      {/* Invite Member Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
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

            <FormControl isInvalid={!!formErrors.role} isRequired>
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
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
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
    </Container>
  );
};

export default TeamMembersPage;
