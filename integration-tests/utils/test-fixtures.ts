import { test as base } from '@playwright/test';
import { AuthHelper } from './auth-helper';
import { SlackHelper } from './slack-helper';
import { AnalysisHelper } from './analysis-helper';
import { TeamHelper } from './team-helper';
import { TestDataHelper } from './test-data-helper';

/**
 * Extended test fixture with helpers
 */
export const test = base.extend({
  authHelper: async ({ page }, use) => {
    await use(new AuthHelper(page));
  },
  slackHelper: async ({ page }, use) => {
    await use(new SlackHelper(page));
  },
  analysisHelper: async ({ page }, use) => {
    await use(new AnalysisHelper(page));
  },
  teamHelper: async ({ page }, use) => {
    await use(new TeamHelper(page));
  },
  testData: async ({}, use) => {
    await use(TestDataHelper);
  },
  
  authenticatedPage: async ({ page, authHelper }, use) => {
    const testUser = TestDataHelper.getTestUser();
    try {
      console.log('Starting authenticated page setup');
      await authHelper.loginWithEmail(testUser.email, testUser.password);
      
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
      console.log('Successfully authenticated');
      
      await use(page);
    } catch (error) {
      console.error('Authentication fixture error:', error);
      throw new Error(`Failed to set up authenticated page: ${error}`);
    } finally {
      try {
        await authHelper.logout();
        console.log('Successfully cleaned up authentication state');
      } catch (cleanupError) {
        console.warn('Warning: Could not properly clean up auth state:', cleanupError);
      }
    }
  },
  
  slackConnectedPage: async ({ page, authHelper, slackHelper }, use) => {
    const testUser = TestDataHelper.getTestUser();
    try {
      console.log('Starting slack connected page setup');
      await authHelper.loginWithEmail(testUser.email, testUser.password);
      
      await slackHelper.connectWorkspace();
      console.log('Successfully connected to Slack workspace');
      
      await use(page);
    } catch (error) {
      console.error('Slack connection fixture error:', error);
      throw new Error(`Failed to set up slack connected page: ${error}`);
    } finally {
      try {
        await authHelper.logout();
        console.log('Successfully cleaned up authentication state');
      } catch (cleanupError) {
        console.warn('Warning: Could not properly clean up auth state:', cleanupError);
      }
    }
  },
});

export { expect } from '@playwright/test';
