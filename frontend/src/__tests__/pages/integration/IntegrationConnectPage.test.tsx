import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import IntegrationConnectPage from '../../../pages/integration/IntegrationConnectPage'

// Mock useNavigate
const mockNavigate = vi.fn()

// Mock the react-router-dom module
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('IntegrationConnectPage', () => {
  const renderComponent = () => {
    return render(
      <ChakraProvider>
        <BrowserRouter>
          <IntegrationConnectPage />
        </BrowserRouter>
      </ChakraProvider>
    )
  }

  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders the page title and description', () => {
    renderComponent()

    expect(screen.getByText('Connect an Integration')).toBeInTheDocument()
    expect(
      screen.getByText('Choose an integration to connect to your team')
    ).toBeInTheDocument()
  })

  it('displays all integration options', () => {
    renderComponent()

    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Notion')).toBeInTheDocument()
    expect(screen.getByText('Discord')).toBeInTheDocument()
  })

  it('navigates to the correct route when clicking on an integration', () => {
    renderComponent()

    // Click the Slack integration
    fireEvent.click(screen.getByText('Connect Slack'))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/slack/connect')

    // Click the GitHub integration
    fireEvent.click(screen.getByText('Connect GitHub'))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/github/connect')
  })

  it('displays breadcrumb navigation', () => {
    renderComponent()

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
  })

  it('shows the request integration section', () => {
    renderComponent()

    expect(
      screen.getByText("Don't see the integration you need?")
    ).toBeInTheDocument()
    expect(screen.getByText('Request Integration')).toBeInTheDocument()
  })
})
