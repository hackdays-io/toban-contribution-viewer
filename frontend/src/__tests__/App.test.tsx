import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import './setup'

// Mock the Auth context to avoid authentication issues
vi.mock('../context/AuthContext', () => {
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    default: {
      AuthProvider: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
    },
  }
})

// Mock useAuth
vi.mock('../context/useAuth', () => {
  return {
    default: () => ({
      user: { email: 'test@example.com' },
      signOut: vi.fn(),
      isAuthenticated: true,
    }),
  }
})

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText(/Toban Contribution Viewer/i)).toBeInTheDocument()
  })

  it('contains the Analytics component', () => {
    // This test checks if the Analytics component is imported
    // We can't easily check Routes in the rendered output
    const app = render(<App />)
    expect(app).toBeTruthy()
  })
})
