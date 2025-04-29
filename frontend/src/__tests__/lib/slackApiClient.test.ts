import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { slackApiClient } from '../../lib/slackApiClient'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const originalConsoleLog = console.log
const originalConsoleError = console.error
console.log = vi.fn()
console.error = vi.fn()

describe('SlackApiClient', () => {
  const mockWorkspaceId = 'workspace-123'
  const mockUserIds = ['U12345', 'U67890', 'U24680']
  
  beforeEach(() => {
    mockFetch.mockClear()
    vi.clearAllMocks()
    
    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
        },
      },
    })
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  afterAll(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })
  
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))
  
  describe('getUsersByIds', () => {
    it('should correctly handle multiple user IDs using URLSearchParams', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { id: '1', slack_id: 'U12345', name: 'user1' },
            { id: '2', slack_id: 'U67890', name: 'user2' },
            { id: '3', slack_id: 'U24680', name: 'user3' },
          ],
        }),
      })
      
      const resultPromise = slackApiClient.getUsersByIds(
        mockWorkspaceId,
        mockUserIds,
        true
      )
      
      await flushPromises()
      
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      const fetchUrl = mockFetch.mock.calls[0][0]
      
      expect(fetchUrl).toContain(`user_ids%5B%5D=${mockUserIds[mockUserIds.length - 1]}`)
      
      expect(fetchUrl).toContain('fetch_from_slack=true')
      
      const result = await resultPromise
      expect(result).toEqual({
        users: [
          { id: '1', slack_id: 'U12345', name: 'user1' },
          { id: '2', slack_id: 'U67890', name: 'user2' },
          { id: '3', slack_id: 'U24680', name: 'user3' },
        ],
      })
    })
    
    it('should handle empty user IDs array', async () => {
      const result = await slackApiClient.getUsersByIds(mockWorkspaceId, [])
      
      expect(mockFetch).not.toHaveBeenCalled()
      expect(result).toEqual({ users: [] })
    })
    
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      const result = await slackApiClient.getUsersByIds(
        mockWorkspaceId,
        mockUserIds
      )
      
      expect(result).toEqual({
        status: 'NETWORK_ERROR',
        message: 'Network Error: Network error',
      })
    })
    
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })
      
      const resultPromise = slackApiClient.getUsersByIds(
        mockWorkspaceId,
        mockUserIds
      )
      
      await flushPromises()
      
      const result = await resultPromise
      expect(result).toEqual({
        status: 403,
        message: 'API Error: 403 Forbidden',
        detail: 'Forbidden',
      })
    })
  })
})
