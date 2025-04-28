import { useContext } from 'react'
import { UserCacheContext } from './SlackUserCacheContext'

// Hook to use the UserCache context
export const useUserCache = () => {
  const context = useContext(UserCacheContext)
  if (context === undefined) {
    throw new Error('useUserCache must be used within a SlackUserCacheProvider')
  }
  return context
}
