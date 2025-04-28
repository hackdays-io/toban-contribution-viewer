import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ThreadView from '../../../components/slack/ThreadView'
import '../../../__tests__/setup'
import { ChakraProvider } from '@chakra-ui/react'
import React from 'react'

// Mock the env config
vi.mock('../../../config/env', async () => {
  return {
    default: {
      apiUrl: 'http://localhost:8000/api/v1',
      isDev: true,
      features: {
        enableSlack: true,
      },
      supabase: {
        url: 'mock-url',
        anonKey: 'mock-key',
        redirectUri: 'http://localhost:3000/auth/callback',
      },
    },
    getEnvVar: (name: string) => {
      if (name === 'VITE_API_URL') return 'http://localhost:8000/api/v1'
      return 'mock-value'
    },
    getBooleanEnvVar: () => true,
    validateEnvironment: () => true,
    env: {
      apiUrl: 'http://localhost:8000/api/v1',
      isDev: true,
      features: {
        enableSlack: true,
      },
      supabase: {
        url: 'mock-url',
        anonKey: 'mock-key',
        redirectUri: 'http://localhost:3000/auth/callback',
      },
    },
  }
})

// Mock Chakra Modal component to avoid framer-motion issues in tests
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react')
  return {
    ...actual,
    Modal: ({
      children,
      isOpen,
      onClose,
    }: {
      children: React.ReactNode
      isOpen: boolean
      onClose: () => void
    }) =>
      isOpen ? (
        <div data-testid="modal">
          <button onClick={onClose} data-testid="close-button">
            Close
          </button>
          <div data-testid="modal-content">{children}</div>
        </div>
      ) : null,
    ModalOverlay: () => <div data-testid="modal-overlay" />,
    ModalContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="modal-content">{children}</div>
    ),
    ModalHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="modal-header">{children}</div>
    ),
    ModalBody: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="modal-body">{children}</div>
    ),
    ModalFooter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="modal-footer">{children}</div>
    ),
    ModalCloseButton: () => <button data-testid="modal-close-button">X</button>,
  }
})

// Mock SlackUserDisplay component
vi.mock('../../../components/slack/SlackUserDisplay', () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="slack-user-display">{userId}</div>
  ),
}))

// Mock SlackUserContext exports
vi.mock('../../../components/slack/SlackUserContext', () => ({
  SlackUserCacheProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="slack-user-cache-provider">{children}</div>
  ),
}))

// Mock SlackUserContextExports
vi.mock('../../../components/slack/SlackUserContextExports', () => ({
  UserCacheContext: React.createContext(undefined),
}))

// Mock MessageText component
vi.mock('../../../components/slack/MessageText', () => ({
  default: ({ text }: { text: string }) => (
    <div data-testid="message-text">{text}</div>
  ),
}))

// This mock was duplicated - removed to avoid conflicts

// Mock data
const mockParentMessage = {
  id: 'msg1',
  slack_id: 'S1',
  slack_ts: '1617984000.000100',
  text: 'This is a parent message',
  message_type: 'message',
  subtype: null,
  is_edited: false,
  edited_ts: null,
  has_attachments: false,
  thread_ts: '1617984000.000100',
  is_thread_parent: true,
  is_thread_reply: false,
  reply_count: 2,
  reply_users_count: 2,
  reaction_count: 0,
  message_datetime: '2023-04-10T12:00:00Z',
  channel_id: 'C123',
  user_id: 'U123',
  parent_id: null,
}

const mockReplies = [
  {
    id: 'msg2',
    slack_id: 'S2',
    slack_ts: '1617984060.000200',
    text: 'This is a reply 1',
    message_type: 'message',
    subtype: null,
    is_edited: false,
    edited_ts: null,
    has_attachments: false,
    thread_ts: '1617984000.000100',
    is_thread_parent: false,
    is_thread_reply: true,
    reply_count: 0,
    reply_users_count: 0,
    reaction_count: 1,
    message_datetime: '2023-04-10T12:01:00Z',
    channel_id: 'C123',
    user_id: 'U456',
    parent_id: 'msg1',
  },
  {
    id: 'msg3',
    slack_id: 'S3',
    slack_ts: '1617984120.000300',
    text: 'This is a reply 2',
    message_type: 'message',
    subtype: null,
    is_edited: true,
    edited_ts: '1617984180.000400',
    has_attachments: false,
    thread_ts: '1617984000.000100',
    is_thread_parent: false,
    is_thread_reply: true,
    reply_count: 0,
    reply_users_count: 0,
    reaction_count: 0,
    message_datetime: '2023-04-10T12:02:00Z',
    channel_id: 'C123',
    user_id: 'U123',
    parent_id: 'msg1',
  },
]

// Users are no longer needed as SlackUserDisplay component is mocked
// and directly handles user data fetching in the actual component

// Props for the component
const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  workspaceId: 'W123',
  channelId: 'C123',
  threadTs: '1617984000.000100',
  parentMessage: mockParentMessage,
  // users prop removed as it's no longer used in the component
}

// Wrapper component with ChakraProvider
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>{children}</ChakraProvider>
)

describe('ThreadView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock the fetch call to return thread replies
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        replies: mockReplies,
        total_replies: 2,
        has_more: false,
      }),
    })
  })

  it('renders with mocked components', () => {
    render(<ThreadView {...defaultProps} />, { wrapper: Wrapper })

    // Check that the modal is rendered
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByTestId('modal-header')).toBeInTheDocument()
    expect(screen.getByText('Thread')).toBeInTheDocument()
  })

  it('calls fetch with the correct URL', () => {
    render(<ThreadView {...defaultProps} />, { wrapper: Wrapper })

    expect(global.fetch).toHaveBeenCalled()
    // Use vi.mocked to properly type the mock function
    const mockedFetch = vi.mocked(global.fetch)
    const fetchCalls = mockedFetch.mock.calls
    expect(fetchCalls.length).toBeGreaterThan(0)
    expect(fetchCalls[0][0]).toBe(
      `http://localhost:8000/api/v1/slack/workspaces/W123/channels/C123/threads/1617984000.000100?limit=1000`
    )
  })

  it('closes the modal when close button is clicked', () => {
    render(<ThreadView {...defaultProps} />, { wrapper: Wrapper })

    // Find and click the close button
    const closeButton = screen.getByTestId('close-button')
    closeButton.click()

    // Check that onClose was called
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('handles empty parent message gracefully', () => {
    render(<ThreadView {...defaultProps} parentMessage={null} />, {
      wrapper: Wrapper,
    })

    // The component should still render without errors
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })
})
