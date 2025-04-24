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

// Legacy Slack OAuth Callback is still needed for backward compatibility
import {
  OAuthCallbackPage as SlackOAuthCallbackPage,
  ConnectPage as SlackConnectPage,
} from './pages/slack'

// Note: Workspace-specific analysis has been removed in favor of ResourceAnalysis system

// Team Pages
import { TeamsPage, TeamDetailPage, TeamMembersPage } from './pages/team'

// Integration Pages
import {
  IntegrationsPage,
  IntegrationDetailPage,
  IntegrationConnectPage,
  IntegrationSettingsPage,
  TeamChannelSelectorPage,
  TeamChannelAnalysisPage,
  TeamAnalysisResultPage,
  TeamChannelAnalysisHistoryPage,
  CreateAnalysisPage,
} from './pages/integration'

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
              {/* Public callback route */}
              <Route
                path="/auth/slack/callback"
                element={<SlackOAuthCallbackPage />}
              />

              {/* Slack connect route */}
              <Route
                path="/dashboard/slack/connect"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackConnectPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

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

              {/* Legacy Slack routes removed */}

              {/* Analysis Hub routes */}
              <Route
                path="/dashboard/analysis"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Analytics />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Legacy Analytics routes (for backward compatibility) */}
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

              {/* Create Analysis page */}
              <Route
                path="/dashboard/analysis/create"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CreateAnalysisPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              {/* Legacy Slack analytics routes removed */}

              {/* Workspaces routes (new UI) */}
              <Route
                path="/dashboard/workspaces"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <IntegrationsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Integrations routes (for backward compatibility) */}
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
                      <IntegrationSettingsPage />
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
                path="/dashboard/integrations/:integrationId/channels"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamChannelSelectorPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/:integrationId/channels/:channelId/analyze"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamChannelAnalysisPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/:integrationId/channels/:channelId/analysis/:analysisId"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamAnalysisResultPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations/:integrationId/channels/:channelId/history"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamChannelAnalysisHistoryPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Add route for team/cross-resource analysis results */}
              <Route
                path="/dashboard/integrations/:integrationId/team-analysis/:analysisId"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamAnalysisResultPage />
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
