import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationList } from '../../../components/integration';
import IntegrationContext from '../../../context/IntegrationContext';
import { Integration, IntegrationType, IntegrationStatus } from '../../../lib/integrationService';

// Mock useAuth hook
vi.mock('../../../context/useAuth', () => ({
  default: () => ({
    teamContext: {
      currentTeamId: 'team-1',
      teams: [{ id: 'team-1', name: 'Test Team' }]
    }
  })
}));

// Create mock integrations data
const mockIntegrations: Integration[] = [
  {
    id: 'int-1',
    name: 'Slack Workspace',
    service_type: IntegrationType.SLACK,
    status: IntegrationStatus.ACTIVE,
    owner_team: {
      id: 'team-1',
      name: 'Test Team',
      slug: 'test-team'
    },
    created_by: {
      id: 'user-1',
      name: 'Test User'
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  },
  {
    id: 'int-2',
    name: 'GitHub Repo',
    service_type: IntegrationType.GITHUB,
    status: IntegrationStatus.ACTIVE,
    owner_team: {
      id: 'team-1',
      name: 'Test Team',
      slug: 'test-team'
    },
    created_by: {
      id: 'user-1',
      name: 'Test User'
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  }
];

// Create mock integration context
const mockIntegrationContext = {
  integrations: mockIntegrations,
  teamIntegrations: { 'team-1': mockIntegrations },
  currentIntegration: null,
  currentResources: [],
  loading: false,
  loadingResources: false,
  error: null,
  resourceError: null,
  fetchIntegrations: vi.fn().mockResolvedValue(undefined),
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
  clearErrors: vi.fn()
};

describe('IntegrationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  const renderComponent = (contextOverrides = {}) => {
    const testContext = { ...mockIntegrationContext, ...contextOverrides };
    
    return render(
      <ChakraProvider>
        <BrowserRouter>
          <IntegrationContext.Provider value={testContext}>
            <IntegrationList />
          </IntegrationContext.Provider>
        </BrowserRouter>
      </ChakraProvider>
    );
  };
  
  it('renders loading state when loading is true', () => {
    renderComponent({ loading: true });
    expect(screen.getByText('Loading integrations...')).toBeInTheDocument();
  });
  
  it('renders error state when error occurs', () => {
    const error = { message: 'Failed to load integrations' };
    renderComponent({ error });
    
    expect(screen.getByText(/Error loading integrations/)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
  
  it('renders empty state when no integrations are available', () => {
    renderComponent({ integrations: [] });
    
    expect(screen.getByText('No integrations found.')).toBeInTheDocument();
    expect(screen.getByText('Connect your first integration')).toBeInTheDocument();
  });
  
  it('renders integration cards when integrations are available', () => {
    renderComponent();
    
    expect(screen.getByText('Slack Workspace')).toBeInTheDocument();
    expect(screen.getByText('GitHub Repo')).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBe(2);
  });
  
  it('calls fetchIntegrations on mount', () => {
    renderComponent();
    
    expect(mockIntegrationContext.fetchIntegrations).toHaveBeenCalledWith('team-1');
  });
  
  it('filters integrations by type when filter is applied', async () => {
    renderComponent();
    
    // Find the filter dropdown and select Slack
    const filterSelect = screen.getByRole('combobox');
    fireEvent.change(filterSelect, { target: { value: IntegrationType.SLACK } });
    
    // Should only show Slack integrations
    await waitFor(() => {
      expect(screen.getByText('Slack Workspace')).toBeInTheDocument();
      expect(screen.queryByText('GitHub Repo')).not.toBeInTheDocument();
    });
  });
  
  it('calls selectIntegration when clicking on an integration', () => {
    renderComponent();
    
    // Find the View button and click it
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);
    
    expect(mockIntegrationContext.selectIntegration).toHaveBeenCalledWith('int-1');
  });
  
  it('calls refresh when clicking the refresh button', async () => {
    renderComponent();
    
    // Find the refresh button and click it
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    expect(mockIntegrationContext.fetchIntegrations).toHaveBeenCalledTimes(2);
    expect(mockIntegrationContext.fetchIntegrations).toHaveBeenCalledWith('team-1');
  });
});
