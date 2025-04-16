import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import IntegrationDetailPage from '../../../pages/integration/IntegrationDetailPage'
import { IntegrationProvider } from '../../../context/IntegrationContext'
import { AuthProvider } from '../../../context/AuthContext'
import {
  Integration,
  IntegrationType,
  IntegrationStatus,
} from '../../../lib/integrationService'

// Mock the useParams hook from react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({
    integrationId: 'test-integration-id',
  }),
  useNavigate: () => jest.fn(),
}))

// Mock the useIntegration hook and its return values
jest.mock('../../../context/useIntegration', () => ({
  __esModule: true,
  default: () => ({
    currentIntegration: mockIntegration,
    selectIntegration: jest.fn(),
  }),
}))

// Mock integration data
const mockIntegration: Integration = {
  id: 'test-integration-id',
  name: 'Test Integration',
  description: 'This is a test integration',
  service_type: IntegrationType.SLACK,
  status: IntegrationStatus.ACTIVE,
  owner_team: {
    id: 'team-id',
    name: 'Test Team',
    slug: 'test-team',
  },
  created_by: {
    id: 'user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Mock IntegrationDetail component
jest.mock('../../../components/integration/IntegrationDetail', () => {
  return {
    __esModule: true,
    default: ({ integrationId }: { integrationId: string }) => (
      <div data-testid="integration-detail">
        Integration Detail Component with ID: {integrationId}
      </div>
    ),
  }
})

const renderComponent = () => {
  return render(
    <ChakraProvider>
      <BrowserRouter>
        <AuthProvider>
          <IntegrationProvider>
            <Routes>
              <Route path="*" element={<IntegrationDetailPage />} />
            </Routes>
          </IntegrationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  )
}

describe('IntegrationDetailPage', () => {
  it('renders the page title with integration name', () => {
    renderComponent()

    expect(screen.getByText('Test Integration')).toBeInTheDocument()
    expect(
      screen.getByText('View and manage integration details')
    ).toBeInTheDocument()
  })

  it('renders the back button', () => {
    renderComponent()

    expect(screen.getByText('Back to Integrations')).toBeInTheDocument()
  })

  it('renders the IntegrationDetail component with the correct ID', () => {
    renderComponent()

    const detailComponent = screen.getByTestId('integration-detail')
    expect(detailComponent).toBeInTheDocument()
    expect(detailComponent).toHaveTextContent(
      'Integration Detail Component with ID: test-integration-id'
    )
  })
})
