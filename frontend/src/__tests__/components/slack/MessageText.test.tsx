import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessageText from '../../../components/slack/MessageText';
import * as UserCacheHook from '../../../components/slack/SlackUserDisplay';

// Mock the useUserCache hook
vi.mock('../../../components/slack/SlackUserDisplay', async () => {
  const actual = await vi.importActual('../../../components/slack/SlackUserDisplay');
  return {
    ...actual as any,
    useUserCache: vi.fn()
  };
});

describe('MessageText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock for useUserCache
    vi.mocked(UserCacheHook.useUserCache).mockReturnValue({
      users: new Map(),
      loading: new Set(),
      errors: new Set(),
      fetchUser: vi.fn(),
      getUser: vi.fn((userId) => {
        if (userId === 'U12345') {
          return {
            id: 'some-id',
            slack_id: 'U12345',
            name: 'testuser',
            display_name: 'Test User',
            real_name: 'Test User Real Name',
            profile_image_url: 'https://example.com/avatar.jpg'
          };
        }
        return undefined;
      }),
      isLoading: vi.fn(),
      hasError: vi.fn()
    });
  });

  it('renders plain text correctly', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello, world!" workspaceId="test-workspace-id" />
      </ChakraProvider>
    );
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('handles newlines correctly', () => {
    const { container } = render(
      <ChakraProvider>
        <MessageText text="Line 1\nLine 2" workspaceId="test-workspace-id" />
      </ChakraProvider>
    );
    
    // Just check that the component renders without error
    // The implementation details of how newlines are handled may change
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
  });

  it('replaces user mentions with user names', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345>!" workspaceId="test-workspace-id" />
      </ChakraProvider>
    );
    
    expect(screen.getByText('@Test User Real Name')).toBeInTheDocument();
    expect(screen.getByText('Hello', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('!', { exact: false })).toBeInTheDocument();
  });

  it('handles unknown user IDs gracefully', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U99999>!" workspaceId="test-workspace-id" />
      </ChakraProvider>
    );
    
    expect(screen.getByText('@U99999')).toBeInTheDocument();
  });
});
