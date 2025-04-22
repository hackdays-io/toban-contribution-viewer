import React, { useCallback } from 'react';
import {
  Flex,
  HStack,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Text,
  Box,
  useColorModeValue,
  useToast,
  InputGroup,
  Input,
  InputLeftElement,
  Container,
  Icon,
} from '@chakra-ui/react';
import {
  FiSearch,
  FiLogOut,
  FiUser,
  FiSettings,
  FiChevronDown,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import useAuth from '../../context/useAuth';

/**
 * Application header component with search and user profile menu
 */
const Header = () => {
  const { user, signOut } = useAuth();
  const toast = useToast();

  // Header color based on light/dark mode
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const searchBg = useColorModeValue('gray.100', 'gray.700');

  // Memoize event handler to prevent recreation on each render
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast({
        title: 'Signed out successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error signing out',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [signOut, toast]);

  return (
    <Box
      as="header"
      bg={bgColor}
      borderBottomWidth="1px"
      borderColor={borderColor}
      w="full"
      py={2}
    >
      <Container maxW="container.xl">
        <Flex align="center" justify="space-between">
          {/* Left side with global search */}
          <Box flex={1} maxW="600px">
            <InputGroup size="md">
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input 
                placeholder="Search across workspaces and teams..." 
                bg={searchBg}
                borderRadius="md"
                _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                _focus={{ bg: useColorModeValue('white', 'gray.800') }}
              />
            </InputGroup>
          </Box>

          {/* Right side with user profile menu */}
          <HStack spacing={3}>
            {/* User profile menu */}
            <Menu>
              <MenuButton
                borderRadius="full"
                transition="all 0.2s"
                _hover={{ boxShadow: 'md' }}
              >
                <HStack spacing={2}>
                  <Avatar
                    size="sm"
                    name={user?.email || 'User'}
                    src={user?.user_metadata?.avatar_url}
                    bg="green.500"
                  />
                  <Box display={{ base: 'none', md: 'block' }}>
                    <Text fontWeight="medium" fontSize="sm">
                      {user?.email || 'hal@code4japan.org'}
                    </Text>
                  </Box>
                  <Icon as={FiChevronDown} display={{ base: 'none', md: 'block' }} />
                </HStack>
              </MenuButton>
              <MenuList zIndex={10}>
                <MenuItem as={Link} to="/dashboard/profile" icon={<FiUser />}>
                  Profile
                </MenuItem>
                <MenuItem
                  as={Link}
                  to="/dashboard/profile/edit"
                  icon={<FiSettings />}
                >
                  Settings
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={<FiLogOut />} onClick={handleSignOut}>
                  Sign Out
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default React.memo(Header);