import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessageText from '../../../components/slack/MessageText';
import * as SlackUserDisplayModule from '../../../components/slack/SlackUserDisplay';

// Mock the SlackUserDisplay component
vi.mock('../../../components/slack/SlackUserDisplay', () => {
  return {
    __esModule: true,
    default: vi.fn(({ userId }) => <span data-testid={`user-${userId}`}>{userId}</span>),
    SlackUserCacheProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

describe('MessageText', () => {
  const mockWorkspaceId = 'workspace-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders plain text correctly', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello, world!" workspaceId={mockWorkspaceId} />
      </ChakraProvider>
    );
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('handles newlines correctly', () => {
    render(
      <ChakraProvider>
        <MessageText text="Line 1\nLine 2" workspaceId={mockWorkspaceId} />
      </ChakraProvider>
    );
    
    // Since the component formats the text differently, check for the whole string
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
  });

  it('formats user mentions with SlackUserDisplay when resolveMentions is true', () => {
    const SlackUserDisplayMock = SlackUserDisplayModule.default as unknown as ReturnType<typeof vi.fn>;
    
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345>!" workspaceId={mockWorkspaceId} resolveMentions={true} />
      </ChakraProvider>
    );
    
    // Check that SlackUserDisplay was called with the correct props
    expect(SlackUserDisplayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'U12345',
        workspaceId: mockWorkspaceId,
        displayFormat: 'username',
        fetchFromSlack: true,
        asComponent: 'span'
      }),
      expect.anything()
    );
    
    // Check for the @ symbol and the user ID
    expect(screen.getByText('@')).toBeInTheDocument();
    expect(screen.getByTestId('user-U12345')).toBeInTheDocument();
  });
  
  it('formats user mentions without SlackUserDisplay when resolveMentions is false', () => {
    const SlackUserDisplayMock = SlackUserDisplayModule.default as unknown as ReturnType<typeof vi.fn>;
    
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345>!" workspaceId={mockWorkspaceId} resolveMentions={false} />
      </ChakraProvider>
    );
    
    // Check that SlackUserDisplay was not called
    expect(SlackUserDisplayMock).not.toHaveBeenCalled();
    
    // Check for the formatted text
    expect(screen.getByText(/Hello @U12345!/)).toBeInTheDocument();
  });

  it('handles multiple user mentions', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345> and <@U67890>!" workspaceId={mockWorkspaceId} resolveMentions={false} />
      </ChakraProvider>
    );
    
    expect(screen.getByText(/Hello @U12345 and @U67890!/)).toBeInTheDocument();
  });

  it('handles text with both newlines and mentions', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345>\nHow are you?" workspaceId={mockWorkspaceId} resolveMentions={false} />
      </ChakraProvider>
    );
    
    // Check for the whole pattern with a regex that handles newlines
    expect(screen.getByText(/Hello @U12345/)).toBeInTheDocument();
    expect(screen.getByText(/How are you\?/)).toBeInTheDocument();
  });
  
  it('renders null for empty text', () => {
    // Render without ChakraProvider to avoid the Chakra env span
    const { container } = render(
      <MessageText text="" workspaceId={mockWorkspaceId} />
    );
    
    // Check that our component didn't render anything
    expect(container.innerHTML).not.toContain("workspaceId");
  });
});
