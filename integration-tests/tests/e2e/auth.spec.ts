import { test, expect } from '../../utils/test-fixtures';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page, testData }) => {
    await testData.resetAuthData(page);
  });
  test('should allow user to register with email', async ({ page, authHelper, testData }) => {
    const testUser = testData.getTestUser();
    const email = `register-${Date.now()}@example.com`;
    
    await authHelper.registerWithEmail(email, testUser.password, testUser.name);
    
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('should allow user to login with email', async ({ page, authHelper, testData }) => {
    const testUser = testData.getTestUser();
    
    await authHelper.loginWithEmail(testUser.email, testUser.password);
    
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('should display error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('email-login-button').click();
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText('Invalid login credentials')).toBeVisible();
    
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should allow user to switch teams', async ({ authenticatedPage, authHelper, testData }) => {
    const page = authenticatedPage;
    const testTeam = testData.getTestTeam(1); // Use second test team
    
    await authHelper.switchTeam(testTeam.name);
    
    await expect(page.getByTestId('current-team-name')).toContainText(testTeam.name);
  });

  test('should allow user to logout', async ({ authenticatedPage, authHelper }) => {
    const page = authenticatedPage;
    
    await authHelper.logout();
    
    await expect(page).toHaveURL(/.*\/login/);
  });
});
