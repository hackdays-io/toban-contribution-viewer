import { test, expect } from '../../utils/test-fixtures';

test.describe('Slack Integration Flow', () => {
  test('should connect Slack workspace', async ({ authenticatedPage, slackHelper }) => {
    const page = authenticatedPage;
    
    await slackHelper.connectWorkspace();
    
    await expect(page.getByText('Workspace connected successfully')).toBeVisible();
  });

  test('should list available channels after connecting', async ({ slackConnectedPage }) => {
    const page = slackConnectedPage;
    
    await page.goto('/integration/channels');
    
    await expect(page.getByTestId('channel-list')).toBeVisible();
    await expect(page.getByTestId('channel-general')).toBeVisible();
    await expect(page.getByTestId('channel-random')).toBeVisible();
  });

  test('should select channels for analysis', async ({ slackConnectedPage, slackHelper, testData }) => {
    const page = slackConnectedPage;
    const channels = testData.getTestChannels().slice(0, 2); // Select first 2 channels
    
    await slackHelper.navigateToChannelSelection();
    await slackHelper.selectChannels(channels);
    
    await expect(page.getByTestId('selection-saved')).toBeVisible();
  });

  test('should sync channel messages', async ({ slackConnectedPage, slackHelper }) => {
    const page = slackConnectedPage;
    
    await slackHelper.syncChannels();
    
    await expect(page.getByTestId('sync-complete')).toBeVisible();
  });
});
