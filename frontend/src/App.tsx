import { Box, ChakraProvider, Heading, Text } from '@chakra-ui/react'
import './App.css'

function App() {
  return (
    <ChakraProvider>
      <Box p={5} textAlign="center">
        <Heading as="h1" size="xl" mb={4}>
          Toban Contribution Viewer
        </Heading>
        <Text fontSize="lg">
          Visualize and track contributions across various platforms
        </Text>
      </Box>
    </ChakraProvider>
  )
}

export default App
