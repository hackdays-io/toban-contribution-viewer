import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import integrationService, { 
  Integration, 
  IntegrationType, 
  IntegrationStatus, 
  ServiceResource,
  IntegrationShare,
  ShareLevel,
  AccessLevel,
  ApiError,
  ResourceType,
  CreateSlackIntegrationRequest
} from '../../lib/integrationService';
import { supabase } from '../../lib/supabase';

// Mock the supabase module
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    }
  }
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Integration API Service', () => {
  const mockTeamId = '123e4567-e89b-12d3-a456-426614174000';
  const mockIntegrationId = '123e4567-e89b-12d3-a456-426614174001';
  const mockResourceId = '123e4567-e89b-12d3-a456-426614174002';
  
  const mockIntegration: Integration = {
    id: mockIntegrationId,
    name: 'Test Integration',
    description: 'Test Description',
    service_type: IntegrationType.SLACK,
    status: IntegrationStatus.ACTIVE,
    metadata: { test: 'data' },
    owner_team: {
      id: mockTeamId,
      name: 'Test Team',
      slug: 'test-team'
    },
    created_by: {
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User'
    },
    created_at: '2025-04-15T12:00:00Z',
    updated_at: '2025-04-15T12:00:00Z'
  };
  
  const mockResources: ServiceResource[] = [
    {
      id: mockResourceId,
      integration_id: mockIntegrationId,
      resource_type: ResourceType.SLACK_CHANNEL,
      external_id: 'C12345',
      name: 'general',
      metadata: { topic: 'General discussions' },
      created_at: '2025-04-15T12:00:00Z',
      updated_at: '2025-04-15T12:00:00Z'
    }
  ];

  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
    
    // Set up supabase auth mock for each test
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token'
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to let async code process
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  describe('getAuthHeaders', () => {
    it('should include the auth token in headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockIntegration])
      });

      // Request the integrations
      const promise = integrationService.getIntegrations(mockTeamId);
      
      // Wait for promises to resolve
      await flushPromises();
      
      // Check the headers used in the fetch call
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
      
      // Verify supabase getSession was called
      expect(supabase.auth.getSession).toHaveBeenCalled();
      
      // Await the promise to complete the test
      await promise;
    });
  });

  describe('getIntegrations', () => {
    it('should fetch integrations successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockIntegration])
      });

      // Start the request
      const resultPromise = integrationService.getIntegrations(mockTeamId);
      
      // Wait for promises to resolve
      await flushPromises();
      
      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations?team_id=${mockTeamId}`),
        expect.any(Object)
      );
      
      // Check the result
      const result = await resultPromise;
      expect(result).toEqual([mockIntegration]);
    });

    it('should handle error when fetching integrations', async () => {
      const errorResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      };
      
      // Need to use mockImplementationOnce for errorResponse to be properly
      // available to handleError method
      mockFetch.mockImplementationOnce(() => Promise.resolve(errorResponse));

      // Start the request
      const resultPromise = integrationService.getIntegrations(mockTeamId);
      
      // Wait for promises to resolve
      await flushPromises();
      
      // Check the result
      const result = await resultPromise;
      expect(result).toEqual({
        status: 403,
        message: 'Forbidden'
      });
    });

    it('should include service type when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockIntegration])
      });

      // Start the request
      const resultPromise = integrationService.getIntegrations(mockTeamId, IntegrationType.SLACK);
      
      // Wait for promises to resolve
      await flushPromises();
      
      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`team_id=${mockTeamId}&service_type=${IntegrationType.SLACK}`),
        expect.any(Object)
      );
      
      // Complete the test
      await resultPromise;
    });
  });

  describe('getIntegration', () => {
    it('should fetch a single integration by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegration)
      });

      const result = await integrationService.getIntegration(mockIntegrationId);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}`),
        expect.any(Object)
      );
      
      expect(result).toEqual(mockIntegration);
    });

    it('should handle error when fetching integration', async () => {
      const errorResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
      
      mockFetch.mockImplementationOnce(() => Promise.resolve(errorResponse));

      // Start the request
      const resultPromise = integrationService.getIntegration(mockIntegrationId);
      
      // Wait for promises to resolve
      await flushPromises();
      
      // Check the result
      const result = await resultPromise;
      expect(result).toEqual({
        status: 404,
        message: 'Not Found'
      });
    });
  });

  describe('createIntegration', () => {
    it('should create an integration successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegration)
      });

      const createData = {
        name: 'Test Integration',
        service_type: IntegrationType.SLACK,
        description: 'Test Description',
        team_id: mockTeamId
      };
      
      const result = await integrationService.createIntegration(createData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/integrations'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createData)
        })
      );
      
      expect(result).toEqual(mockIntegration);
    });

    it('should handle error when creating integration', async () => {
      const errorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      };
      
      mockFetch.mockImplementationOnce(() => Promise.resolve(errorResponse));

      const createData = {
        name: 'Test Integration',
        service_type: IntegrationType.SLACK,
        team_id: mockTeamId
      };
      
      // Start the request
      const resultPromise = integrationService.createIntegration(createData);
      
      // Wait for promises to resolve
      await flushPromises();
      
      // Check the result
      const result = await resultPromise;
      expect(result).toEqual({
        status: 400,
        message: 'Bad Request'
      });
    });
  });

  describe('updateIntegration', () => {
    it('should update an integration successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegration)
      });

      const updateData = {
        name: 'Updated Integration Name',
        status: IntegrationStatus.DISCONNECTED
      };
      
      const result = await integrationService.updateIntegration(mockIntegrationId, updateData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}`),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
      );
      
      expect(result).toEqual(mockIntegration);
    });
  });

  describe('getResources', () => {
    it('should fetch resources for an integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResources)
      });
      
      const result = await integrationService.getResources(mockIntegrationId);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}/resources`),
        expect.any(Object)
      );
      
      expect(result).toEqual(mockResources);
    });

    it('should include resource type filters when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResources)
      });
      
      await integrationService.getResources(
        mockIntegrationId, 
        [ResourceType.SLACK_CHANNEL, ResourceType.SLACK_USER]
      );
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('resource_type=slack_channel&resource_type=slack_user'),
        expect.any(Object)
      );
    });
  });

  describe('syncResources', () => {
    it('should sync resources successfully', async () => {
      const syncResponse = {
        status: 'success',
        message: 'Resources synced successfully',
        synced: {
          channels: 10,
          users: 20
        }
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(syncResponse)
      });
      
      const result = await integrationService.syncResources(mockIntegrationId);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}/sync`),
        expect.objectContaining({
          method: 'POST'
        })
      );
      
      expect(result).toEqual(syncResponse);
    });
  });

  describe('shareIntegration', () => {
    it('should share an integration with another team', async () => {
      const shareResponse: IntegrationShare = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        integration_id: mockIntegrationId,
        team_id: 'target-team-id',
        share_level: ShareLevel.READ_ONLY,
        status: 'active',
        shared_by: {
          id: 'user123',
          name: 'Test User'
        },
        team: {
          id: 'target-team-id',
          name: 'Target Team',
          slug: 'target-team'
        },
        created_at: '2025-04-15T12:00:00Z',
        updated_at: '2025-04-15T12:00:00Z'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(shareResponse)
      });
      
      const shareData = {
        team_id: 'target-team-id',
        share_level: ShareLevel.READ_ONLY
      };
      
      const result = await integrationService.shareIntegration(mockIntegrationId, shareData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}/share`),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(shareData)
        })
      );
      
      expect(result).toEqual(shareResponse);
    });
  });

  describe('revokeShare', () => {
    it('should revoke an integration share', async () => {
      const revokeResponse = {
        status: 'success',
        message: 'Share revoked successfully'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(revokeResponse)
      });
      
      const targetTeamId = 'target-team-id';
      const result = await integrationService.revokeShare(mockIntegrationId, targetTeamId);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}/share/${targetTeamId}`),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
      
      expect(result).toEqual(revokeResponse);
    });
  });

  describe('grantResourceAccess', () => {
    it('should grant access to a resource', async () => {
      const accessResponse = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        resource_id: mockResourceId,
        team_id: 'target-team-id',
        access_level: AccessLevel.READ,
        granted_by: {
          id: 'user123',
          name: 'Test User'
        },
        team: {
          id: 'target-team-id',
          name: 'Target Team',
          slug: 'target-team'
        },
        created_at: '2025-04-15T12:00:00Z',
        updated_at: '2025-04-15T12:00:00Z'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(accessResponse)
      });
      
      const accessData = {
        team_id: 'target-team-id',
        access_level: AccessLevel.READ
      };
      
      const result = await integrationService.grantResourceAccess(
        mockIntegrationId, 
        mockResourceId, 
        accessData
      );
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/integrations/${mockIntegrationId}/resources/${mockResourceId}/access`),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(accessData)
        })
      );
      
      expect(result).toEqual(accessResponse);
    });
  });

  describe('isApiError', () => {
    it('should correctly identify API errors', () => {
      const apiError: ApiError = {
        status: 404,
        message: 'Not Found'
      };
      
      expect(integrationService.isApiError(apiError)).toBe(true);
      expect(integrationService.isApiError(null)).toBe(false);
      expect(integrationService.isApiError({})).toBe(false);
      expect(integrationService.isApiError({ status: 404 })).toBe(false);
      expect(integrationService.isApiError({ message: 'Error' })).toBe(false);
      expect(integrationService.isApiError(mockIntegration)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await integrationService.getIntegrations(mockTeamId);
      
      expect(result).toEqual({
        status: 500,
        message: 'Network error'
      });
    });

    it('should handle non-Response errors', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error');
      
      const result = await integrationService.getIntegrations(mockTeamId);
      
      expect(result).toEqual({
        status: 500,
        message: 'Failed to fetch integrations'
      });
    });
  });

  describe('createSlackIntegration', () => {
    it('should create a Slack integration using OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegration)
      });
      
      const slackData: CreateSlackIntegrationRequest = {
        name: 'Test Slack Integration',
        service_type: IntegrationType.SLACK,
        team_id: mockTeamId,
        code: 'oauth-code',
        redirect_uri: 'http://localhost:3000/callback'
      };
      
      const result = await integrationService.createSlackIntegration(slackData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/integrations/slack'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(slackData)
        })
      );
      
      expect(result).toEqual(mockIntegration);
    });
  });
});
