// No need to import React when using JSX without explicit React APIs
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import ChannelAnalysisHistoryPage from '../../../pages/slack/ChannelAnalysisHistoryPage';

// Mock the useParams hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      workspaceId: 'test-workspace-id',
      channelId: 'test-channel-id',
    }),
    useNavigate: () => vi.fn(),
  };
});

// Mock the fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]), // Return empty analysis history
  })
) as unknown as typeof global.fetch;

describe('ChannelAnalysisHistoryPage', () => {
  it('renders the channel analysis history page correctly', async () => {
    render(
      <BrowserRouter>
        <ChannelAnalysisHistoryPage />
      </BrowserRouter>
    );
    
    // Check that the page title is rendered
    expect(screen.getByText(/Channel Analysis History/i)).toBeInTheDocument();
    
    // Check for the navigation buttons
    expect(screen.getByText(/Back to Channels/i)).toBeInTheDocument();
    expect(screen.getByText(/New Analysis/i)).toBeInTheDocument();
    
    // Initially it should show a loading spinner
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });
});
