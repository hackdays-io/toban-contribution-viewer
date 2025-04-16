// React is used in JSX transformation
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { describe, it, expect, vi } from 'vitest'
import { IntegrationsPage } from '../../../pages/integration'

// Mock required components
vi.mock('../../../components/layout', () => ({
  PageTitle: ({
    title,
    description,
  }: {
    title: string
    description: string
  }) => (
    <div data-testid="page-title">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('../../../components/integration', () => ({
  IntegrationList: ({ teamId }: { teamId?: string }) => (
    <div data-testid="integration-list">
      Integration List Component (Team ID: {teamId || 'Not specified'})
    </div>
  ),
}))

// Mock useAuth hook
vi.mock('../../../context/useAuth', () => ({
  default: () => ({
    teamContext: {
      currentTeamId: 'test-team-123',
      teams: [{ id: 'test-team-123', name: 'Test Team' }],
    },
  }),
}))

describe('IntegrationsPage', () => {
  it('renders the page title and integration list', () => {
    render(
      <ChakraProvider>
        <BrowserRouter>
          <IntegrationsPage />
        </BrowserRouter>
      </ChakraProvider>
    )

    // Check that page title is rendered
    const pageTitle = screen.getByTestId('page-title')
    expect(pageTitle).toBeInTheDocument()
    expect(pageTitle.querySelector('h1')?.textContent).toBe('Integrations')
    expect(pageTitle.querySelector('p')?.textContent).toBe(
      "Manage all your team's integrations"
    )

    // Check that integration list is rendered with expected team ID
    const integrationList = screen.getByTestId('integration-list')
    expect(integrationList).toBeInTheDocument()
    expect(integrationList.textContent).toContain('Team ID: test-team-123')
  })
})
