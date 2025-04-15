import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntegrationProvider } from '../../context/IntegrationContext';
import useIntegration from '../../context/useIntegration';

// Mock AuthProvider
const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// First mock the modules
vi.mock('../../lib/integrationService', () => ({
  default: {
    getIntegrations: vi.fn(),
    getIntegration: vi.fn(),
    createIntegration: vi.fn(),
    createSlackIntegration: vi.fn(),
    updateIntegration: vi.fn(),
    getResources: vi.fn(),
    syncResources: vi.fn(),
    shareIntegration: vi.fn(),
    revokeShare: vi.fn(),
    grantResourceAccess: vi.fn(),
    isApiError: vi.fn()
  }
}));

vi.mock('../../context/useAuth', () => ({
  default: vi.fn()
}));

// Import after mocking
import integrationService from '../../lib/integrationService';
import type { Integration } from '../../lib/integrationService';
import useAuth from '../../context/useAuth';

// Create mock data
const mockIntegration = {
  id: 'test-int-1',
  name: 'Test Integration',
  service_type: 'slack',
  status: 'active',
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
};

const mockResource = {
  id: 'res-1',
  integration_id: 'test-int-1',
  resource_type: 'slack_channel',
  external_id: 'C12345',
  name: 'general',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z'
};

// Helper component for testing hooks
const TestHookComponent = ({ callback }: { callback: () => void }) => {
  callback();
  return null;
};

describe('IntegrationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup auth mock
    vi.mocked(useAuth).mockReturnValue({
      session: { access_token: 'mock-token' },
      user: { id: 'user-1' },
      loading: false,
      teamContext: {
        currentTeamId: 'team-1',
        currentTeamRole: 'admin',
        teams: [{
          id: 'team-1',
          name: 'Test Team',
          slug: 'test-team',
          role: 'admin'
        }]
      }
    });
    
    // Setup integration service mocks
    vi.mocked(integrationService.getIntegrations).mockResolvedValue([mockIntegration]);
    vi.mocked(integrationService.getIntegration).mockResolvedValue(mockIntegration);
    vi.mocked(integrationService.createIntegration).mockResolvedValue(mockIntegration);
    vi.mocked(integrationService.createSlackIntegration).mockResolvedValue(mockIntegration);
    vi.mocked(integrationService.updateIntegration).mockResolvedValue(mockIntegration);
    vi.mocked(integrationService.getResources).mockResolvedValue([mockResource]);
    vi.mocked(integrationService.syncResources).mockResolvedValue({ status: 'success' });
    vi.mocked(integrationService.shareIntegration).mockResolvedValue({ id: 'share-1' });
    vi.mocked(integrationService.revokeShare).mockResolvedValue({ status: 'success' });
    vi.mocked(integrationService.grantResourceAccess).mockResolvedValue({ id: 'access-1' });
    vi.mocked(integrationService.isApiError).mockImplementation(() => false);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('IntegrationProvider', () => {
    it('should render children without crashing', async () => {
      await act(async () => {
        render(
          <MockAuthProvider>
            <IntegrationProvider>
              <div data-testid="test-child">Test Child</div>
            </IntegrationProvider>
          </MockAuthProvider>
        );
      });
      
      expect(screen.getByTestId('test-child')).toBeDefined();
    });
    
    it('should load integrations for the current team on mount', async () => {
      await act(async () => {
        render(
          <MockAuthProvider>
            <IntegrationProvider>
              <div>Integration Provider Test</div>
            </IntegrationProvider>
          </MockAuthProvider>
        );
      });
      
      // Check that getIntegrations was called
      expect(integrationService.getIntegrations).toHaveBeenCalledWith('team-1');
    });
  });
  
  describe('useIntegration hook', () => {
    it('should throw an error when used outside of IntegrationProvider', () => {
      // Suppress the error log
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Expect an error when rendering the hook outside of the provider
      expect(() => {
        renderHook(() => useIntegration());
      }).toThrow('useIntegration must be used within an IntegrationProvider');
      
      consoleErrorMock.mockRestore();
    });
    
    it('should provide access to integration data and functions', async () => {
      // Setup a handler to capture the hook result
      let hookResult: ReturnType<typeof useIntegration> | undefined;
      
      await act(async () => {
        render(
          <MockAuthProvider>
            <IntegrationProvider>
              <TestHookComponent callback={() => {
                hookResult = useIntegration();
              }} />
            </IntegrationProvider>
          </MockAuthProvider>
        );
      });
      
      // Verify hook provides expected properties
      expect(hookResult).toBeDefined();
      expect(hookResult).toHaveProperty('integrations');
      expect(hookResult).toHaveProperty('loading');
      expect(hookResult).toHaveProperty('fetchIntegrations');
      expect(hookResult).toHaveProperty('createIntegration');
      expect(hookResult).toHaveProperty('fetchResources');
    });
    
    it('should update state when fetching integrations', async () => {
      // Setup a component to capture hook state at various points
      const hookStates: { loading: boolean; integrations: Integration[] }[] = [];
      
      const TestComponent = () => {
        const integration = useIntegration();
        
        React.useEffect(() => {
          hookStates.push({
            loading: integration.loading,
            integrations: integration.integrations,
          });
        }, [integration.loading, integration.integrations]);
        
        return null;
      };
      
      await act(async () => {
        render(
          <MockAuthProvider>
            <IntegrationProvider>
              <TestComponent />
            </IntegrationProvider>
          </MockAuthProvider>
        );
      });
      
      // Should have at least initial state and loaded state
      expect(hookStates.length).toBeGreaterThanOrEqual(2);
      
      // Final state should have integrations loaded
      const finalState = hookStates[hookStates.length - 1];
      expect(finalState.loading).toBe(false);
      expect(finalState.integrations.length).toBeGreaterThan(0);
    });
    
    it('should be able to select an integration', async () => {
      // Setup a component to test selection
      let hookResult: ReturnType<typeof useIntegration> | undefined;
      
      const TestComponent = () => {
        const integration = useIntegration();
        hookResult = integration;
        
        React.useEffect(() => {
          // Select an integration on mount
          integration.selectIntegration('test-int-1');
        }, [integration]);
        
        return null;
      };
      
      await act(async () => {
        render(
          <MockAuthProvider>
            <IntegrationProvider>
              <TestComponent />
            </IntegrationProvider>
          </MockAuthProvider>
        );
      });
      
      // Check that the integration was selected
      expect(hookResult?.currentIntegration).toBeDefined();
      expect(hookResult?.currentIntegration?.id).toBe('test-int-1');
      
      // Check that resources were fetched
      expect(integrationService.getResources).toHaveBeenCalledWith('test-int-1');
    });
    
    it('should handle errors properly', async () => {
      // Mock getIntegrations to throw an error
      vi.mocked(integrationService.getIntegrations).mockRejectedValueOnce(new Error('API Error'));
      
      // Setup a component to test error handling
      let hookResult: ReturnType<typeof useIntegration> | undefined;
      
      const TestComponent = () => {
        const integration = useIntegration();
        hookResult = integration;
        return null;
      };
      
      await act(async () => {
        render(
          <MockAuthProvider>
            <IntegrationProvider>
              <TestComponent />
            </IntegrationProvider>
          </MockAuthProvider>
        );
      });
      
      // Check for error state
      expect(hookResult?.error).toBeDefined();
      expect((hookResult?.error as Error).message).toBe('API Error');
      
      // Test clearing errors
      await act(async () => {
        hookResult?.clearErrors();
      });
      
      expect(hookResult?.error).toBeNull();
    });
  });
});

