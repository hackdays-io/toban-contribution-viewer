// No need to import React when using JSX without explicit React APIs
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import SlackUserDisplay, { SlackUserCacheProvider } from '../../../components/slack/SlackUserDisplay';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn((url) => {
  // Check if fetch_from_slack parameter is present
  const fetchFromSlack = url.toString().includes('fetch_from_slack=true');
  
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      users: [
        {
          id: 'test-user-id',
          slack_id: 'U12345678',
          name: fetchFromSlack ? 'slackuser' : 'testuser',
          display_name: fetchFromSlack ? 'Slack User' : 'Test User',
          real_name: fetchFromSlack ? 'Slack User Real Name' : 'Test User Real Name',
          profile_image_url: 'https://example.com/avatar.jpg'
        }
      ]
    })
  });
}) as unknown as typeof global.fetch;

describe('SlackUserDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    render(
      <ChakraProvider>
        <SlackUserDisplay userId="test-user-id" workspaceId="test-workspace-id" />
      </ChakraProvider>
    );
    
    // Check that loading state is shown
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render user name when data is available', () => {
    // Create a test user directly
    const testUser = {
      id: 'test-user-id',
      slack_id: 'U12345678',
      name: 'testuser',
      display_name: 'Test User',
      real_name: 'Test User Real Name',
      profile_image_url: 'https://example.com/avatar.jpg'
    };
    
    render(
      <ChakraProvider>
        <SlackUserDisplay 
          userId="test-user-id" 
          workspaceId="test-workspace-id"
          _skipLoading={true}
          _testUser={testUser}
        />
      </ChakraProvider>
    );
    
    // Check that user name is displayed
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('should render with avatar when specified', () => {
    // Create a test user directly
    const testUser = {
      id: 'test-user-id',
      slack_id: 'U12345678',
      name: 'testuser',
      display_name: 'Test User',
      real_name: 'Test User Real Name',
      profile_image_url: 'https://example.com/avatar.jpg'
    };
    
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
    );
    
    // Check that the avatar is in the document
    const avatar = document.querySelector('.chakra-avatar');
    expect(avatar).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

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
    );
    
    // Check for the fallback text
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });
  
  it('should display different formats correctly', () => {
    // Create a test user directly
    const testUser = {
      id: 'test-user-id',
      slack_id: 'U12345678',
      name: 'testuser',
      display_name: 'Test User',
      real_name: 'Test User Real Name',
      profile_image_url: 'https://example.com/avatar.jpg'
    };
    
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
    );
    
    // Check all format variants
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Test User Real Name')).toBeInTheDocument();
    expect(screen.getByText('Test User Real Name (testuser)')).toBeInTheDocument();
  });

  it('should include fetch_from_slack parameter when fetchFromSlack is true', async () => {
    render(
      <ChakraProvider>
        <SlackUserDisplay 
          userId="test-user-id" 
          workspaceId="test-workspace-id"
          fetchFromSlack={true}
        />
      </ChakraProvider>
    );
    
    // Check that fetch was called with the right URL
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('fetch_from_slack=true'),
      expect.any(Object)
    );
    
    // Wait for the component to update
    await waitFor(() => {
      expect(screen.getByText('slackuser')).toBeInTheDocument();
    });
  });

  it('should pass fetchFromSlack parameter to API when specified', async () => {
    render(
      <ChakraProvider>
        <SlackUserCacheProvider workspaceId="test-workspace-id">
          <SlackUserDisplay 
            userId="test-user-id" 
            workspaceId="test-workspace-id"
            fetchFromSlack={true}
          />
        </SlackUserCacheProvider>
      </ChakraProvider>
    );
    
    // Initially it should show loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    // Wait for the fetch to complete
    await waitFor(() => {
      // Verify it was called with the fetchFromSlack parameter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('fetch_from_slack=true'),
        expect.any(Object)
      );
    });
  });
});
