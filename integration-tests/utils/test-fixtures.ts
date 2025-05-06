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
    await authHelper.loginWithEmail(testUser.email, testUser.password);
    await use(page);
    await authHelper.logout();
  },
  
  slackConnectedPage: async ({ page, authHelper, slackHelper }, use) => {
    const testUser = TestDataHelper.getTestUser();
    await authHelper.loginWithEmail(testUser.email, testUser.password);
    await slackHelper.connectWorkspace();
    await use(page);
    await authHelper.logout();
  },
});

export { expect } from '@playwright/test';
