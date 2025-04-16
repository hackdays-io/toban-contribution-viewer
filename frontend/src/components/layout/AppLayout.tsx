import React, { ReactNode } from 'react'
import {
  Box,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  useDisclosure,
  useColorModeValue,
} from '@chakra-ui/react'
import Sidebar from './Sidebar'
import Header from './Header'

interface AppLayoutProps {
  children: ReactNode
}

/**
 * Main application layout with responsive sidebar and header
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  // Background colors for light/dark mode - memoized to prevent recalculations
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const contentBgColor = useColorModeValue('white', 'gray.800')

  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Sidebar for desktop view */}
      <Sidebar
        display={{ base: 'none', md: 'block' }}
        w={{ base: 'full', md: 64 }}
      />

      {/* Mobile drawer for sidebar */}
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerOverlay />
        <DrawerContent>
          <Sidebar onClose={onClose} />
        </DrawerContent>
      </Drawer>

      {/* Main content area */}
      <Box ml={{ base: 0, md: 64 }} transition="margin-left 0.3s">
        <Header onOpenSidebar={onOpen} />
        <Box
          as="main"
          p={4}
          minH="calc(100vh - 4rem)"
          bg={contentBgColor}
          borderRadius={{ md: 'md' }}
          mx={{ md: 4 }}
          my={{ md: 4 }}
          boxShadow={{ md: 'sm' }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}

export default React.memo(AppLayout)
