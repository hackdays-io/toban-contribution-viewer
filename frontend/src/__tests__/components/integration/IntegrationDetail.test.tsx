import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import IntegrationDetail from '../../../components/integration/IntegrationDetail'
import { IntegrationProvider } from '../../../context/IntegrationContext'
import { AuthProvider } from '../../../context/AuthContext'
import {
  Integration,
  IntegrationType,
  IntegrationStatus,
} from '../../../lib/integrationService'

// Mock the useIntegration hook and its return values
jest.mock('../../../context/useIntegration', () => ({
  __esModule: true,
  default: () => ({
    currentIntegration: mockIntegration,
    currentResources: mockResources,
    loading: false,
    loadingResources: false,
    error: null,
    resourceError: null,
    fetchIntegration: jest.fn(),
    fetchResources: jest.fn(),
    syncResources: jest.fn().mockResolvedValue(true),
    updateIntegration: jest.fn().mockResolvedValue(mockIntegration),
  }),
}))

// Mock integration data
const mockIntegration: Integration = {
  id: 'test-integration-id',
  name: 'Test Integration',
  description: 'This is a test integration',
  service_type: IntegrationType.SLACK,
  status: IntegrationStatus.ACTIVE,
  metadata: {
    workspace_name: 'Test Workspace',
    channels_count: 10,
  },
  last_used_at: new Date().toISOString(),
  owner_team: {
    id: 'team-id',
    name: 'Test Team',
    slug: 'test-team',
  },
  created_by: {
    id: 'user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  shared_with: [
    {
      id: 'share-id',
      integration_id: 'test-integration-id',
      team_id: 'other-team-id',
      share_level: 'read_only',
      status: 'active',
      shared_by: {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
      team: {
        id: 'other-team-id',
        name: 'Other Team',
        slug: 'other-team',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
}

// Mock resources data
const mockResources = [
  {
    id: 'resource-id-1',
    integration_id: 'test-integration-id',
    resource_type: 'slack_channel',
    external_id: 'C12345',
    name: 'general',
    metadata: {
      is_private: false,
      member_count: 50,
    },
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'resource-id-2',
    integration_id: 'test-integration-id',
    resource_type: 'slack_channel',
    external_id: 'C67890',
    name: 'random',
    metadata: {
      is_private: false,
      member_count: 45,
    },
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const renderComponent = () => {
  return render(
    <ChakraProvider>
      <BrowserRouter>
        <AuthProvider>
          <IntegrationProvider>
            <IntegrationDetail integrationId="test-integration-id" />
          </IntegrationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  )
}

describe('IntegrationDetail', () => {
  it('renders the integration name and type', () => {
    renderComponent()

    expect(screen.getByText('Test Integration')).toBeInTheDocument()
    expect(screen.getByText('slack')).toBeInTheDocument()
  })

  it('displays the integration status badge', () => {
    renderComponent()

    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders the overview tab by default', () => {
    renderComponent()

    expect(screen.getByText('Integration Details')).toBeInTheDocument()
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('test-integration-id')).toBeInTheDocument()
  })

  it('switches to resources tab when clicked', async () => {
    renderComponent()

    fireEvent.click(screen.getByRole('tab', { name: /resources/i }))

    await waitFor(() => {
      expect(screen.getByText('Resources')).toBeInTheDocument()
      expect(screen.getByText('general')).toBeInTheDocument()
      expect(screen.getByText('random')).toBeInTheDocument()
    })
  })

  it('switches to sharing tab when clicked', async () => {
    renderComponent()

    fireEvent.click(screen.getByRole('tab', { name: /sharing/i }))

    await waitFor(() => {
      expect(screen.getByText('Sharing Settings')).toBeInTheDocument()
      expect(screen.getByText('Other Team')).toBeInTheDocument()
    })
  })

  it('switches to settings tab when clicked', async () => {
    renderComponent()

    fireEvent.click(screen.getByRole('tab', { name: /settings/i }))

    await waitFor(() => {
      expect(screen.getByText('Integration Settings')).toBeInTheDocument()
      expect(screen.getByText('Edit Integration')).toBeInTheDocument()
      expect(screen.getByText('Delete Integration')).toBeInTheDocument()
    })
  })

  it('displays metadata in the overview tab', () => {
    renderComponent()

    expect(screen.getByText('Metadata')).toBeInTheDocument()
    expect(screen.getByText('workspace_name')).toBeInTheDocument()
    expect(screen.getByText('Test Workspace')).toBeInTheDocument()
    expect(screen.getByText('channels_count')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })
})
