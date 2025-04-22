import React, { ReactNode } from 'react';
import {
  Box,
  useColorModeValue,
  Container,
} from '@chakra-ui/react';
import TopNavigation from './TopNavigation';
import Header from './Header';
import Breadcrumb from './Breadcrumb';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Main application layout with responsive top navigation, header, and content area
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  // Background colors for light/dark mode
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const contentBgColor = useColorModeValue('white', 'gray.800');

  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Top navigation */}
      <TopNavigation />
      
      {/* User profile and actions header */}
      <Header />
      
      {/* Main content container - use full width container */}
      <Container maxW="container.xl" pt={4} pb={8}>
        {/* Breadcrumb navigation */}
        <Breadcrumb />
        
        {/* Main content area */}
        <Box
          as="main"
          p={{ base: 4, md: 6 }}
          bg={contentBgColor}
          borderRadius="lg"
          boxShadow="sm"
          mt={2}
          minH="calc(100vh - 16rem)"
        >
          {children}
        </Box>
      </Container>
    </Box>
  );
};

export default React.memo(AppLayout);