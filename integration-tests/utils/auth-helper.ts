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
    try {
      await this.page.goto('/login');
      console.log('Navigated to login page');
      
      await this.page.getByTestId('email-login-button').click();
      console.log('Clicked email login button');
      
      await this.page.getByLabel('Email').fill(email);
      await this.page.getByLabel('Password').fill(password);
      console.log('Filled email and password');
      
      await this.page.getByRole('button', { name: 'Sign In' }).click();
      console.log('Clicked Sign In button');
      
      await this.page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('Successfully logged in and redirected to dashboard');
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Authentication failed during login: ${error}`);
    }
  }

  /**
   * Register a new user with email and password
   */
  async registerWithEmail(email: string, password: string, name: string) {
    try {
      await this.page.goto('/register');
      console.log('Navigated to register page');
      
      await this.page.getByTestId('email-login-button').click();
      console.log('Clicked email login button');
      
      await this.page.getByLabel('Email').fill(email);
      await this.page.getByLabel('Password').fill(password);
      await this.page.getByLabel('Name').fill(name);
      console.log('Filled registration form');
      
      await this.page.getByRole('button', { name: 'Sign Up' }).click();
      console.log('Clicked Sign Up button');
      
      await this.page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('Successfully registered and redirected to dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(`Authentication failed during registration: ${error}`);
    }
  }

  /**
   * Switch to a different team
   */
  async switchTeam(teamName: string) {
    try {
      await this.page.getByTestId('team-selector').click();
      console.log('Clicked team selector');
      
      await this.page.getByRole('menuitem', { name: teamName }).click();
      console.log(`Selected team: ${teamName}`);
      
      await this.page.waitForSelector(`[data-testid="current-team-name"]:has-text("${teamName}")`, { timeout: 10000 });
      console.log(`Successfully switched to team: ${teamName}`);
    } catch (error) {
      console.error('Team switching error:', error);
      throw new Error(`Failed to switch team: ${error}`);
    }
  }

  /**
   * Logout the current user
   */
  async logout() {
    try {
      await this.page.getByTestId('user-menu').click();
      console.log('Clicked user menu');
      
      await this.page.getByRole('menuitem', { name: 'Sign Out' }).click();
      console.log('Clicked Sign Out menu item');
      
      await this.page.waitForURL('**/login', { timeout: 10000 });
      console.log('Successfully logged out and redirected to login page');
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error(`Authentication failed during logout: ${error}`);
    }
  }
}
