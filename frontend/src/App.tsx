import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'

// Auth
import { AuthProvider } from './context/AuthContext'
import Login from './components/auth/Login'
import SignUp from './components/auth/SignUp'
import AuthCallback from './components/auth/AuthCallback'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Integrations
import { IntegrationProvider } from './context/IntegrationContext'

// Layout
import { AppLayout } from './components/layout'

// Pages
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'

// Removed legacy Slack imports

// Team Pages
import { TeamsPage, TeamDetailPage, TeamMembersPage } from './pages/team'

// Integration Pages
import {
  IntegrationsPage,
  IntegrationDetailPage,
  IntegrationConnectPage,
} from './pages/integration'
import { SlackOAuthCallback } from './components/integration/oauth'

// Profile Pages
import { ProfilePage, EditProfilePage } from './pages/profile'

// Create a default theme
const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
})

function App() {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <IntegrationProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected routes */}
              {/* Public callback routes - legacy Slack callbacks removed */}

              {/* Dashboard routes - all wrapped with AppLayout */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Team routes */}
              <Route
                path="/dashboard/teams"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/teams/:teamId"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamDetailPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/teams/:teamId/members"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamMembersPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Slack routes - removed as they're now part of the integration system */}

              {/* Analytics routes */}
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Analytics />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              {/* Removed legacy Slack analytics routes */}

              {/* Integrations routes */}
              <Route
                path="/dashboard/integrations"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <IntegrationsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/:integrationId"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <IntegrationDetailPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/:integrationId/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <IntegrationDetailPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/connect"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <IntegrationConnectPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/connect/:serviceType"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <IntegrationConnectPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/oauth/slack"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackOAuthCallback />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Profile routes */}
              <Route
                path="/dashboard/profile"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ProfilePage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/profile/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <EditProfilePage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </IntegrationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  )
}

export default App
