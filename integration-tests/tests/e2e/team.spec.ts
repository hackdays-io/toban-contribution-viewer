import { test, expect } from '../../utils/test-fixtures';

test.describe('Team Management Flow', () => {
  test('should create a new team', async ({ authenticatedPage, teamHelper, testData }) => {
    const page = authenticatedPage;
    const team = testData.getTestTeam();
    const teamName = `${team.name}-${Date.now()}`;
    
    await teamHelper.createTeam(teamName, team.description);
    
    await expect(page).toHaveURL(/.*\/teams\/.*/);
    
    await expect(page.getByText(teamName)).toBeVisible();
  });

  test('should invite a member to the team', async ({ authenticatedPage, teamHelper }) => {
    const page = authenticatedPage;
    
    const testEmail = `invite-${Date.now()}@example.com`;
    
    await teamHelper.inviteMember(testEmail);
    
    await expect(page.getByTestId('invitation-sent')).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test('should change user role in the team', async ({ authenticatedPage, teamHelper, testData }) => {
    const page = authenticatedPage;
    const testUser = testData.getTestUser(1); // Use second test user
    
    await teamHelper.changeUserRole(testUser.email, 'Admin');
    
    await expect(page.getByTestId('role-updated')).toBeVisible();
    
    const userRow = page.locator(`tr:has-text("${testUser.email}")`);
    await expect(userRow.getByText('Admin')).toBeVisible();
  });
});
