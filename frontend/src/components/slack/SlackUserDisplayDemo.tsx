import React from 'react'
import {
  Box,
  Heading,
  VStack,
  Divider,
  Text,
  Code,
  Card,
  CardBody,
  CardHeader,
  Grid,
  GridItem,
} from '@chakra-ui/react'
import SlackUserDisplay from './SlackUserDisplay'
import { SlackUserCacheProvider } from './SlackUserContext'

/**
 * Demo component to showcase different ways of using SlackUserDisplay.
 *
 * This component demonstrates various configurations of the SlackUserDisplay
 * component, including different display formats, avatar sizes, and other props.
 */
const SlackUserDisplayDemo: React.FC = () => {
  const demoUserId = '12345678-abcd-1234-efgh-123456789012' // Replace with real user ID for testing
  const demoWorkspaceId = '87654321-wxyz-9876-ijkl-987654321098' // Replace with real workspace ID for testing

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <Heading as="h1" size="xl" mb={6}>
        SlackUserDisplay Component Demo
      </Heading>

      <Text mb={6}>
        This demo showcases the SlackUserDisplay component in different
        configurations. You'll need to replace the placeholder user and
        workspace IDs with real ones to see actual data.
      </Text>

      <SlackUserCacheProvider workspaceUuid={demoWorkspaceId}>
        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Basic Usage</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="start" spacing={4}>
              <Box>
                <Text fontWeight="bold" mb={2}>
                  Default (username only)
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                />
                <Code display="block" my={2}>
                  {`<SlackUserDisplay userId="{demoUserId}" workspaceId="{demoWorkspaceId}" />`}
                </Code>
              </Box>

              <Divider />

              <Box>
                <Text fontWeight="bold" mb={2}>
                  With Avatar
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                />
                <Code display="block" my={2}>
                  {`<SlackUserDisplay userId="{demoUserId}" workspaceId="{demoWorkspaceId}" showAvatar={true} />`}
                </Code>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Display Formats</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(3, 1fr)" gap={6}>
              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Username
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  displayFormat="username"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`displayFormat="username"`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Real Name
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  displayFormat="real_name"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`displayFormat="real_name"`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Both
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  displayFormat="both"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`displayFormat="both"`}
                </Code>
              </GridItem>
            </Grid>
          </CardBody>
        </Card>

        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Avatar Sizes</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(4, 1fr)" gap={6}>
              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Extra Small
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  avatarSize="xs"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`avatarSize="xs"`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Small
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  avatarSize="sm"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`avatarSize="sm"`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Medium
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  avatarSize="md"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`avatarSize="md"`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  Large
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  avatarSize="lg"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`avatarSize="lg"`}
                </Code>
              </GridItem>
            </Grid>
          </CardBody>
        </Card>

        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Special Options</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(3, 1fr)" gap={6}>
              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  As Link
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  isLink={true}
                />
                <Code display="block" my={2} fontSize="xs">
                  {`isLink={true}`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  With Fallback
                </Text>
                <SlackUserDisplay
                  userId="non-existent-id"
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  fallback="Custom Fallback Text"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`fallback="Custom Fallback Text"`}
                </Code>
              </GridItem>

              <GridItem>
                <Text fontWeight="bold" mb={2}>
                  As Different Component
                </Text>
                <SlackUserDisplay
                  userId={demoUserId}
                  workspaceId={demoWorkspaceId}
                  showAvatar={true}
                  asComponent="div"
                />
                <Code display="block" my={2} fontSize="xs">
                  {`asComponent="div"`}
                </Code>
              </GridItem>
            </Grid>
          </CardBody>
        </Card>
      </SlackUserCacheProvider>
    </Box>
  )
}

export default SlackUserDisplayDemo
