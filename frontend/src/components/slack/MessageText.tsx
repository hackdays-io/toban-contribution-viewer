import React from 'react';
import { Text, Box } from '@chakra-ui/react';
import SlackUserDisplay from './SlackUserDisplay';

interface MessageTextProps {
  text: string;
  workspaceId: string; // Required to fetch user data
  resolveMentions?: boolean; // Whether to resolve user mentions with SlackUserDisplay
}

/**
 * Component that formats Slack message text:
 * - Replaces newlines with line breaks
 * - Replaces user mentions like <@U12345> with user names using SlackUserDisplay
 * - Falls back to showing @U12345 if resolveMentions is false
 */
const MessageText: React.FC<MessageTextProps> = ({ 
  text, 
  workspaceId, 
  resolveMentions = true 
}) => {
  if (!text) return null;
  
  // Regular expression to find Slack user mentions in the format <@U12345>
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  
  // Extract all unique user mentions from the text
  const userMentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (!userMentions.includes(match[1])) {
      userMentions.push(match[1]);
    }
  }
  
  // Reset regex index
  mentionRegex.lastIndex = 0;
  
  // If we're not resolving mentions, just replace with @userId format
  if (!resolveMentions) {
    const formattedText = text
      // Replace <@U12345> with @U12345
      .replace(mentionRegex, '@$1')
      // Replace newlines with <br /> elements
      .split('\n')
      .map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ));
    
    return (
      <Text textAlign="left">
        {formattedText}
      </Text>
    );
  }
  
  // Split text into segments - text and mentions
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Reset regex index again
  mentionRegex.lastIndex = 0;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      const textSegment = text.substring(lastIndex, match.index)
        .split('\n')
        .map((line, i) => (
          <React.Fragment key={`text-${lastIndex}-${i}`}>
            {i > 0 && <br />}
            {line}
          </React.Fragment>
        ));
      segments.push(textSegment);
    }
    
    // Add the user mention with SlackUserDisplay
    segments.push(
      <Box 
        as="span" 
        key={`mention-${match.index}`} 
        display="inline-flex" 
        alignItems="center"
        verticalAlign="middle"
        color="blue.500"
      >
        @<SlackUserDisplay 
          userId={match[1]} 
          workspaceId={workspaceId}
          displayFormat="username"
          fetchFromSlack={true}
          asComponent="span"
        />
      </Box>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text after the last mention
  if (lastIndex < text.length) {
    const textSegment = text.substring(lastIndex)
      .split('\n')
      .map((line, i) => (
        <React.Fragment key={`text-${lastIndex}-${i}`}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ));
    segments.push(textSegment);
  }
  
  return (
    <Text textAlign="left">
      {segments}
    </Text>
  );
};

export default MessageText;
