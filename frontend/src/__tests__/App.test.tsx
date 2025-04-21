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

  it('uses ChakraProvider for styling', () => {
    // Instead of checking for Analytics, we'll check for ChakraProvider
    expect(App.toString()).toContain('ChakraProvider')
  })
})
