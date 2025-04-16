import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResourceListPage } from '../../../pages/integration'
import IntegrationContext from '../../../context/IntegrationContext'
import {
  IntegrationType,
  IntegrationStatus,
} from '../../../lib/integrationService'

// Mock the ResourceList component to avoid test issues
vi.mock('../../../components/integration/ResourceList', () => ({
  default: vi.fn(() => (
    <div data-testid="mock-resource-list">
      <h2>Resources</h2>
      <div>Resource List Component</div>
    </div>
  )),
}))

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({
      integrationId: 'int-123',
    }),
  }
})

// Mock useAuth hook
vi.mock('../../../context/useAuth', () => ({
  default: () => ({
    teamContext: {
      currentTeamId: 'team-1',
      teams: [{ id: 'team-1', name: 'Test Team' }],
    },
  }),
}))

// Create mock integration context
const mockIntegrationContext = {
  integrations: [],
  teamIntegrations: {},
  currentIntegration: {
    id: 'int-123',
    name: 'Test Integration',
    service_type: IntegrationType.SLACK,
    description: 'Test description',
    metadata: {},
    owner_team: {
      id: 'team-1',
      name: 'Test Team',
      slug: 'test-team',
    },
    status: IntegrationStatus.ACTIVE,
    created_by: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  currentResources: [],
  loading: false,
  loadingResources: false,
  error: null,
  resourceError: null,
  fetchIntegrations: vi.fn(),
  fetchIntegration: vi.fn(),
  createIntegration: vi.fn(),
  createSlackIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  fetchResources: vi.fn(),
  syncResources: vi.fn(),
  shareIntegration: vi.fn(),
  revokeShare: vi.fn(),
  grantResourceAccess: vi.fn(),
  selectIntegration: vi.fn(),
  clearErrors: vi.fn(),
}

describe('ResourceListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = (contextOverrides = {}) => {
    const testContext = { ...mockIntegrationContext, ...contextOverrides }

    return render(
      <ChakraProvider>
        <BrowserRouter>
          <IntegrationContext.Provider value={testContext}>
            <ResourceListPage />
          </IntegrationContext.Provider>
        </BrowserRouter>
      </ChakraProvider>
    )
  }

  it('renders the page title correctly', () => {
    renderComponent()
    expect(screen.getByText('Test Integration Resources')).toBeInTheDocument()
    expect(
      screen.getByText('View and manage integration resources')
    ).toBeInTheDocument()
  })

  it('calls selectIntegration on mount with the correct integration ID', () => {
    renderComponent()
    expect(mockIntegrationContext.selectIntegration).toHaveBeenCalledWith(
      'int-123'
    )
  })

  it('renders the back button', () => {
    renderComponent()
    const backButton = screen.getByText('Back to Integration Details')
    expect(backButton).toBeInTheDocument()
  })

  it('renders the ResourceList component', () => {
    renderComponent()
    // ResourceList component is mocked, so check for the mock element
    expect(screen.getByTestId('mock-resource-list')).toBeInTheDocument()
  })
})
