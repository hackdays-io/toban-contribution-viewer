import React from 'react';
import { Text } from '@chakra-ui/react';

interface MessageTextProps {
  text: string;
}

/**
 * Component that formats Slack message text:
 * - Replaces newlines with line breaks
 * - Replaces user mentions like <@U12345> with @U12345
 */
const MessageText: React.FC<MessageTextProps> = ({ text }) => {
  if (!text) return null;
  
  // Replace Slack user mentions with readable format
  const formattedText = text
    // Replace <@U12345> with @U12345
    .replace(/<@([A-Z0-9]+)>/g, '@$1')
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
};

export default MessageText;
