import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResourceList } from '../../../components/integration'
import IntegrationContext from '../../../context/IntegrationContext'
import { ResourceType } from '../../../lib/integrationService'

// Mock the modules
vi.mock('../../../lib/integrationService', () => ({
  default: {
    getResources: vi.fn(),
    syncResources: vi.fn(),
    grantResourceAccess: vi.fn(),
    isApiError: vi.fn(() => false),
  },
  ResourceType: {
    SLACK_CHANNEL: 'slack_channel',
    GITHUB_REPOSITORY: 'github_repository',
    NOTION_PAGE: 'notion_page',
  },
  AccessLevel: {
    READ: 'READ',
    WRITE: 'WRITE',
    ADMIN: 'ADMIN',
  },
}))

// Mock useAuth hook
vi.mock('../../../context/useAuth', () => ({
  default: () => ({
    teamContext: {
      currentTeamId: 'team-1',
      teams: [{ id: 'team-1', name: 'Test Team' }],
    },
  }),
}))

describe('ResourceList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultProps = {
    integrationId: 'int-1',
    resources: [
      {
        id: 'res-1',
        name: 'General Channel',
        external_id: 'channel_general',
        resource_type: ResourceType.SLACK_CHANNEL,
        integration_id: 'int-1',
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'res-2',
        name: 'Engineering Channel',
        external_id: 'channel_engineering',
        resource_type: ResourceType.SLACK_CHANNEL,
        integration_id: 'int-1',
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    teams: [
      { id: 'team-1', name: 'Test Team', slug: 'test-team' },
      { id: 'team-2', name: 'Engineering Team', slug: 'eng-team' },
    ],
  }

  const renderComponent = (props = {}, contextOverrides = {}) => {
    const mergedProps = { ...defaultProps, ...props }

    const mockContext = {
      // State
      integrations: [],
      teamIntegrations: {},
      currentIntegration: null,
      currentResources: [],
      loading: false,
      loadingResources: false,
      error: null,
      resourceError: null,

      // CRUD operations
      fetchIntegrations: vi.fn(),
      fetchIntegration: vi.fn(),
      createIntegration: vi.fn(),
      createSlackIntegration: vi.fn(),
      updateIntegration: vi.fn(),

      // Resource operations
      fetchResources: vi.fn(),
      syncResources: vi.fn(),

      // Sharing operations
      shareIntegration: vi.fn(),
      revokeShare: vi.fn(),
      grantResourceAccess: vi.fn(),

      // Selection
      selectIntegration: vi.fn(),

      // Error handling
      clearErrors: vi.fn(),

      ...contextOverrides,
    }

    return render(
      <ChakraProvider>
        <BrowserRouter>
          <IntegrationContext.Provider value={mockContext}>
            <ResourceList {...mergedProps} />
          </IntegrationContext.Provider>
        </BrowserRouter>
      </ChakraProvider>
    )
  }

  it('renders the component with resources', () => {
    renderComponent()
    expect(screen.getByText('Resources')).toBeInTheDocument()
    expect(screen.getByText('General Channel')).toBeInTheDocument()
    expect(screen.getByText('Engineering Channel')).toBeInTheDocument()
  })

  it('displays the sync button', () => {
    renderComponent()
    expect(screen.getByText('Sync Resources')).toBeInTheDocument()
  })

  it('displays loading state when isLoading is true', () => {
    renderComponent({ isLoading: true, resources: [] })
    expect(screen.getByText('Loading resources...')).toBeInTheDocument()
  })

  it('displays error message when error is present', () => {
    renderComponent({ error: new Error('Test error') })
    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument()
  })

  it('displays empty state when no resources are available', () => {
    renderComponent({ resources: [] })
    expect(
      screen.getByText(/No resources found for this integration/)
    ).toBeInTheDocument()
    expect(screen.getByText('Sync Now')).toBeInTheDocument()
  })

  it('calls onSync when sync button is clicked', () => {
    const onSync = vi.fn().mockResolvedValue(undefined)
    renderComponent({ onSync })
    fireEvent.click(screen.getByText('Sync Resources'))
    expect(onSync).toHaveBeenCalled()
  })
})
