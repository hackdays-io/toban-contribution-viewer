// No need to import React when using JSX without explicit React APIs
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import SlackUserDisplay from '../../../components/slack/SlackUserDisplay'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock SlackApiClient
vi.mock('../../../lib/slackApiClient', () => {
  const mockClient = {
    getUsersByIds: vi
      .fn()
      .mockImplementation((_workspaceId, _userIds, fetchFromSlack) => {
        return Promise.resolve({
          users: [
            {
              id: 'test-user-id',
              slack_id: 'U12345678',
              name: fetchFromSlack ? 'slackuser' : 'testuser',
              display_name: fetchFromSlack ? 'Slack User' : 'Test User',
              real_name: fetchFromSlack
                ? 'Slack User Real Name'
                : 'Test User Real Name',
              profile_image_url: 'https://example.com/avatar.jpg',
            },
          ],
        })
      }),
  }

  return {
    slackApiClient: mockClient,
    default: mockClient,
  }
})

describe('SlackUserDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state', async () => {
    const { findByText } = render(
      <ChakraProvider>
        <SlackUserDisplay
          userId="test-user-id"
          workspaceId="test-workspace-id"
        />
      </ChakraProvider>
    )

    // Use findByText to wait for the loading state to appear
    const loadingElement = await findByText('Loading...')
    expect(loadingElement).toBeInTheDocument()
  })

  it('should render user name when data is available', () => {
    // Create a test user directly
    const testUser = {
      id: 'test-user-id',
      slack_id: 'U12345678',
      name: 'testuser',
      display_name: 'Test User',
      real_name: 'Test User Real Name',
      profile_image_url: 'https://example.com/avatar.jpg',
    }

    render(
      <ChakraProvider>
        <SlackUserDisplay
          userId="test-user-id"
          workspaceId="test-workspace-id"
          _skipLoading={true}
          _testUser={testUser}
        />
      </ChakraProvider>
    )

    // Check that user name is displayed
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('should render with avatar when specified', () => {
    // Create a test user directly
    const testUser = {
      id: 'test-user-id',
      slack_id: 'U12345678',
      name: 'testuser',
      display_name: 'Test User',
      real_name: 'Test User Real Name',
      profile_image_url: 'https://example.com/avatar.jpg',
    }

    render(
      <ChakraProvider>
        <SlackUserDisplay
          userId="test-user-id"
          workspaceId="test-workspace-id"
          showAvatar={true}
          _skipLoading={true}
          _testUser={testUser}
        />
      </ChakraProvider>
    )

    // Check that the avatar is in the document
    const avatar = document.querySelector('.chakra-avatar')
    expect(avatar).toBeInTheDocument()
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('should display fallback text for unknown users', () => {
    render(
      <ChakraProvider>
        <SlackUserDisplay
          userId="nonexistent-user"
          workspaceId="test-workspace-id"
          fallback="Custom Fallback"
          _skipLoading={true}
          _hasError={true}
        />
      </ChakraProvider>
    )

    // Check for the fallback text
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument()
  })

  it('should display different formats correctly', () => {
    // Create a test user directly
    const testUser = {
      id: 'test-user-id',
      slack_id: 'U12345678',
      name: 'testuser',
      display_name: 'Test User',
      real_name: 'Test User Real Name',
      profile_image_url: 'https://example.com/avatar.jpg',
    }

    render(
      <ChakraProvider>
        <div data-testid="username-format">
          <SlackUserDisplay
            userId="test-user-id"
            displayFormat="username"
            _skipLoading={true}
            _testUser={testUser}
          />
        </div>
        <div data-testid="realname-format">
          <SlackUserDisplay
            userId="test-user-id"
            displayFormat="real_name"
            _skipLoading={true}
            _testUser={testUser}
          />
        </div>
        <div data-testid="both-format">
          <SlackUserDisplay
            userId="test-user-id"
            displayFormat="both"
            _skipLoading={true}
            _testUser={testUser}
          />
        </div>
      </ChakraProvider>
    )

    // Check all format variants
    expect(screen.getByText('testuser')).toBeInTheDocument()
    expect(screen.getByText('Test User Real Name')).toBeInTheDocument()
    expect(
      screen.getByText('Test User Real Name (testuser)')
    ).toBeInTheDocument()
  })

  it('should include fetch_from_slack parameter when fetchFromSlack is true', async () => {
    // Get the mocked slackApiClient
    const { slackApiClient } = await import('../../../lib/slackApiClient')

    const { findByText } = render(
      <ChakraProvider>
        <SlackUserDisplay
          userId="test-user-id"
          workspaceId="test-workspace-id"
          fetchFromSlack={true}
        />
      </ChakraProvider>
    )

    // Wait for the component to render
    const loadingElement = await findByText('Loading...')
    expect(loadingElement).toBeInTheDocument()

    // Check that slackApiClient.getUsersByIds was called with the right parameters
    expect(slackApiClient.getUsersByIds).toHaveBeenCalledWith(
      'test-workspace-id',
      ['test-user-id'],
      true // fetchFromSlack=true
    )
  })
})
