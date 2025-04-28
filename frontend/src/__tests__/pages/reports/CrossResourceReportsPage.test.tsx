import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CrossResourceReportsPage from '../../../pages/reports/CrossResourceReportsPage';
import integrationService from '../../../lib/integrationService';

// Mock the integration service
jest.mock('../../../lib/integrationService', () => ({
  getCrossResourceReports: jest.fn(),
  isApiError: jest.fn((response) => 'status' in response && typeof response.status === 'number'),
}));

// Mock for useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ teamId: 'team-123' }),
}));

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
};

describe('CrossResourceReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (integrationService.getCrossResourceReports as jest.Mock).mockResolvedValue(mockReports);
  });

  it('renders the page title correctly', async () => {
    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cross-Resource Analysis Reports')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('fetches and displays report data', async () => {
    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(integrationService.getCrossResourceReports).toHaveBeenCalledWith('team-123', 1, 10);
    });

    expect(await screen.findByText('Weekly Team Analysis')).toBeInTheDocument();
    expect(screen.getByText('Project X Kickoff Analysis')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('shows correct status chips', async () => {
    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  it('displays error message when API call fails', async () => {
    const errorResponse = {
      status: 500,
      message: 'Server error',
    };
    
    (integrationService.getCrossResourceReports as jest.Mock).mockResolvedValue(errorResponse);

    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading reports: Server error')).toBeInTheDocument();
    });
  });

  it('displays empty state when no reports are found', async () => {
    (integrationService.getCrossResourceReports as jest.Mock).mockResolvedValue({ 
      items: [], 
      total: 0 
    });

    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No cross-resource reports found')).toBeInTheDocument();
      expect(screen.getByText('Create a new analysis to generate insights across multiple resources.')).toBeInTheDocument();
    });
  });

  it('handles pagination correctly', async () => {
    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Weekly Team Analysis')).toBeInTheDocument();
    });

    // Mock for different page
    (integrationService.getCrossResourceReports as jest.Mock).mockClear();
    (integrationService.getCrossResourceReports as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'report-3',
          title: 'Different Page Report',
          created_at: '2025-03-20T15:45:00Z',
          status: 'pending',
          resource_count: 2,
          created_by: {
            id: 'user-3',
            name: 'Bob Smith',
          },
        },
      ],
      total: 3,
    });

    // Find and click the next page button
    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    userEvent.click(nextPageButton);

    await waitFor(() => {
      // Check that the service was called with page 2
      expect(integrationService.getCrossResourceReports).toHaveBeenCalledWith('team-123', 2, 10);
    });
  });

  it('has correct links to create new analysis and view reports', async () => {
    render(
      <MemoryRouter>
        <CrossResourceReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Weekly Team Analysis')).toBeInTheDocument();
    });

    // Check create new analysis button
    const createButton = screen.getByRole('link', { name: /create new analysis/i });
    expect(createButton).toHaveAttribute('href', '/dashboard/integrations/create-analysis/team-123');

    // Check view report links
    const viewButtons = screen.getAllByRole('link', { name: /view report/i });
    expect(viewButtons[0]).toHaveAttribute('href', '/dashboard/integrations/team-analysis/report-1');
    expect(viewButtons[1]).toHaveAttribute('href', '/dashboard/integrations/team-analysis/report-2');
  });
});