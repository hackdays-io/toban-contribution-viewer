import { Page } from '@playwright/test';

/**
 * Helper functions for team management operations
 */
export class TeamHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Create a new team
   */
  async createTeam(name: string, description: string) {
    await this.page.goto('/teams');
    await this.page.getByRole('button', { name: 'Create Team' }).click();
    await this.page.getByLabel('Team Name').fill(name);
    await this.page.getByLabel('Description').fill(description);
    await this.page.getByRole('button', { name: 'Create' }).click();
    
    await this.page.waitForURL('**/teams/**');
  }

  /**
   * Invite a member to a team
   */
  async inviteMember(email: string, role: 'Admin' | 'Member' = 'Member') {
    await this.page.getByRole('tab', { name: 'Members' }).click();
    await this.page.getByRole('button', { name: 'Invite Member' }).click();
    await this.page.getByLabel('Email').fill(email);
    
    await this.page.getByLabel('Role').click();
    await this.page.getByRole('option', { name: role }).click();
    
    await this.page.getByRole('button', { name: 'Send Invitation' }).click();
    
    await this.page.waitForSelector('[data-testid="invitation-sent"]');
  }

  /**
   * Manage member permissions
   */
  async changeUserRole(userEmail: string, newRole: 'Admin' | 'Member') {
    await this.page.getByRole('tab', { name: 'Members' }).click();
    
    const userRow = this.page.locator(`tr:has-text("${userEmail}")`);
    
    await userRow.locator('[data-testid="change-role-button"]').click();
    
    await this.page.getByRole('option', { name: newRole }).click();
    
    await this.page.waitForSelector('[data-testid="role-updated"]');
  }
}
