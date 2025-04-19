import React, { createContext, useState, useEffect, useCallback } from 'react'
import useAuth from './useAuth'
import integrationService, {
  Integration,
  IntegrationType,
  ServiceResource,
  IntegrationShare,
  ApiError,
  CreateIntegrationRequest,
  CreateSlackIntegrationRequest,
  UpdateIntegrationRequest,
  IntegrationShareRequest,
  ResourceType,
  ResourceAccessRequest,
} from '../lib/integrationService'

/**
 * Integration state for the context
 */
interface IntegrationState {
  // Collections of integrations
  integrations: Integration[]
  teamIntegrations: Record<string, Integration[]>

  // Currently selected integration
  currentIntegration: Integration | null
  currentResources: ServiceResource[]

  // Loading states
  loading: boolean
  loadingResources: boolean

  // Error states
  error: ApiError | Error | null
  resourceError: ApiError | Error | null
}

/**
 * Integration context interface
 */
interface IntegrationContextType extends IntegrationState {
  // CRUD operations
  fetchIntegrations: (
    teamId: string,
    serviceType?: IntegrationType
  ) => Promise<void>
  fetchIntegration: (integrationId: string) => Promise<void>
  createIntegration: (
    data: CreateIntegrationRequest
  ) => Promise<Integration | null>
  createSlackIntegration: (
    data: CreateSlackIntegrationRequest
  ) => Promise<Integration | null>
  updateIntegration: (
    integrationId: string,
    data: UpdateIntegrationRequest
  ) => Promise<Integration | null>

  // Resource operations
  fetchResources: (
    integrationId: string,
    resourceTypes?: ResourceType[]
  ) => Promise<void>
  syncResources: (
    integrationId: string,
    resourceTypes?: string[]
  ) => Promise<boolean>

  // Sharing operations
  shareIntegration: (
    integrationId: string,
    data: IntegrationShareRequest
  ) => Promise<IntegrationShare | null>
  revokeShare: (integrationId: string, teamId: string) => Promise<boolean>
  grantResourceAccess: (
    integrationId: string,
    resourceId: string,
    data: ResourceAccessRequest
  ) => Promise<boolean>

  // Selection
  selectIntegration: (integrationId: string | null) => void

  // Error handling
  clearErrors: () => void
}

// Create context with default values
const IntegrationContext = createContext<IntegrationContextType>({
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
  fetchIntegrations: async () => {},
  fetchIntegration: async () => {},
  createIntegration: async () => null,
  createSlackIntegration: async () => null,
  updateIntegration: async () => null,

  // Resource operations
  fetchResources: async () => {},
  syncResources: async () => false,

  // Sharing operations
  shareIntegration: async () => null,
  revokeShare: async () => false,
  grantResourceAccess: async () => false,

  // Selection
  selectIntegration: () => {},

  // Error handling
  clearErrors: () => {},
})

/**
 * Integration Provider Component
 */
export const IntegrationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { session, teamContext } = useAuth()
  const [state, setState] = useState<IntegrationState>({
    integrations: [],
    teamIntegrations: {},
    currentIntegration: null,
    currentResources: [],
    loading: false,
    loadingResources: false,
    error: null,
    resourceError: null,
  })

  /**
   * Clear all error states
   */
  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      resourceError: null,
    }))
  }, [])

  /**
   * Fetch all integrations for a team
   */
  const fetchIntegrations = useCallback(
    async (teamId: string, serviceType?: IntegrationType) => {
      if (!session || !teamId) return

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.getIntegrations(
          teamId,
          serviceType
        )

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return
        }

        setState((prev) => {
          // Update team integrations map
          const updatedTeamIntegrations = {
            ...prev.teamIntegrations,
            [teamId]: result,
          }

          // If this is the current team, update the main integrations list too
          const integrations =
            teamId === teamContext.currentTeamId ? result : prev.integrations

          return {
            ...prev,
            integrations,
            teamIntegrations: updatedTeamIntegrations,
            loading: false,
          }
        })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to fetch integrations'),
        }))
      }
    },
    [session, teamContext?.currentTeamId]
  )

  /**
   * Fetch a single integration by ID
   */
  const fetchIntegration = useCallback(
    async (integrationId: string) => {
      if (!session || !integrationId) return

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.getIntegration(integrationId)

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return
        }

        // Always update the current integration
        setState((prev) => ({
          ...prev,
          currentIntegration: result,
          loading: false,
        }))

        // Update the integrations array if the integration is already there
        setState((prev) => {
          const integrationIndex = prev.integrations.findIndex(
            (i) => i.id === integrationId
          )
          if (integrationIndex === -1) return prev

          const updatedIntegrations = [...prev.integrations]
          updatedIntegrations[integrationIndex] = result

          // Also update in the team integrations map
          const teamId = result.owner_team.id
          const updatedTeamIntegrations = { ...prev.teamIntegrations }

          if (updatedTeamIntegrations[teamId]) {
            const teamIntIndex = updatedTeamIntegrations[teamId].findIndex(
              (i) => i.id === integrationId
            )
            if (teamIntIndex !== -1) {
              const updatedTeamInts = [...updatedTeamIntegrations[teamId]]
              updatedTeamInts[teamIntIndex] = result
              updatedTeamIntegrations[teamId] = updatedTeamInts
            }
          }

          return {
            ...prev,
            integrations: updatedIntegrations,
            teamIntegrations: updatedTeamIntegrations,
          }
        })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to fetch integration'),
        }))
      }
    },
    [session]
  )

  /**
   * Create a new integration
   */
  const createIntegration = useCallback(
    async (data: CreateIntegrationRequest): Promise<Integration | null> => {
      if (!session) return null

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.createIntegration(data)

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return null
        }

        // Update state with the new integration
        setState((prev) => {
          // Add to the appropriate lists
          const integrations =
            data.team_id === teamContext?.currentTeamId
              ? [...prev.integrations, result]
              : prev.integrations

          // Add to team integrations map
          const teamIntegrations = { ...prev.teamIntegrations }
          if (teamIntegrations[data.team_id]) {
            teamIntegrations[data.team_id] = [
              ...teamIntegrations[data.team_id],
              result,
            ]
          } else {
            teamIntegrations[data.team_id] = [result]
          }

          return {
            ...prev,
            integrations,
            teamIntegrations,
            loading: false,
          }
        })

        return result
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to create integration'),
        }))
        return null
      }
    },
    [session, teamContext?.currentTeamId]
  )

  /**
   * Create a new Slack integration via OAuth
   */
  const createSlackIntegration = useCallback(
    async (
      data: CreateSlackIntegrationRequest
    ): Promise<Integration | null> => {
      if (!session) return null

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.createSlackIntegration(data)

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return null
        }

        // Update state with the new integration
        setState((prev) => {
          // Add to the appropriate lists
          const integrations =
            data.team_id === teamContext?.currentTeamId
              ? [...prev.integrations, result]
              : prev.integrations

          // Add to team integrations map
          const teamIntegrations = { ...prev.teamIntegrations }
          if (teamIntegrations[data.team_id]) {
            teamIntegrations[data.team_id] = [
              ...teamIntegrations[data.team_id],
              result,
            ]
          } else {
            teamIntegrations[data.team_id] = [result]
          }

          return {
            ...prev,
            integrations,
            teamIntegrations,
            loading: false,
          }
        })

        return result
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to create Slack integration'),
        }))
        return null
      }
    },
    [session, teamContext?.currentTeamId]
  )

  /**
   * Update an integration
   */
  const updateIntegration = useCallback(
    async (
      integrationId: string,
      data: UpdateIntegrationRequest
    ): Promise<Integration | null> => {
      if (!session || !integrationId) return null

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.updateIntegration(
          integrationId,
          data
        )

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return null
        }

        // Update the current integration if it's the one being edited
        if (state.currentIntegration?.id === integrationId) {
          setState((prev) => ({
            ...prev,
            currentIntegration: result,
          }))
        }

        // Update the integration in all relevant lists
        setState((prev) => {
          // Update in main list if present
          const updatedIntegrations = prev.integrations.map((integration) =>
            integration.id === integrationId ? result : integration
          )

          // Update in team integrations map
          const teamId = result.owner_team.id
          const updatedTeamIntegrations = { ...prev.teamIntegrations }

          if (updatedTeamIntegrations[teamId]) {
            updatedTeamIntegrations[teamId] = updatedTeamIntegrations[
              teamId
            ].map((integration) =>
              integration.id === integrationId ? result : integration
            )
          }

          return {
            ...prev,
            integrations: updatedIntegrations,
            teamIntegrations: updatedTeamIntegrations,
            loading: false,
          }
        })

        return result
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to update integration'),
        }))
        return null
      }
    },
    [session, state.currentIntegration?.id]
  )

  /**
   * Fetch resources for an integration
   */
  const fetchResources = useCallback(
    async (integrationId: string, resourceTypes?: ResourceType[]) => {
      if (!session || !integrationId) return

      setState((prev) => ({
        ...prev,
        loadingResources: true,
        resourceError: null,
      }))

      try {
        const result = await integrationService.getResources(
          integrationId,
          resourceTypes
        )

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loadingResources: false,
            resourceError: result,
          }))
          return
        }

        setState((prev) => ({
          ...prev,
          currentResources: result,
          loadingResources: false,
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loadingResources: false,
          resourceError:
            error instanceof Error
              ? error
              : new Error('Failed to fetch resources'),
        }))
      }
    },
    [session]
  )

  /**
   * Sync resources for an integration
   */
  const syncResources = useCallback(
    async (
      integrationId: string,
      resourceTypes?: string[]
    ): Promise<boolean> => {
      if (!session || !integrationId) return false

      // Clear previous errors and set loading state
      setState((prev) => ({
        ...prev,
        loadingResources: true,
        resourceError: null,
      }))

      try {
        console.log(`Syncing resources for integration ${integrationId}`, {
          resourceTypes,
        })

        const result = await integrationService.syncResources(
          integrationId,
          resourceTypes
        )

        console.log('Sync result received:', result)

        // Check if the result is an API error
        if (integrationService.isApiError(result)) {
          console.error('API error during sync:', result)
          setState((prev) => ({
            ...prev,
            loadingResources: false,
            resourceError: result,
          }))
          return false
        }

        // Check if the result has a status field indicating success
        if (
          result &&
          typeof result === 'object' &&
          result.status === 'success'
        ) {
          console.log('Sync successful, refreshing resources')
          // Refetch resources to get the updated list
          await fetchResources(integrationId)

          // Make sure to set loadingResources to false
          setState((prev) => ({
            ...prev,
            loadingResources: false,
          }))

          return true
        } else {
          // Handle case where result is not an error but also doesn't have status='success'
          console.warn('Sync response is not marked as success:', result)
          const errorMsg =
            result && typeof result === 'object' && result.message
              ? String(result.message)
              : 'Failed to sync resources'

          setState((prev) => ({
            ...prev,
            loadingResources: false,
            resourceError: new Error(errorMsg),
          }))
          return false
        }
      } catch (error) {
        // Handle exceptions during sync
        console.error('Exception during sync:', error)
        setState((prev) => ({
          ...prev,
          loadingResources: false,
          resourceError:
            error instanceof Error
              ? error
              : new Error('Failed to sync resources'),
        }))
        return false
      }
    },
    [session, fetchResources]
  )

  /**
   * Share an integration with another team
   */
  const shareIntegration = useCallback(
    async (
      integrationId: string,
      data: IntegrationShareRequest
    ): Promise<IntegrationShare | null> => {
      if (!session || !integrationId) return null

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.shareIntegration(
          integrationId,
          data
        )

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return null
        }

        // Refetch the integration to update its shared_with data
        await fetchIntegration(integrationId)

        setState((prev) => ({ ...prev, loading: false }))
        return result
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to share integration'),
        }))
        return null
      }
    },
    [session, fetchIntegration]
  )

  /**
   * Revoke an integration share
   */
  const revokeShare = useCallback(
    async (integrationId: string, teamId: string): Promise<boolean> => {
      if (!session || !integrationId || !teamId) return false

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const result = await integrationService.revokeShare(
          integrationId,
          teamId
        )

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result,
          }))
          return false
        }

        // Refetch the integration to update its shared_with data
        await fetchIntegration(integrationId)

        setState((prev) => ({ ...prev, loading: false }))
        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to revoke share'),
        }))
        return false
      }
    },
    [session, fetchIntegration]
  )

  /**
   * Grant access to a resource
   */
  const grantResourceAccess = useCallback(
    async (
      integrationId: string,
      resourceId: string,
      data: ResourceAccessRequest
    ): Promise<boolean> => {
      if (!session || !integrationId || !resourceId) return false

      setState((prev) => ({
        ...prev,
        loadingResources: true,
        resourceError: null,
      }))

      try {
        const result = await integrationService.grantResourceAccess(
          integrationId,
          resourceId,
          data
        )

        if (integrationService.isApiError(result)) {
          setState((prev) => ({
            ...prev,
            loadingResources: false,
            resourceError: result,
          }))
          return false
        }

        // Refetch resources to get the updated list
        await fetchResources(integrationId)
        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loadingResources: false,
          resourceError:
            error instanceof Error
              ? error
              : new Error('Failed to grant resource access'),
        }))
        return false
      }
    },
    [session, fetchResources]
  )

  /**
   * Select an integration by ID
   */
  const selectIntegration = useCallback(
    (integrationId: string | null) => {
      if (!integrationId) {
        setState((prev) => ({
          ...prev,
          currentIntegration: null,
          currentResources: [],
        }))
        return
      }

      // Find the integration in our existing data
      const integration = state.integrations.find((i) => i.id === integrationId)

      if (integration) {
        setState((prev) => ({
          ...prev,
          currentIntegration: integration,
        }))

        // Fetch resources for this integration
        fetchResources(integrationId)
      } else {
        // If not found, fetch it from the API
        fetchIntegration(integrationId)
      }
    },
    [state.integrations, fetchIntegration, fetchResources]
  )

  /**
   * Load integrations when the current team changes
   */
  useEffect(() => {
    const currentTeamId = teamContext?.currentTeamId
    if (currentTeamId && session) {
      fetchIntegrations(currentTeamId)
    }
  }, [teamContext?.currentTeamId, session, fetchIntegrations])

  const contextValue: IntegrationContextType = {
    ...state,
    fetchIntegrations,
    fetchIntegration,
    createIntegration,
    createSlackIntegration,
    updateIntegration,
    fetchResources,
    syncResources,
    shareIntegration,
    revokeShare,
    grantResourceAccess,
    selectIntegration,
    clearErrors,
  }

  return (
    <IntegrationContext.Provider value={contextValue}>
      {children}
    </IntegrationContext.Provider>
  )
}

export default IntegrationContext
