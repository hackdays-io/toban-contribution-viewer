import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import MessageText from '../../../components/slack/MessageText';

describe('MessageText', () => {
  it('renders plain text correctly', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello, world!" />
      </ChakraProvider>
    );
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('handles newlines correctly', () => {
    render(
      <ChakraProvider>
        <MessageText text="Line 1\nLine 2" />
      </ChakraProvider>
    );
    
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
  });

  it('formats user mentions correctly', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345>!" />
      </ChakraProvider>
    );
    
    expect(screen.getByText(/Hello @U12345!/)).toBeInTheDocument();
  });

  it('handles multiple user mentions', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345> and <@U67890>!" />
      </ChakraProvider>
    );
    
    expect(screen.getByText(/Hello @U12345 and @U67890!/)).toBeInTheDocument();
  });

  it('handles text with both newlines and mentions', () => {
    render(
      <ChakraProvider>
        <MessageText text="Hello <@U12345>\nHow are you?" />
      </ChakraProvider>
    );
    
    expect(screen.getByText(/Hello @U12345/)).toBeInTheDocument();
    expect(screen.getByText("How are you?")).toBeInTheDocument();
  });
});
