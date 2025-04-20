import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationProvider } from '../../context/IntegrationContext';
import IntegrationContext from '../../context/IntegrationContext';
import useIntegration from '../../context/useIntegration';
import integrationService, { ResourceType } from '../../lib/integrationService';

// Mocking the services
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
    isApiError: vi.fn(),
    getSelectedChannels: vi.fn(),
    selectChannelsForAnalysis: vi.fn(),
    analyzeChannel: vi.fn(),
  },
  ResourceType: {
    SLACK_CHANNEL: 'slack_channel',
    SLACK_USER: 'slack_user',
  },
  IntegrationType: {
    SLACK: 'slack',
  },
}));

vi.mock('../../context/useAuth', () => ({
  default: () => ({
    session: { user: { id: 'test-user' } },
    teamContext: {
      currentTeamId: 'team-1',
    },
  }),
}));

// Test component to access the hooks
const TestHookComponent = ({ callback }: { callback: () => void }) => {
  callback();
  return null;
};

// Mock AuthProvider wrapper
const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};

describe('IntegrationContext Channel Selection Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock service responses
    const mockChannels = [
      {
        id: 'channel-1',
        resource_type: ResourceType.SLACK_CHANNEL,
        name: 'general',
        external_id: 'C12345',
        integration_id: 'test-int-1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
      {
        id: 'channel-2',
        resource_type: ResourceType.SLACK_CHANNEL,
        name: 'random',
        external_id: 'C67890',
        integration_id: 'test-int-1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
    ];
    
    const mockSuccess = {
      status: 'success',
      message: 'Channels updated successfully',
    };
    
    const mockAnalysisSuccess = {
      status: 'success',
      analysis_id: 'analysis-123',
    };
    
    vi.mocked(integrationService.getSelectedChannels).mockResolvedValue(mockChannels);
    vi.mocked(integrationService.selectChannelsForAnalysis).mockResolvedValue(mockSuccess);
    vi.mocked(integrationService.analyzeChannel).mockResolvedValue(mockAnalysisSuccess);
    vi.mocked(integrationService.isApiError).mockImplementation(() => false);
  });

  it('fetches selected channels successfully', async () => {
    let hookResult: ReturnType<typeof useIntegration> | undefined;
    
    await act(async () => {
      render(
        <MockAuthProvider>
          <IntegrationProvider>
            <TestHookComponent
              callback={() => {
                hookResult = useIntegration();
              }}
            />
          </IntegrationProvider>
        </MockAuthProvider>
      );
    });
    
    expect(hookResult).toBeDefined();
    expect(hookResult?.fetchSelectedChannels).toBeDefined();
    
    await act(async () => {
      await hookResult?.fetchSelectedChannels('test-int-1');
    });
    
    // Verify API was called correctly
    expect(integrationService.getSelectedChannels).toHaveBeenCalledWith('test-int-1');
    
    // Verify state was updated
    expect(hookResult?.selectedChannels).toHaveLength(2);
    expect(hookResult?.selectedChannels[0].name).toBe('general');
    expect(hookResult?.loadingChannelSelection).toBe(false);
  });
  
  it('selects channels for analysis', async () => {
    let hookResult: ReturnType<typeof useIntegration> | undefined;
    
    await act(async () => {
      render(
        <MockAuthProvider>
          <IntegrationProvider>
            <TestHookComponent
              callback={() => {
                hookResult = useIntegration();
              }}
            />
          </IntegrationProvider>
        </MockAuthProvider>
      );
    });
    
    // Call the function to select channels
    let result: boolean | undefined;
    await act(async () => {
      result = await hookResult?.selectChannelsForAnalysis('test-int-1', ['channel-1', 'channel-2']);
    });
    
    // Verify API was called correctly
    expect(integrationService.selectChannelsForAnalysis).toHaveBeenCalledWith(
      'test-int-1',
      {
        channel_ids: ['channel-1', 'channel-2'],
        for_analysis: true,
      }
    );
    
    // Verify it called getSelectedChannels to refresh the list
    expect(integrationService.getSelectedChannels).toHaveBeenCalledWith('test-int-1');
    
    // Verify the result
    expect(result).toBe(true);
  });
  
  it('deselects channels from analysis', async () => {
    let hookResult: ReturnType<typeof useIntegration> | undefined;
    
    await act(async () => {
      render(
        <MockAuthProvider>
          <IntegrationProvider>
            <TestHookComponent
              callback={() => {
                hookResult = useIntegration();
              }}
            />
          </IntegrationProvider>
        </MockAuthProvider>
      );
    });
    
    // Call the function to deselect channels
    let result: boolean | undefined;
    await act(async () => {
      result = await hookResult?.deselectChannelsForAnalysis('test-int-1', ['channel-2']);
    });
    
    // Verify API was called correctly with for_analysis=false
    expect(integrationService.selectChannelsForAnalysis).toHaveBeenCalledWith(
      'test-int-1',
      {
        channel_ids: ['channel-2'],
        for_analysis: false,
      }
    );
    
    // Verify it called getSelectedChannels to refresh the list
    expect(integrationService.getSelectedChannels).toHaveBeenCalledWith('test-int-1');
    
    // Verify the result
    expect(result).toBe(true);
  });
  
  it('checks if a channel is selected for analysis', async () => {
    let hookResult: ReturnType<typeof useIntegration> | undefined;
    
    await act(async () => {
      render(
        <MockAuthProvider>
          <IntegrationProvider>
            <TestHookComponent
              callback={() => {
                hookResult = useIntegration();
              }}
            />
          </IntegrationProvider>
        </MockAuthProvider>
      );
    });
    
    // Load selected channels first
    await act(async () => {
      await hookResult?.fetchSelectedChannels('test-int-1');
    });
    
    // Check using the function
    expect(hookResult?.isChannelSelectedForAnalysis('channel-1')).toBe(true);
    expect(hookResult?.isChannelSelectedForAnalysis('channel-2')).toBe(true);
    expect(hookResult?.isChannelSelectedForAnalysis('non-existent')).toBe(false);
    
    // It should also match by external_id
    expect(hookResult?.isChannelSelectedForAnalysis('C12345')).toBe(true);
  });
  
  it('handles errors when selecting channels', async () => {
    // Save original implementations
    const originalSelectChannelsImplementation = vi.mocked(integrationService.selectChannelsForAnalysis).getMockImplementation();
    const originalIsApiErrorImplementation = vi.mocked(integrationService.isApiError).getMockImplementation();
    
    // Mock service to return an error
    vi.mocked(integrationService.selectChannelsForAnalysis).mockResolvedValueOnce({
      status: 400,
      message: 'Error selecting channels',
    });
    
    // Mock isApiError to identify this response as an error
    vi.mocked(integrationService.isApiError).mockImplementation(() => true);
    
    let hookResult: ReturnType<typeof useIntegration> | undefined;
    
    await act(async () => {
      render(
        <MockAuthProvider>
          <IntegrationProvider>
            <TestHookComponent
              callback={() => {
                hookResult = useIntegration();
              }}
            />
          </IntegrationProvider>
        </MockAuthProvider>
      );
    });
    
    // Call the function that should fail
    let result: boolean | undefined;
    await act(async () => {
      result = await hookResult?.selectChannelsForAnalysis('test-int-1', ['channel-1']);
    });
    
    // Verify the result is false
    expect(result).toBe(false);
    
    // Verify error state is set
    expect(hookResult?.channelSelectionError).toBeDefined();
    
    // Try clearing the error
    await act(async () => {
      hookResult?.clearChannelSelectionError();
    });
    
    // Verify error is cleared
    expect(hookResult?.channelSelectionError).toBeNull();
    
    // Restore original implementations
    if (originalSelectChannelsImplementation) {
      vi.mocked(integrationService.selectChannelsForAnalysis).mockImplementation(originalSelectChannelsImplementation);
    }
    if (originalIsApiErrorImplementation) {
      vi.mocked(integrationService.isApiError).mockImplementation(originalIsApiErrorImplementation);
    }
  });
  
  it('runs channel analysis', async () => {
    let hookResult: ReturnType<typeof useIntegration> | undefined;
    
    await act(async () => {
      render(
        <MockAuthProvider>
          <IntegrationProvider>
            <TestHookComponent
              callback={() => {
                hookResult = useIntegration();
              }}
            />
          </IntegrationProvider>
        </MockAuthProvider>
      );
    });
    
    // Prepare analysis options
    const analysisOptions = {
      start_date: '2023-01-01',
      end_date: '2023-01-31',
      include_threads: true,
    };
    
    // Call the function
    let result;
    await act(async () => {
      result = await hookResult?.analyzeChannel('test-int-1', 'channel-1', analysisOptions);
    });
    
    // Verify API was called correctly
    expect(integrationService.analyzeChannel).toHaveBeenCalledWith(
      'test-int-1',
      'channel-1',
      analysisOptions
    );
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result?.status).toBe('success');
    expect(result?.analysis_id).toBe('analysis-123');
  });
});