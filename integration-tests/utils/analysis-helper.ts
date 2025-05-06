import { Page } from '@playwright/test';

/**
 * Helper functions for analysis operations
 */
export class AnalysisHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Create a new analysis
   */
  async createAnalysis(name: string, description: string, channelNames: string[], startDate: string, endDate: string) {
    await this.page.goto('/analysis/create');
    
    await this.page.getByLabel('Analysis Name').fill(name);
    await this.page.getByLabel('Description').fill(description);
    await this.page.getByRole('button', { name: 'Next' }).click();
    
    for (const channelName of channelNames) {
      await this.page.getByTestId(`channel-${channelName}`).click();
    }
    await this.page.getByRole('button', { name: 'Next' }).click();
    
    await this.page.getByLabel('Start Date').fill(startDate);
    await this.page.getByLabel('End Date').fill(endDate);
    await this.page.getByRole('button', { name: 'Next' }).click();
    
    await this.page.getByRole('button', { name: 'Create Analysis' }).click();
    
    await this.page.waitForURL('**/analysis/results/**');
  }

  /**
   * View analysis results
   */
  async viewAnalysisResults(analysisId: string) {
    await this.page.goto(`/analysis/results/${analysisId}`);
    await this.page.waitForSelector('[data-testid="analysis-results"]');
  }

  /**
   * Generate an analysis report
   */
  async generateReport(analysisId: string, format: 'pdf' | 'csv' = 'pdf') {
    await this.page.goto(`/analysis/results/${analysisId}`);
    await this.page.getByRole('button', { name: 'Generate Report' }).click();
    await this.page.getByRole('menuitem', { name: format === 'pdf' ? 'PDF Report' : 'CSV Export' }).click();
    
    const download = await this.page.waitForEvent('download');
    return download;
  }
}
