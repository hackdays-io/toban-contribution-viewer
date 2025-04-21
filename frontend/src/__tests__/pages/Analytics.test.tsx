import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Analytics from '../../pages/Analytics'
import { BrowserRouter } from 'react-router-dom'
import '../setup'

// Mock Chakra UI components to simplify testing
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
  }
})

// Wrapper component with BrowserRouter
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Analytics', () => {
  it('renders the analytics page correctly', () => {
    render(<Analytics />, { wrapper: Wrapper })

    // Check main heading (first occurrence will be the page title)
    const headings = screen.getAllByText(/Analytics/i)
    expect(headings.length).toBeGreaterThan(0)

    // Check tabs container
    expect(screen.getByTestId('tabs')).toBeInTheDocument()

    // Check platform cards are mentioned (using getAllByText and checking the array length)
    const slackAnalyticsElements = screen.getAllByText(/Slack Analytics/i)
    const githubAnalyticsElements = screen.getAllByText(/GitHub Analytics/i)
    const notionAnalyticsElements = screen.getAllByText(/Notion Analytics/i)

    expect(slackAnalyticsElements.length).toBeGreaterThan(0)
    expect(githubAnalyticsElements.length).toBeGreaterThan(0)
    expect(notionAnalyticsElements.length).toBeGreaterThan(0)

    // Check that links are present
    const slackAnalyticsLinks = screen.getAllByText(/View Slack Analytics/i)
    expect(slackAnalyticsLinks.length).toBeGreaterThan(0)
  })

  it('has a working link to Slack analytics through integrations', () => {
    render(<Analytics />, { wrapper: Wrapper })

    const slackAnalyticsLink = screen.getByText(/View Slack Analytics/i)
    expect(slackAnalyticsLink).toBeInTheDocument()
    expect(slackAnalyticsLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/integrations'
    )
  })
})
