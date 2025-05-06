import { Page } from '@playwright/test';

/**
 * Helper functions for authentication-related operations
 */
export class AuthHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.getByTestId('email-login-button').click();
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.page.waitForURL('**/dashboard');
  }

  /**
   * Register a new user with email and password
   */
  async registerWithEmail(email: string, password: string, name: string) {
    await this.page.goto('/register');
    await this.page.getByTestId('email-login-button').click();
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByRole('button', { name: 'Sign Up' }).click();
    await this.page.waitForURL('**/dashboard');
  }

  /**
   * Switch to a different team
   */
  async switchTeam(teamName: string) {
    await this.page.getByTestId('team-selector').click();
    await this.page.getByRole('menuitem', { name: teamName }).click();
    await this.page.waitForSelector(`[data-testid="current-team-name"]:has-text("${teamName}")`);
  }

  /**
   * Logout the current user
   */
  async logout() {
    await this.page.getByTestId('user-menu').click();
    await this.page.getByRole('menuitem', { name: 'Sign Out' }).click();
    await this.page.waitForURL('**/login');
  }
}
