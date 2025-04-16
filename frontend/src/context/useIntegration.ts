import { useContext } from 'react'
import IntegrationContext from './IntegrationContext'

/**
 * Hook to access the integration context
 *
 * @returns The integration context value
 * @throws Error if used outside of IntegrationProvider
 */
const useIntegration = () => {
  const context = useContext(IntegrationContext)

  if (context === undefined) {
    throw new Error('useIntegration must be used within an IntegrationProvider')
  }

  return context
}

export default useIntegration
