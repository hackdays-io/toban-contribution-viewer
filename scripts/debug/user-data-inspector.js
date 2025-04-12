/**
 * User Data Inspector Script
 * 
 * This script helps diagnose and fix issues with user data in Slack messages.
 * Run it in your browser console on the message display page.
 * 
 * Features:
 * - Shows contents of the user Map
 * - Displays message-to-user mapping
 * - Reports any missing or problematic user data
 * - Provides details about API responses and data flow
 */

(function() {
  console.group('🔍 User Data Inspector');
  console.log('Analyzing user data and message display issues...');
  
  // Find React component instances
  function findReactComponents() {
    const allNodes = [];
    let userMapComponent = null;
    let messageMaps = [];
    
    // Create a tree walker to iterate through all DOM nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    // Walk through all nodes
    while(walker.nextNode()) {
      const node = walker.currentNode;
      // Look for React's internal properties
      const keys = Object.keys(node).filter(key => 
        key.startsWith('__reactFiber$') || 
        key.startsWith('__reactInternalInstance$')
      );
      
      if (keys.length > 0) {
        const key = keys[0];
        const fiber = node[key];
        if (fiber && fiber.memoizedProps) {
          allNodes.push({
            fiber,
            node,
            props: fiber.memoizedProps
          });
          
          // Check if this might be our MessageList component
          if (fiber.memoizedProps.workspaceId && fiber.memoizedProps.channelId) {
            // This is likely our MessageList component
            userMapComponent = fiber;
          }
          
          // Look for user data in components
          if (fiber.memoizedState && fiber.memoizedState.memoizedState) {
            const state = fiber.memoizedState.memoizedState;
            // Check each state entry
            if (Array.isArray(state)) {
              state.forEach((item, index) => {
                if (item instanceof Map) {
                  // Look for Maps that might contain user data
                  const values = Array.from(item.values());
                  if (values.length > 0 && values[0] && 
                     (values[0].name || values[0].display_name || values[0].slack_id)) {
                    messageMaps.push({
                      component: fiber,
                      map: item,
                      stateIndex: index
                    });
                  }
                }
              });
            }
          }
        }
      }
    }
    
    return { allNodes, userMapComponent, messageMaps };
  }
  
  // Extract and analyze user data from the component
  function analyzeUserData() {
    const { userMapComponent, messageMaps } = findReactComponents();
    
    if (!messageMaps.length) {
      console.error('❌ Could not find user data map in the application');
      return null;
    }
    
    console.log(`Found ${messageMaps.length} potential user Maps in React components`);
    
    // Take the first Map that looks like user data
    const userMap = messageMaps[0].map;
    
    // Basic stats
    console.log(`User Map contains ${userMap.size} users`);
    
    // Analyze user data quality
    const userData = Array.from(userMap.entries()).map(([id, user]) => {
      const displayName = user.display_name || user.real_name || user.name || 'Unknown';
      const hasValidName = displayName !== 'Unknown';
      
      return {
        id,
        display_name: user.display_name,
        real_name: user.real_name,
        name: user.name,
        effective_name: displayName,
        has_avatar: !!user.profile_image_url,
        has_valid_name: hasValidName
      };
    });
    
    // Log user data table
    console.table(userData);
    
    // Check for missing or problematic user data
    const problemUsers = userData.filter(u => !u.has_valid_name);
    if (problemUsers.length) {
      console.warn(`⚠️ Found ${problemUsers.length} users with missing or invalid names`);
      console.log('Problem users:', problemUsers);
    } else {
      console.log('✅ All users have valid display names');
    }
    
    return { userMap, userData, problemUsers };
  }
  
  // Find and analyze message elements
  function analyzeMessages() {
    // Try to find message containers
    const messageContainers = Array.from(document.querySelectorAll('.chakra-stack > .chakra-box, [data-testid="message-item"]'));
    
    if (!messageContainers.length) {
      console.warn('No message elements found in the DOM');
      return [];
    }
    
    console.log(`Found ${messageContainers.length} message elements in the DOM`);
    
    // Extract message data
    const messages = messageContainers.map(container => {
      // Extract user name
      const nameElement = container.querySelector('b, [font-weight="bold"], [data-testid="user-name"]');
      const name = nameElement ? nameElement.textContent.trim() : 'Not found';
      
      // Extract text content
      const textElement = container.querySelector('p, .chakra-text:not([font-weight="bold"])');
      const text = textElement ? textElement.textContent.trim() : 'No text';
      
      // Check if it shows as Unknown User
      const isUnknown = name === 'Unknown User';
      
      return { element: container, name, text, isUnknown };
    });
    
    // Check for unknown users in the UI
    const unknownMessages = messages.filter(m => m.isUnknown);
    if (unknownMessages.length) {
      console.warn(`⚠️ Found ${unknownMessages.length} messages showing "Unknown User"`);
      console.log('Sample of unknown user messages:', unknownMessages.slice(0, 3));
    } else {
      console.log('✅ No messages showing "Unknown User"');
    }
    
    return messages;
  }
  
  // Monitor API calls for debugging
  function monitorApiCalls() {
    const originalFetch = window.fetch;
    let userApiResponses = [];
    
    // Replace fetch to monitor API calls
    window.fetch = async function(...args) {
      const url = args[0];
      
      try {
        const response = await originalFetch.apply(this, args);
        
        // Only intercept our own API calls related to users
        if (url.toString().includes('/users')) {
          const clone = response.clone();
          clone.json().then(data => {
            userApiResponses.push({ url: url.toString(), data });
            console.log('📥 Captured user API response:', { url: url.toString(), data });
          }).catch(err => console.error('Error parsing response:', err));
        }
        
        return response;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    };
    
    console.log('🔄 API monitoring enabled. User API responses will be logged.');
    
    return {
      getResponses: () => userApiResponses,
      cleanup: () => {
        window.fetch = originalFetch;
        console.log('API monitoring disabled');
      }
    };
  }
  
  // Fix user data issues
  function fixUserDataIssues() {
    // Find the component with user data
    const { messageMaps } = findReactComponents();
    
    if (!messageMaps.length) {
      console.error('❌ Cannot fix user data: Map not found');
      return false;
    }
    
    // Get the first user Map
    const userMap = messageMaps[0].map;
    
    // Backup the original Map
    const originalEntries = Array.from(userMap.entries());
    
    // Count unknown users before fix
    let unknownBefore = 0;
    userMap.forEach(user => {
      if (!user.display_name && !user.real_name && (!user.name || user.name === 'Unknown User')) {
        unknownBefore++;
      }
    });
    
    // Apply fixes
    console.log(`Attempting to fix ${unknownBefore} unknown users...`);
    
    // Fix 1: Ensure unique placeholder names
    let fixedCount = 0;
    userMap.forEach((user, id) => {
      const noDisplayName = !user.display_name;
      const noRealName = !user.real_name;
      const badName = !user.name || user.name === 'Unknown User';
      
      if (noDisplayName && noRealName && badName) {
        // Create a unique placeholder name
        const newUser = {...user};
        newUser.name = `User ${id.substring(0, 6)}`;
        userMap.set(id, newUser);
        fixedCount++;
      }
    });
    
    // Count unknown users after fix
    let unknownAfter = 0;
    userMap.forEach(user => {
      if (!user.display_name && !user.real_name && (!user.name || user.name === 'Unknown User')) {
        unknownAfter++;
      }
    });
    
    console.log(`✅ Fixed ${fixedCount} users. Unknown users: ${unknownBefore} → ${unknownAfter}`);
    
    // Force a re-render
    const event = new Event('resize');
    window.dispatchEvent(event);
    
    return true;
  }
  
  // Run the analysis
  const userData = analyzeUserData();
  const messages = analyzeMessages();
  const apiMonitor = monitorApiCalls();
  
  // Provide fix command
  window.fixUserData = fixUserDataIssues;
  console.log('💡 To fix user data issues, run: fixUserData()');
  
  // Cleanup function
  window.stopUserInspector = function() {
    apiMonitor.cleanup();
    console.log('Inspector stopped and resources cleaned up');
  };
  
  console.log('🔄 Inspector active. APIs are being monitored.');
  console.log('💡 To stop the inspector, run: stopUserInspector()');
  
  console.groupEnd();
})();
