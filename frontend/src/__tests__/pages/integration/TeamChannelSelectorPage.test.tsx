import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TeamChannelSelectorPage from '../../../pages/integration/TeamChannelSelectorPage';
import IntegrationContext from '../../../context/IntegrationContext';
import { IntegrationType, IntegrationStatus } from '../../../lib/integrationService';

// Mocking react-router-dom's useParams hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      integrationId: 'test-int-1',
    }),
    useNavigate: () => vi.fn(),
  };
});

// Mock integration data
const mockIntegration = {
  id: 'test-int-1',
  name: 'Test Slack Workspace',
  service_type: IntegrationType.SLACK,
  status: IntegrationStatus.ACTIVE,
  owner_team: {
    id: 'team-1',
    name: 'Test Team',
    slug: 'test-team',
  },
  created_by: {
    id: 'user-1',
    name: 'Test User',
  },
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

// Mock context
const mockIntegrationContext = {
  // Basic state
  integrations: [],
  teamIntegrations: {},
  currentIntegration: mockIntegration,
  currentResources: [],
  selectedChannels: [],
  loading: false,
  loadingResources: false,
  loadingChannelSelection: false,
  error: null,
  resourceError: null,
  channelSelectionError: null,

  // Mock functions
  fetchIntegration: vi.fn(),
  fetchIntegrations: vi.fn(),
  createIntegration: vi.fn(),
  createSlackIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  fetchResources: vi.fn(),
  syncResources: vi.fn(),
  shareIntegration: vi.fn(),
  revokeShare: vi.fn(),
  grantResourceAccess: vi.fn(),
  selectIntegration: vi.fn(),
  fetchSelectedChannels: vi.fn(),
  selectChannelsForAnalysis: vi.fn(),
  deselectChannelsForAnalysis: vi.fn(),
  isChannelSelectedForAnalysis: vi.fn(),
  analyzeChannel: vi.fn(),
  clearErrors: vi.fn(),
  clearChannelSelectionError: vi.fn(),
};

describe('TeamChannelSelectorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithContext = (contextOverrides = {}) => {
    const context = { ...mockIntegrationContext, ...contextOverrides };
    
    return render(
      <ChakraProvider>
        <BrowserRouter>
          <IntegrationContext.Provider value={context}>
            <Routes>
              <Route path="*" element={<TeamChannelSelectorPage />} />
            </Routes>
          </IntegrationContext.Provider>
        </BrowserRouter>
      </ChakraProvider>
    );
  };

  it('renders the page with title and description', async () => {
    renderWithContext();
    
    // Should fetch integration data
    expect(mockIntegrationContext.fetchIntegration).toHaveBeenCalledWith('test-int-1');
    
    // Should contain expected UI elements
    expect(screen.getByText('Select Channels for Analysis')).toBeInTheDocument();
    expect(screen.getByText(/Choose which channels from Test Slack Workspace/)).toBeInTheDocument();
    
    // Should render back button
    expect(screen.getByText('Back to Integration')).toBeInTheDocument();
    
    // Should render breadcrumb navigation
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Channel Selection')).toBeInTheDocument();
  });

  it('shows loading state when data is loading', async () => {
    renderWithContext({ loading: true, currentIntegration: null });
    
    expect(screen.getByText('Loading integration data...')).toBeInTheDocument();
  });

  it('shows error state when an error occurs', async () => {
    const errorMessage = 'Failed to load integration';
    renderWithContext({ 
      error: new Error(errorMessage),
      currentIntegration: null
    });
    
    expect(screen.getByText('Error loading integration:')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows not found state when integration is missing', async () => {
    renderWithContext({ currentIntegration: null });
    
    expect(screen.getByText('Integration not found')).toBeInTheDocument();
  });

  it('shows unsupported message for non-Slack integrations', async () => {
    const nonSlackIntegration = {
      ...mockIntegration,
      service_type: IntegrationType.GITHUB,
    };
    
    renderWithContext({ currentIntegration: nonSlackIntegration });
    
    expect(screen.getByText('Unsupported integration type')).toBeInTheDocument();
    expect(screen.getByText('Channel selection is currently only available for Slack integrations.')).toBeInTheDocument();
  });
});