import React, { useMemo, useEffect, useState } from 'react';
import { Text, Box, useColorModeValue } from '@chakra-ui/react';
import { useUserCache, SlackUser } from './SlackUserDisplay';
import env from '../../config/env';

interface MessageTextProps {
  text: string;
  workspaceId: string;
}

/**
 * Component to format Slack message text with proper handling of:
 * - User mentions (<@U12345>)
 * - Newlines
 * - URLs (future enhancement)
 * - Code blocks (future enhancement)
 * - Emojis (future enhancement)
 */
const MessageText: React.FC<MessageTextProps> = ({ text, workspaceId }) => {
  const userCache = useUserCache();
  const mentionColor = useColorModeValue('blue.500', 'blue.300');
  const [userMap, setUserMap] = useState<Map<string, SlackUser>>(new Map());
  
  // Extract all user mentions from the text and fetch their data directly
  useEffect(() => {
    if (!text || !workspaceId) return;
    
    // First extract all user IDs mentioned in the text
    const userMentionRegex = /<@([A-Z0-9]+)>/g;
    let match;
    const userIds: string[] = [];
    
    // Reset the text and match all user IDs
    let textCopy = text;
    while ((match = userMentionRegex.exec(textCopy)) !== null) {
      userIds.push(match[1]);
    }
    
    // If no user IDs found, return early
    if (userIds.length === 0) return;
    
    // Fetch user data directly from the API
    const fetchUsers = async () => {
      try {
        const userIdsParam = userIds.map(id => `user_ids=${encodeURIComponent(id)}`).join('&');
        const url = `${env.apiUrl}/slack/workspaces/${workspaceId}/users?${userIdsParam}&fetch_from_slack=true`;
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': window.location.origin
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching users: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.users && Array.isArray(data.users)) {
          const newUserMap = new Map<string, SlackUser>();
          
          // Add each user to the map
          data.users.forEach((user: SlackUser) => {
            if (user && user.slack_id) {
              newUserMap.set(user.slack_id, user);
            }
          });
          
          setUserMap(newUserMap);
        }
      } catch (error) {
        console.error('Error fetching users for message:', error);
      }
    };
    
    fetchUsers();
  }, [text, workspaceId]);

  // Process the text to replace user mentions and handle formatting
  const processedContent = useMemo(() => {
    if (!text) return '';
    
    // We'll handle newlines at the end
    let processedText = text;
    
    // Find all user mentions in the format <@U12345>
    const userMentionRegex = /<@([A-Z0-9]+)>/g;
    let match;
    
    // Create an array to hold parts of the message
    const messageParts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // For each match, split the text and insert the user mention component
    while ((match = userMentionRegex.exec(processedText)) !== null) {
      const userId = match[1];
      const user = userCache.getUser(userId);
      
      // Add the text before the mention
      if (match.index > lastIndex) {
        const textBefore = processedText.substring(lastIndex, match.index);
        // Split by newlines and join with <br/> elements
        const parts = textBefore.split('\n');
        if (parts.length > 1) {
          parts.forEach((part, index) => {
            messageParts.push(<React.Fragment key={`text-${lastIndex}-${index}`}>{part}</React.Fragment>);
            if (index < parts.length - 1) {
              messageParts.push(<br key={`br-${lastIndex}-${index}`} />);
            }
          });
        } else {
          messageParts.push(<React.Fragment key={`text-${lastIndex}`}>{textBefore}</React.Fragment>);
        }
      }
      
      // Add the mention - first check our direct userMap
      let displayName = userId;
      const mapUser = userMap.get(userId);
      
      if (mapUser) {
        displayName = mapUser.real_name || mapUser.display_name || mapUser.name || userId;
      } else if (user) {
        // Fall back to the user cache
        displayName = user.real_name || user.display_name || user.name || userId;
      }
      
      messageParts.push(
        <Text 
          as="span" 
          key={`mention-${match.index}`} 
          color={mentionColor}
          fontWeight="medium"
        >
          @{displayName}
        </Text>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add the remaining text
    if (lastIndex < processedText.length) {
      const textAfter = processedText.substring(lastIndex);
      // Split by newlines and join with <br/> elements
      const parts = textAfter.split('\n');
      if (parts.length > 1) {
        parts.forEach((part, index) => {
          messageParts.push(<React.Fragment key={`text-end-${index}`}>{part}</React.Fragment>);
          if (index < parts.length - 1) {
            messageParts.push(<br key={`br-end-${index}`} />);
          }
        });
      } else {
        messageParts.push(<React.Fragment key={`text-end`}>{textAfter}</React.Fragment>);
      }
    }
    
    return <>{messageParts}</>;
  }, [text, userCache, mentionColor, userMap]);

  return (
    <Text textAlign="left">
      {processedContent}
    </Text>
  );
};

export default MessageText;
