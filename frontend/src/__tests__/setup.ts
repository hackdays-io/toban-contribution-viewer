import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the fetch API
global.fetch = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock environment variables
vi.mock('../config/env.ts', () => ({
  env: {
    VITE_API_URL: 'http://localhost:8000',
  },
}));

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
});
