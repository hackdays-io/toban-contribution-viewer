import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock the fetch API
global.fetch = vi.fn()

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock environment variables
vi.mock('../config/env.ts', async () => {
  return {
    default: {
      apiUrl: 'http://localhost:8000/api/v1',
      isDev: true,
      features: {
        enableSlack: true,
      },
      supabase: {
        url: 'mock-url',
        anonKey: 'mock-key',
        redirectUri: 'http://localhost:3000/auth/callback',
      },
    },
    getEnvVar: (name: string) => {
      if (name === 'VITE_API_URL') return 'http://localhost:8000/api/v1'
      return 'mock-value'
    },
    getBooleanEnvVar: () => true,
    validateEnvironment: () => true,
    env: {
      apiUrl: 'http://localhost:8000/api/v1',
      isDev: true,
      features: {
        enableSlack: true,
      },
      supabase: {
        url: 'mock-url',
        anonKey: 'mock-key',
        redirectUri: 'http://localhost:3000/auth/callback',
      },
    },
  }
})

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks()
})
