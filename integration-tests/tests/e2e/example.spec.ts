import { test, expect } from '@playwright/test';

test.describe('Example tests', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForURL('/login');
    
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByTestId('email-login-button')).toBeVisible();
  });
});
