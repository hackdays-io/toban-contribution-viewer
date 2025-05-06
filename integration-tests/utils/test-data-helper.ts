/**
 * Helper functions for managing test data
 */
export class TestDataHelper {
  /**
   * Get test user data
   */
  static getTestUser(index = 0) {
    const users = [
      { email: 'test-user-1@example.com', password: 'Password123!', name: 'Test User 1' },
      { email: 'test-user-2@example.com', password: 'Password123!', name: 'Test User 2' },
      { email: 'test-admin@example.com', password: 'Password123!', name: 'Test Admin' },
    ];
    
    return users[index % users.length];
  }

  /**
   * Get test team data
   */
  static getTestTeam(index = 0) {
    const teams = [
      { name: 'Test Team 1', description: 'Description for Test Team 1' },
      { name: 'Test Team 2', description: 'Description for Test Team 2' },
      { name: 'Engineering Team', description: 'Engineering team for testing' },
    ];
    
    return teams[index % teams.length];
  }

  /**
   * Get test channels
   */
  static getTestChannels() {
    return [
      'general',
      'random',
      'announcements',
      'development',
      'design',
    ];
  }

  /**
   * Get test analysis data
   */
  static getTestAnalysis(index = 0) {
    const analyses = [
      { 
        name: 'Q1 Contributions Analysis', 
        description: 'Analysis of team contributions for Q1',
        channels: ['general', 'development'],
        startDate: '2023-01-01',
        endDate: '2023-03-31'
      },
      { 
        name: 'Design Team Activity', 
        description: 'Analysis of design team activity',
        channels: ['design'],
        startDate: '2023-04-01',
        endDate: '2023-04-30'
      },
    ];
    
    return analyses[index % analyses.length];
  }
}
