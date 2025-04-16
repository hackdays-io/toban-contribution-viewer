import { useContext } from 'react'
import IntegrationContext from './IntegrationContext'
import { supabase } from '../lib/supabase'

/**
 * Hook to access the integration context
 *
 * @returns The integration context value
 * @throws Error if used outside of IntegrationProvider
 */
const useIntegration = () => {
  const context = useContext(IntegrationContext)

  if (context === undefined) {
    console.error('Integration context is undefined - authentication may be missing');
    
    // Debug auth state when context is missing
    supabase.auth.getSession().then(({ data }) => {
      console.log('Auth session when integration context is missing:', !!data.session);
      if (data.session) {
        console.log('User:', data.session.user?.email);
        console.log('Token valid until:', new Date(data.session.expires_at * 1000).toISOString());
      }
    }).catch(err => {
      console.error('Error checking auth in useIntegration:', err);
    });
    
    throw new Error('useIntegration must be used within an IntegrationProvider')
  }

  return context
}

export default useIntegration
