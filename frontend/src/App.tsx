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

// Slack Pages
import {
  ConnectPage as SlackConnectPage,
  OAuthCallbackPage as SlackOAuthCallbackPage,
  WorkspacesPage as SlackWorkspacesPage,
  ChannelsPage as SlackChannelsPage,
  MessagesPage as SlackMessagesPage,
  AnalyticsPage as SlackAnalyticsPage,
  ChannelAnalysisPage as SlackChannelAnalysisPage,
} from './pages/slack'
import ChannelAnalysisHistoryPage from './pages/slack/ChannelAnalysisHistoryPage'

// Team Pages
import { TeamsPage, TeamDetailPage, TeamMembersPage } from './pages/team'

// Integration Pages
import {
  IntegrationsPage,
  IntegrationDetailPage,
  IntegrationConnectPage,
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

              {/* Slack routes */}
              <Route
                path="/dashboard/slack/workspaces"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackWorkspacesPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
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
              <Route
                path="/dashboard/slack/workspaces/:workspaceId/channels"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackChannelsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/slack/workspaces/:workspaceId"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackWorkspacesPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/slack/workspaces/:workspaceId/channels/:channelId/messages"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackMessagesPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

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
              <Route
                path="/dashboard/analytics/slack"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackAnalyticsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics/slack/channels/:workspaceId/:channelId/analyze"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SlackChannelAnalysisPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics/slack/channels/:workspaceId/:channelId/history"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ChannelAnalysisHistoryPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

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
                path="/dashboard/integrations/:integrationId/channels"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TeamChannelSelectorPage />
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
