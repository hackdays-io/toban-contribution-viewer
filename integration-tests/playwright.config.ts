import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.ENABLE_HTML_REPORTER === 'true' 
    ? [
        ['html', { outputFolder: 'test-results/html' }],
        ['junit', { outputFile: 'test-results/junit.xml' }]
      ]
    : [['junit', { outputFile: 'test-results/junit.xml' }]],
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://test-frontend:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    headless: true, // Run tests in headless mode by default
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/',
});
