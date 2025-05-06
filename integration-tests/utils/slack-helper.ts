import { Page } from '@playwright/test';

/**
 * Helper functions for Slack integration operations
 */
export class SlackHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Connect a Slack workspace
   */
  async connectWorkspace() {
    await this.page.goto('/settings/integrations');
    await this.page.getByRole('button', { name: 'Connect Slack Workspace' }).click();
    
    await this.page.waitForURL('**/slack/oauth-callback**');
    
    await this.page.waitForSelector('[data-testid="slack-connection-success"]');
  }

  /**
   * Navigate to channel selection page
   */
  async navigateToChannelSelection() {
    await this.page.goto('/integration/channels');
    await this.page.waitForSelector('[data-testid="channel-list"]');
  }

  /**
   * Select channels for analysis
   */
  async selectChannels(channelNames: string[]) {
    for (const channelName of channelNames) {
      await this.page.getByTestId(`channel-${channelName}`).click();
    }
    await this.page.getByRole('button', { name: 'Save Selection' }).click();
    await this.page.waitForSelector('[data-testid="selection-saved"]');
  }

  /**
   * Sync channel messages
   */
  async syncChannels() {
    await this.page.goto('/integration/sync');
    await this.page.getByRole('button', { name: 'Sync Channel Messages' }).click();
    await this.page.waitForSelector('[data-testid="sync-complete"]');
  }
}
