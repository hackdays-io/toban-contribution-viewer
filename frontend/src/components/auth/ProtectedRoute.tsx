import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Center, Spinner } from '@chakra-ui/react'
import useAuth from '../../context/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Check if we're in development mode with placeholder auth values
  const isDevelopmentEnv = process.env.NODE_ENV === 'development'
  const isNgrokOrLocalhost =
    window.location.hostname.includes('ngrok') ||
    window.location.hostname === 'localhost'
  const isMockEnvironment = isDevelopmentEnv && isNgrokOrLocalhost

  // Show loading spinner while authentication state is being checked
  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" thickness="4px" color="blue.500" />
      </Center>
    )
  }

  // In development with mock auth, allow access without authentication
  if (isMockEnvironment && !user) {
    console.info(
      'Bypassing authentication in development environment. This is normal with placeholder credentials.'
    )
    return <>{children}</>
  }

  // If not authenticated in production, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // User is authenticated, render the protected content
  return <>{children}</>
}

export default ProtectedRoute
