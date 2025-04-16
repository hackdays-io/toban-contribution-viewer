// Add TypeScript support for Jest global functions
// This ensures TypeScript recognizes Jest's global functions like describe, it, etc.

import '@testing-library/jest-dom'

declare global {
  const describe: jest.Describe
  const it: jest.It
  const test: jest.It
  const expect: jest.Expect
  const beforeEach: jest.LifecycleFunction
  const afterEach: jest.LifecycleFunction
  const beforeAll: jest.LifecycleFunction
  const afterAll: jest.LifecycleFunction
}

// This is needed to make the file a module
export {}
