import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MessageList from '../../../components/slack/MessageList';
import { ChakraProvider } from '@chakra-ui/react';

// Mock the fetch API
global.fetch = vi.fn();

// Mock environment variables
vi.mock('../../../config/env', () => ({
  env: {
    VITE_API_URL: 'http://test-api',
  },
}));

// Create mock data
const mockUsers = [
  {
    id: 'user1',
    slack_id: 'U001',
    name: 'username1',
    display_name: 'User 1 Display',
    real_name: 'User 1 Real',
    profile_image_url: 'https://example.com/avatar1.jpg',
  },
  {
    id: 'user2',
    slack_id: 'U002',
    name: 'username2',
    display_name: null,
    real_name: 'User 2 Real',
    profile_image_url: null,
  },
  {
    id: 'user3',
    slack_id: 'U003',
    name: 'username3',
    display_name: null,
    real_name: null,
    profile_image_url: null,
  },
];

const mockMessages = [
  {
    id: 'msg1',
    slack_id: 'M001',
    slack_ts: '1234567890.123456',
    text: 'Hello world',
    message_type: 'message',
    subtype: null,
    is_edited: false,
    edited_ts: null,
    has_attachments: false,
    thread_ts: null,
    is_thread_parent: false,
    is_thread_reply: false,
    reply_count: 0,
    reply_users_count: 0,
    reaction_count: 0,
    message_datetime: '2023-01-01T12:00:00Z',
    channel_id: 'channel1',
    user_id: 'user1',
    parent_id: null,
  },
  {
    id: 'msg2',
    slack_id: 'M002',
    slack_ts: '1234567891.123456',
    text: 'Second message',
    message_type: 'message',
    subtype: null,
    is_edited: false,
    edited_ts: null,
    has_attachments: false,
    thread_ts: null,
    is_thread_parent: false,
    is_thread_reply: false,
    reply_count: 0,
    reply_users_count: 0,
    reaction_count: 0,
    message_datetime: '2023-01-01T12:01:00Z',
    channel_id: 'channel1',
    user_id: 'user2',
    parent_id: null,
  },
  {
    id: 'msg3',
    slack_id: 'M003',
    slack_ts: '1234567892.123456',
    text: 'Third message',
    message_type: 'message',
    subtype: null,
    is_edited: false,
    edited_ts: null,
    has_attachments: false,
    thread_ts: null,
    is_thread_parent: false,
    is_thread_reply: false,
    reply_count: 0,
    reply_users_count: 0,
    reaction_count: 0,
    message_datetime: '2023-01-01T12:02:00Z',
    channel_id: 'channel1',
    user_id: 'user3',
    parent_id: null,
  },
];

// Mock API responses
function mockFetchResponses() {
  const mockFetch = fetch as vi.Mock;
  
  // First response: messages
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        messages: mockMessages,
        pagination: {
          has_more: false,
          next_cursor: null,
          page_size: 100,
          total_messages: mockMessages.length,
        },
      }),
    })
  );
  
  // Second response: users
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        users: mockUsers,
      }),
    })
  );
}

describe('MessageList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponses();
  });

  it('renders messages with correct user names', async () => {
    render(
      <ChakraProvider>
        <MessageList 
          workspaceId="workspace1" 
          channelId="channel1" 
          channelName="general" 
        />
      </ChakraProvider>
    );

    // Wait for the component to load data
    await waitFor(() => {
      // Verify the first message is displayed with the correct user name
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      
      // Verify user names are displayed correctly
      expect(screen.getByText('User 1 Display')).toBeInTheDocument();
      expect(screen.getByText('User 2 Real')).toBeInTheDocument();
      expect(screen.getByText('username3')).toBeInTheDocument();
    });
  });

  it('properly merges user data across API calls', async () => {
    // Mock first fetch as normal
    mockFetchResponses();
    
    // Render component
    const { rerender } = render(
      <ChakraProvider>
        <MessageList 
          workspaceId="workspace1" 
          channelId="channel1" 
          channelName="general" 
        />
      </ChakraProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
    
    // Mock a new message with a new user
    const newMessage = {
      id: 'msg4',
      slack_id: 'M004',
      slack_ts: '1234567893.123456',
      text: 'Fourth message',
      message_type: 'message',
      subtype: null,
      is_edited: false,
      edited_ts: null,
      has_attachments: false,
      thread_ts: null,
      is_thread_parent: false,
      is_thread_reply: false,
      reply_count: 0,
      reply_users_count: 0,
      reaction_count: 0,
      message_datetime: '2023-01-01T12:03:00Z',
      channel_id: 'channel1',
      user_id: 'user4',
      parent_id: null,
    };
    
    const newUser = {
      id: 'user4',
      slack_id: 'U004',
      name: 'username4',
      display_name: 'User 4 Display',
      real_name: null,
      profile_image_url: null,
    };
    
    // Mock new fetch responses for loading more messages
    (fetch as vi.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          messages: [...mockMessages, newMessage],
          pagination: {
            has_more: false,
            next_cursor: null,
            page_size: 100,
            total_messages: mockMessages.length + 1,
          },
        }),
      })
    );
    
    // Mock user response that includes the new user
    (fetch as vi.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          users: [newUser],
        }),
      })
    );
    
    // Rerender to simulate a refresh or filter change
    rerender(
      <ChakraProvider>
        <MessageList 
          workspaceId="workspace1" 
          channelId="channel1" 
          channelName="general" 
        />
      </ChakraProvider>
    );
    
    // Wait for the new data to load
    await waitFor(() => {
      // The new message should be present
      expect(screen.getByText('Fourth message')).toBeInTheDocument();
      
      // All user names should be displayed correctly, including previously loaded ones
      expect(screen.getByText('User 1 Display')).toBeInTheDocument();
      expect(screen.getByText('User 2 Real')).toBeInTheDocument();
      expect(screen.getByText('username3')).toBeInTheDocument();
      expect(screen.getByText('User 4 Display')).toBeInTheDocument();
    });
  });
});
