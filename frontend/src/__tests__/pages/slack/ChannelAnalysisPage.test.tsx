import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChannelAnalysisPage } from '../../../pages/slack'
import { BrowserRouter } from 'react-router-dom'
import '../../setup'

// Mock navigation and toast
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ workspaceId: 'ws1', channelId: 'ch1' }),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react')
  return {
    ...actual,
    useToast: () => vi.fn(),
  }
})

// Wrapper component with BrowserRouter
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('ChannelAnalysisPage', () => {
  it('renders the channel analysis page correctly', () => {
    // Mock fetch to avoid actual API calls
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ channels: [], workspaces: [] }),
      })
    )

    render(<ChannelAnalysisPage />, { wrapper: Wrapper })

    // Basic checks
    expect(screen.getByText(/Channel Analysis/i)).toBeInTheDocument()
    expect(screen.getByText(/Back to Slack Analytics/i)).toBeInTheDocument()
  })
})
