/**
 * User Data Diagnostic Script
 * 
 * This script helps diagnose issues with user data in the Slack message UI.
 * Run this in your browser console when viewing the Slack message page.
 * 
 * Usage:
 * 1. Open the browser console
 * 2. Copy and paste this entire script
 * 3. Observe the diagnostic output
 * 
 * The script will:
 * - Check the in-memory user Map content
 * - Analyze API responses for user data
 * - Compare expected vs. actual user name display
 * - Provide recommendations to fix issues
 */

(function() {
  console.group('🔍 User Data Diagnostics');

  // Check if we're on the right page
  if (!window.location.pathname.includes('/dashboard/slack/workspaces')) {
    console.error('❌ Please run this script on the Slack messages page.');
    console.groupEnd();
    return;
  }
  
  console.log('📊 Running diagnostics on user data...');
  
  // Save original fetch to monitor API calls
  const originalFetch = window.fetch;
  let userApiResponses = [];
  let messageApiResponses = [];
  
  // Override fetch to capture API responses
  window.fetch = async function(...args) {
    const url = args[0];
    try {
      const response = await originalFetch.apply(this, args);
      
      // Clone the response so we can read it and still return the original
      const clone = response.clone();
      
      // Only intercept our own API calls
      if (url.toString().includes('/slack/workspaces')) {
        // Capture user data responses
        if (url.toString().includes('/users')) {
          clone.json().then(data => {
            userApiResponses.push({
              url: url.toString(),
              data
            });
            console.log('📥 Captured user API response:', data);
          }).catch(err => console.error('Error parsing user API response:', err));
        }
        
        // Capture message data responses
        if (url.toString().includes('/messages')) {
          clone.json().then(data => {
            messageApiResponses.push({
              url: url.toString(),
              data
            });
            console.log('📥 Captured message API response:', data);
          }).catch(err => console.error('Error parsing message API response:', err));
        }
      }
      
      return response;
    } catch (error) {
      console.error('❌ Fetch error:', error);
      throw error;
    }
  };
  
  // Analysis functions
  function analyzeUserMap() {
    // Find the React component instance with the users Map
    let userMap = null;
    let foundComponents = [];
    
    // Check if we have React DevTools hooks
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      // Get React instances
      const reactInstances = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
      if (reactInstances && reactInstances.size > 0) {
        // Get the first renderer
        const renderer = reactInstances.get(1);
        if (renderer && renderer.findFiberByHostInstance) {
          // Walk the component tree to find MessageList
          walkReactTree(renderer.findFiberByHostInstance(document.querySelector('div')));
        }
      }
    }
    
    function walkReactTree(fiber) {
      if (!fiber) return;
      
      // Check if this component has state that includes a users Map
      if (fiber.memoizedState && fiber.memoizedState.memoizedState) {
        const state = fiber.memoizedState.memoizedState;
        
        // Find state items that might be Maps
        for (let i = 0; i < state.length; i++) {
          if (state[i] instanceof Map) {
            foundComponents.push({
              name: fiber.type?.name || 'Unknown',
              map: state[i],
              index: i
            });
            
            // If we find a map that has user-like objects, consider it our user map
            if (Array.from(state[i].values()).some(value => 
              value && typeof value === 'object' && 
              ('name' in value || 'display_name' in value || 'real_name' in value)
            )) {
              userMap = state[i];
            }
          }
        }
      }
      
      // Continue walking
      if (fiber.child) walkReactTree(fiber.child);
      if (fiber.sibling) walkReactTree(fiber.sibling);
    }
    
    // Output Map analysis
    console.log('🔍 Found React components with Maps:', foundComponents);
    
    if (userMap) {
      console.log('✅ Found user Map with', userMap.size, 'entries');
      console.table(Array.from(userMap.entries()).map(([key, value]) => ({
        id: key,
        name: value.name,
        display_name: value.display_name,
        real_name: value.real_name,
        effective_name: value.display_name || value.real_name || value.name
      })));
      return userMap;
    } else {
      console.warn('⚠️ Could not find user Map in React components');
      return null;
    }
  }
  
  function analyzeDisplayedUsers() {
    // Find message elements and extract user names
    const messageElements = document.querySelectorAll('[data-testid="message-item"]') || 
                            document.querySelectorAll('.chakra-stack > .chakra-box');
    
    if (messageElements.length === 0) {
      console.warn('⚠️ No message elements found. Make sure you are on the messages page.');
      return [];
    }
    
    const displayedUsers = Array.from(messageElements).map(element => {
      // Try to extract user name from the message element
      const nameElement = element.querySelector('b') || 
                         element.querySelector('[data-testid="user-name"]') ||
                         element.querySelector('.chakra-text[font-weight="bold"]');
                         
      const avatarElement = element.querySelector('.chakra-avatar') ||
                           element.querySelector('img');
                           
      const textElement = element.querySelector('p') ||
                         element.querySelector('.chakra-text:not([font-weight="bold"])');
                           
      return {
        element,
        name: nameElement ? nameElement.textContent.trim() : 'Not found',
        avatar: avatarElement ? (avatarElement.src || 'No URL') : 'No avatar',
        text: textElement ? textElement.textContent.trim() : 'No text',
        isUnknown: nameElement ? nameElement.textContent.trim() === 'Unknown User' : false
      };
    });
    
    console.log('👤 Found', displayedUsers.length, 'displayed messages with users');
    console.log('❌ Unknown users:', displayedUsers.filter(u => u.isUnknown).length);
    
    // Show a sample of messages
    console.table(displayedUsers.slice(0, 5).map(({ name, text, isUnknown }) => ({ 
      name, text: text.substring(0, 30), isUnknown 
    })));
    
    return displayedUsers;
  }
  
  // Execute diagnostic in 3 seconds to allow page to fully load
  setTimeout(() => {
    try {
      console.log('🔄 Starting diagnostics...');
      
      // Analyze the current state
      const userMap = analyzeUserMap();
      const displayedUsers = analyzeDisplayedUsers();
      
      // Print recommendations
      console.group('📋 Diagnostic Results:');
      
      if (userApiResponses.length === 0) {
        console.warn('⚠️ No user API calls detected. Refresh the page to catch API calls.');
      } else {
        console.log('✅ Detected', userApiResponses.length, 'user API calls');
      }
      
      if (displayedUsers.filter(u => u.isUnknown).length > 0) {
        console.error('❌ ISSUE: Some users are displaying as "Unknown User"');
        console.log('Possible causes:');
        console.log('1. User Map is not being preserved between API calls (most likely)');
        console.log('2. User IDs in messages don\'t match IDs in the database');
        console.log('3. API is not returning user data properly');
      }
      
      console.log('Recommendations:');
      
      if (userMap && userMap.size < displayedUsers.length && displayedUsers.some(u => u.isUnknown)) {
        console.log('1. Fix userMap initialization in fetchUserData to preserve existing entries');
        console.log('   - Change: const newUsers = new Map<string, SlackUser>();');
        console.log('   - To: const newUsers = new Map<string, SlackUser>(users);');
      }
      
      if (userApiResponses.length > 0 && userApiResponses[0].data.users?.length === 0) {
        console.log('2. Check database for user data - API returned empty results');
      }
      
      console.groupEnd();
      
      // Clean up instrumentation
      window.fetch = originalFetch;
      console.log('🔄 Diagnostics complete. Restored original fetch.');
      
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      window.fetch = originalFetch;
    }
    
    console.groupEnd();
  }, 3000);
  
  console.log('⏱️ Diagnostic will run in 3 seconds...');
})();
