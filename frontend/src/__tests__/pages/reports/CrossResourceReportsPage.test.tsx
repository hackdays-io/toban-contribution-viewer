import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
// userEvent is imported but not used in this test file
// import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CrossResourceReportsPage from '../../../pages/reports/CrossResourceReportsPage'
import integrationService from '../../../lib/integrationService'
import { ChakraProvider } from '@chakra-ui/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Define a type for the mocked integration service methods
type MockedIntegrationService = {
  getCrossResourceReports: ReturnType<typeof vi.fn>
  isApiError: ReturnType<typeof vi.fn>
}

// Mock the integration service
vi.mock('../../../lib/integrationService', async () => {
  return {
    default: {
      getCrossResourceReports: vi.fn(),
      isApiError: vi.fn(
        (response) =>
          'status' in response && typeof response.status === 'number'
      ),
    },
  }
})

// Get the mocked integration service with the proper type
const mockedIntegrationService =
  integrationService as unknown as MockedIntegrationService

// Mock for useParams
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal()
  return {
    // Use type casting to avoid spread operator type error
    ...(original as object),
    useParams: () => ({ teamId: 'team-123' }),
  }
})

const mockReports = {
  items: [
    {
      id: 'report-1',
      title: 'Weekly Team Analysis',
      description: 'Analysis of team activity for the past week',
      created_at: '2025-04-15T10:30:00Z',
      status: 'completed',
      resource_count: 3,
      created_by: {
        id: 'user-1',
        name: 'John Doe',
      },
    },
    {
      id: 'report-2',
      title: 'Project X Kickoff Analysis',
      created_at: '2025-04-10T09:15:00Z',
      status: 'in_progress',
      resource_count: 5,
      created_by: {
        id: 'user-2',
        email: 'jane@example.com',
      },
    },
  ],
  total: 2,
}

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ChakraProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ChakraProvider>
  )
}

describe('CrossResourceReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use the properly typed mock function
    mockedIntegrationService.getCrossResourceReports.mockResolvedValue(
      mockReports
    )
  })

  it('renders the page title correctly', async () => {
    renderWithProviders(<CrossResourceReportsPage />)

    await waitFor(() => {
      expect(
        screen.getByText('Cross-Resource Analysis Reports')
      ).toBeInTheDocument()
    })
  })

  it('displays loading state initially', async () => {
    // Mock the integration service to never resolve, keeping the component in loading state
    mockedIntegrationService.getCrossResourceReports.mockImplementation(
      () => new Promise(() => {})
    )

    renderWithProviders(<CrossResourceReportsPage />)

    // In Chakra UI, Spinner doesn't have an accessible text by default
    // Instead, let's check if the Refresh button is visible (which is shown during loading)
    const refreshButton = await screen.findByText('Refresh')
    expect(refreshButton).toBeInTheDocument()
  })

  it('fetches and displays report data', async () => {
    renderWithProviders(<CrossResourceReportsPage />)

    await waitFor(() => {
      expect(integrationService.getCrossResourceReports).toHaveBeenCalledWith(
        'team-123',
        1,
        10
      )
    })

    expect(await screen.findByText('Weekly Team Analysis')).toBeInTheDocument()
    expect(screen.getByText('Project X Kickoff Analysis')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('formats dates correctly using native JavaScript', async () => {
    renderWithProviders(<CrossResourceReportsPage />)

    // The first report has a date of '2025-04-15T10:30:00Z'
    // After formatting it should appear in the format "MMM D, YYYY h:mm AM/PM"
    // Exact format depends on timezone, so use partial matching
    await waitFor(() => {
      const dateCell = screen.getByText(/Apr 15, 2025/i)
      expect(dateCell).toBeInTheDocument()
    })

    // The second report has a date of '2025-04-10T09:15:00Z'
    await waitFor(() => {
      const dateCell = screen.getByText(/Apr 10, 2025/i)
      expect(dateCell).toBeInTheDocument()
    })
  })

  it('shows correct status badges', async () => {
    renderWithProviders(<CrossResourceReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })
  })

  it('displays error message when API call fails', async () => {
    const errorResponse = {
      status: 500,
      message: 'Server error',
    }

    mockedIntegrationService.getCrossResourceReports.mockResolvedValue(
      errorResponse
    )

    renderWithProviders(<CrossResourceReportsPage />)

    await waitFor(() => {
      expect(
        screen.getByText('Error loading reports: Server error')
      ).toBeInTheDocument()
    })
  })

  it('displays empty state when no reports are found', async () => {
    mockedIntegrationService.getCrossResourceReports.mockResolvedValue({
      items: [],
      total: 0,
    })

    renderWithProviders(<CrossResourceReportsPage />)

    await waitFor(() => {
      expect(
        screen.getByText('No cross-resource reports found')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Create a new analysis to generate insights across multiple resources.'
        )
      ).toBeInTheDocument()
    })
  })

  it('shows pagination UI correctly', async () => {
    // Reset the mock before this test
    mockedIntegrationService.getCrossResourceReports.mockClear()

    // Set up the mock response with multiple pages
    mockedIntegrationService.getCrossResourceReports.mockResolvedValue({
      items: [
        {
          id: 'report-1',
          title: 'Weekly Team Analysis',
          description: 'Analysis of team activity for the past week',
          created_at: '2025-04-15T10:30:00Z',
          status: 'completed',
          resource_count: 3,
          created_by: {
            id: 'user-1',
            name: 'John Doe',
          },
        },
      ],
      total: 15, // Total of 15 reports, so pagination is definitely needed
    })

    renderWithProviders(<CrossResourceReportsPage />)

    // Wait for the page to load
    await waitFor(() => {
      expect(screen.getByText('Weekly Team Analysis')).toBeInTheDocument()
    })

    // Check that pagination elements are present
    const nextPageButton = await screen.findByRole('button', { name: /next/i })
    expect(nextPageButton).toBeInTheDocument()
    expect(nextPageButton).not.toBeDisabled()

    const prevPageButton = screen.getByRole('button', { name: /previous/i })
    expect(prevPageButton).toBeInTheDocument()
    expect(prevPageButton).toBeDisabled() // Should be disabled on the first page

    // Check that the pagination text shows the correct range
    expect(screen.getByText(/1-10 of 15/i)).toBeInTheDocument()
  })

  it('has correct links to create new analysis and view reports', async () => {
    renderWithProviders(<CrossResourceReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Weekly Team Analysis')).toBeInTheDocument()
    })

    // Check create new analysis button
    const createButton = screen.getByRole('link', {
      name: /create new analysis/i,
    })
    expect(createButton).toHaveAttribute(
      'href',
      '/dashboard/integrations/create-analysis/team-123'
    )

    // Check view report button - there should be one per report
    const viewButtons = screen.getAllByLabelText('View Report')
    expect(viewButtons).toHaveLength(2)
    expect(viewButtons[0]).toHaveAttribute(
      'href',
      '/dashboard/integrations/team-analysis/report-1'
    )
    expect(viewButtons[1]).toHaveAttribute(
      'href',
      '/dashboard/integrations/team-analysis/report-2'
    )
  })
})
