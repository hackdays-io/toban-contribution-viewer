import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Analytics from '../../pages/Analytics'
import { BrowserRouter } from 'react-router-dom'
import '../setup'

// Mock everything that could cause test failures
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react')
  return {
    ...actual,
    Tabs: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tabs">{children}</div>
    ),
    TabList: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tab-list">{children}</div>
    ),
    Tab: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tab">{children}</div>
    ),
    TabPanels: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tab-panels">{children}</div>
    ),
    TabPanel: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tab-panel">{children}</div>
    ),
    Grid: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="grid">{children}</div>
    ),
    GridItem: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="grid-item">{children}</div>
    ),
    useColorModeValue: () => 'purple.50',
    useClipboard: () => ({ hasCopied: false, onCopy: vi.fn() }),
  }
})

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

// Mock react-icons
vi.mock('react-icons/fi', async () => {
  const actual = await vi.importActual('react-icons/fi')
  return {
    ...actual,
    FiBarChart2: () => <span data-testid="icon-bar-chart">Icon</span>,
    FiMessageSquare: () => <span data-testid="icon-message">Icon</span>,
    FiUsers: () => <span data-testid="icon-users">Icon</span>,
    FiSearch: () => <span data-testid="icon-search">Icon</span>,
    FiClock: () => <span data-testid="icon-clock">Icon</span>,
    FiExternalLink: () => <span data-testid="icon-external-link">Icon</span>,
  }
})

// Wrapper component with BrowserRouter
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Analytics', () => {
  it('renders basic elements of the Analytics Hub page', () => {
    render(<Analytics />, { wrapper: Wrapper })

    // Check if there's any content at all
    expect(screen.getByTestId('tabs')).toBeInTheDocument()
    expect(screen.getByTestId('tab-list')).toBeInTheDocument()
    expect(screen.getByTestId('tab-panels')).toBeInTheDocument()

    // Check for any text that should be present in the component
    expect(screen.getByText('Analytics Hub')).toBeInTheDocument()
  })
})
