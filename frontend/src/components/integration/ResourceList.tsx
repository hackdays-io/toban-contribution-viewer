import React from 'react'
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  TagLabel,
  Text,
  IconButton,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react'
import { FiSettings } from 'react-icons/fi'
import { ServiceResource, ResourceType } from '../../lib/integrationService'

interface ResourceListProps {
  resources: ServiceResource[]
  integrationId: string
}

/**
 * Component to display a list of integration resources
 */
const ResourceList: React.FC<ResourceListProps> = ({ resources }) => {
  const tableBg = useColorModeValue('white', 'gray.800')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')

  // Helper function to get readable resource type
  const getReadableResourceType = (type: ResourceType): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <Box overflowX="auto">
      <Table variant="simple" bg={tableBg} borderRadius="lg" overflow="hidden">
        <Thead bg={tableHeaderBg}>
          <Tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>External ID</Th>
            <Th>Last Synced</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {resources.map((resource) => (
            <Tr key={resource.id}>
              <Td fontWeight="medium">{resource.name}</Td>
              <Td>
                <Tag size="sm" colorScheme="blue" borderRadius="full">
                  <TagLabel>
                    {getReadableResourceType(
                      resource.resource_type as ResourceType
                    )}
                  </TagLabel>
                </Tag>
              </Td>
              <Td>
                <Text fontSize="sm" isTruncated maxW="200px">
                  {resource.external_id}
                </Text>
              </Td>
              <Td>
                {resource.last_synced_at
                  ? new Date(resource.last_synced_at).toLocaleString()
                  : 'Never'}
              </Td>
              <Td>
                <HStack spacing={1}>
                  <IconButton
                    aria-label="View resource"
                    icon={<FiSettings />}
                    size="sm"
                    variant="ghost"
                  />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  )
}

export default ResourceList
