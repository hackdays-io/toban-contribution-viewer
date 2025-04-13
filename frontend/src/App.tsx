import { ChakraProvider, Container, extendTheme } from '@chakra-ui/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'

// Auth
import { AuthProvider } from './context/AuthContext'
import Login from './components/auth/Login'
import SignUp from './components/auth/SignUp'
import AuthCallback from './components/auth/AuthCallback'
import ProtectedRoute from './components/auth/ProtectedRoute'

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

// Create a default theme
const theme = extendTheme({})

function App() {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <Container maxW="container.xl" py={5}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Slack routes */}
              <Route
                path="/dashboard/slack/workspaces"
                element={
                  <ProtectedRoute>
                    <SlackWorkspacesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/slack/connect"
                element={
                  <ProtectedRoute>
                    <SlackConnectPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/auth/slack/callback"
                element={<SlackOAuthCallbackPage />}
              />
              <Route
                path="/dashboard/slack/workspaces/:workspaceId/channels"
                element={
                  <ProtectedRoute>
                    <SlackChannelsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/slack/workspaces/:workspaceId"
                element={
                  <ProtectedRoute>
                    <SlackWorkspacesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/slack/workspaces/:workspaceId/channels/:channelId/messages"
                element={
                  <ProtectedRoute>
                    <SlackMessagesPage />
                  </ProtectedRoute>
                }
              />

              {/* Analytics routes */}
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics/slack"
                element={
                  <ProtectedRoute>
                    <SlackAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics/slack/channels/:workspaceId/:channelId/analyze"
                element={
                  <ProtectedRoute>
                    <SlackChannelAnalysisPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Container>
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  )
}

export default App
