import React, { useCallback } from 'react';
import {
  Flex,
  HStack,
  IconButton,
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
  Button,
} from '@chakra-ui/react';
import { FiMenu, FiChevronDown, FiBell, FiSearch, FiLogOut, FiUser, FiSettings } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { TeamSwitcher } from '../team';
import useAuth from '../../context/useAuth';

interface HeaderProps {
  onOpenSidebar: () => void;
}

/**
 * Application header component with mobile menu toggle, team context, and user menu
 */
const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { user, signOut } = useAuth();
  const toast = useToast();
  
  // Header color based on light/dark mode
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
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
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [signOut, toast]);
  
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      w="full"
      px={4}
      h={16}
      bg={bgColor}
      borderBottomWidth="1px"
      borderColor={borderColor}
      boxShadow="sm"
    >
      {/* Left side - Mobile menu button and team switcher */}
      <HStack spacing={4}>
        <IconButton
          aria-label="Open Sidebar"
          display={{ base: 'flex', md: 'none' }}
          onClick={onOpenSidebar}
          icon={<FiMenu />}
          size="md"
          variant="ghost"
        />
        <TeamSwitcher variant="compact" />
      </HStack>
      
      {/* Right side - Search, notifications, and user menu */}
      <HStack spacing={3}>
        <IconButton
          aria-label="Search"
          icon={<FiSearch />}
          size="md"
          variant="ghost"
        />
        <IconButton
          aria-label="Notifications"
          icon={<FiBell />}
          size="md"
          variant="ghost"
        />
        
        {/* User profile menu */}
        <Menu>
          <MenuButton
            as={Button}
            variant="ghost"
            rightIcon={<FiChevronDown />}
            px={2}
          >
            <HStack>
              <Avatar
                size="sm"
                name={user?.email || 'User'}
                src={user?.user_metadata?.avatar_url}
              />
              <Box display={{ base: 'none', md: 'block' }}>
                <Text fontWeight="medium">{user?.email}</Text>
              </Box>
            </HStack>
          </MenuButton>
          <MenuList>
            <MenuItem 
              as={Link} 
              to="/dashboard/profile" 
              icon={<FiUser />}
            >
              Profile
            </MenuItem>
            <MenuItem 
              as={Link} 
              to="/dashboard/profile/edit"
              icon={<FiSettings />}
            >
              Edit Profile
            </MenuItem>
            <MenuDivider />
            <MenuItem icon={<FiLogOut />} onClick={handleSignOut}>
              Sign Out
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
};

export default React.memo(Header);
