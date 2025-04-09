import React from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import useAuth from '../context/useAuth';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const toast = useToast();

  const handleSignOut = async () => {
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
  };

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading as="h1" size="xl">Dashboard</Heading>
        <HStack spacing={4}>
          <Text>Hello, {user?.email}</Text>
          <Button onClick={handleSignOut} colorScheme="blue" variant="outline">
            Sign Out
          </Button>
        </HStack>
      </Flex>

      <Tabs colorScheme="blue" mb={6}>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>GitHub</Tab>
          <Tab>Slack</Tab>
          <Tab>Notion</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                Welcome to your Contribution Dashboard
              </Heading>
              <Text>
                This dashboard shows your contributions across platforms. Connect your accounts
                to start tracking your activity.
              </Text>
            </Box>
          </TabPanel>
          
          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                GitHub Contributions
              </Heading>
              <Text>
                Connect your GitHub account to track issues, pull requests, and code contributions.
              </Text>
              <Button mt={4} colorScheme="blue">
                Connect GitHub
              </Button>
            </Box>
          </TabPanel>
          
          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                Slack Contributions
              </Heading>
              <Text mb={4}>
                Connect your Slack workspace to track messages, reactions, and engagement.
              </Text>
              <HStack spacing={4}>
                <Button 
                  as={Link} 
                  to="/dashboard/slack/connect" 
                  colorScheme="purple"
                >
                  Connect Workspace
                </Button>
                <Button
                  as={Link}
                  to="/dashboard/slack/workspaces"
                  variant="outline"
                  colorScheme="purple"
                >
                  Manage Workspaces
                </Button>
              </HStack>
            </Box>
          </TabPanel>
          
          <TabPanel>
            <Box p={4} borderWidth="1px" borderRadius="lg">
              <Heading as="h2" size="md" mb={4}>
                Notion Contributions
              </Heading>
              <Text>
                Connect Notion to track document edits, comments, and knowledge sharing.
              </Text>
              <Button mt={4} colorScheme="blue">
                Connect Notion
              </Button>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Dashboard;