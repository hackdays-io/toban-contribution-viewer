import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPage } from '../../../pages/slack';
import { BrowserRouter } from 'react-router-dom';
import '../../setup';

// Mock navigation and toast
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: () => vi.fn(),
  };
});

// Wrapper component with BrowserRouter
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('AnalyticsPage', () => {
  it('renders the analytics page correctly', () => {
    // Mock fetch to avoid actual API calls
    global.fetch = vi.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ workspaces: [] }),
      })
    );
    
    render(<AnalyticsPage />, { wrapper: Wrapper });
    
    // Basic checks (using getAllByText to avoid ambiguity with multiple elements)
    const slackAnalyticsHeadings = screen.getAllByText(/Slack Analytics/i);
    expect(slackAnalyticsHeadings.length).toBeGreaterThan(0);
    
    const backButton = screen.getByText(/Back to Analytics/i);
    expect(backButton).toBeInTheDocument();
  });
});
