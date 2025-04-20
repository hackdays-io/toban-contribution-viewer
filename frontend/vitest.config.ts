import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Exclude problematic files from coverage
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/types/**',
        '**/setupTests.ts',
        '**/vite-env.d.ts'
      ],
    },
    testTimeout: 30000, // Add a 30-second timeout for each test
    hookTimeout: 30000, // Add timeout for hooks
    teardownTimeout: 10000, // Limit teardown time
    // Skip slow or problematic tests
    maxConcurrency: 1, // Run tests one at a time
    maxThreads: 1, // Use single thread
    minThreads: 1
  },
});
