import { test, expect } from '../../utils/test-fixtures';

test.describe('Analysis Flow', () => {
  test('should create a new analysis', async ({ slackConnectedPage, analysisHelper, testData }) => {
    const page = slackConnectedPage;
    const analysis = testData.getTestAnalysis();
    
    await analysisHelper.createAnalysis(
      analysis.name,
      analysis.description,
      analysis.channels,
      analysis.startDate,
      analysis.endDate
    );
    
    await expect(page).toHaveURL(/.*\/analysis\/results\/.*/);
    
    await expect(page.getByTestId('analysis-results')).toBeVisible();
    await expect(page.getByText(analysis.name)).toBeVisible();
  });

  test('should view existing analysis results', async ({ slackConnectedPage, page }) => {
    await page.goto('/analysis');
    
    await page.getByTestId('analysis-item').first().click();
    
    await expect(page).toHaveURL(/.*\/analysis\/results\/.*/);
    await expect(page.getByTestId('analysis-results')).toBeVisible();
  });

  test('should generate analysis report', async ({ slackConnectedPage, analysisHelper, page }) => {
    await page.goto('/analysis');
    
    const analysisId = await page.getByTestId('analysis-item').first().getAttribute('data-analysis-id');
    
    const download = await analysisHelper.generateReport(analysisId);
    
    expect(download).toBeTruthy();
    expect(await download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
