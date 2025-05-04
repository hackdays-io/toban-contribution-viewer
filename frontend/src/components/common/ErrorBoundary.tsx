import { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component to catch JavaScript errors in child components
 * and display a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box
          p={5}
          borderWidth="1px"
          borderRadius="lg"
          bg="red.50"
          color="red.800"
        >
          <VStack spacing={4} align="start">
            <Heading size="md">Something went wrong</Heading>
            <Text>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Button
              colorScheme="red"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </VStack>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
