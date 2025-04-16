import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Button,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  HStack,
  IconButton,
  Tag,
  TagLabel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Alert,
  AlertIcon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useToast,
  Select,
  Badge,
  Heading,
  useColorModeValue,
  InputGroup,
  Input,
  InputRightElement,
  Checkbox,
  VStack,
  Divider,
  Collapse,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Stack,
} from '@chakra-ui/react'
import {
  FiRefreshCw,
  FiSettings,
  FiFilter,
  FiSearch,
  FiTrash2,
  FiShare2,
  FiChevronRight,
  FiChevronLeft,
  FiMoreVertical,
} from 'react-icons/fi'
import integrationService, {
  ServiceResource,
  ResourceType,
  AccessLevel,
  ResourceAccess,
  TeamInfo,
} from '../../lib/integrationService'

// Helper function to get readable resource type name
const getReadableResourceType = (type: ResourceType): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Resource filters interface
interface ResourceFilters {
  search: string
  types: ResourceType[]
  syncedOnly: boolean
}

interface ResourceListProps {
  integrationId: string
  resources?: ServiceResource[]
  isLoading?: boolean
  error?: Error | null
  onSync?: () => Promise<void>
  isSyncing?: boolean
  teams?: TeamInfo[]
  resourcesPerPage?: number
}

/**
 * A reusable component for displaying and managing integration resources.
 */
const ResourceList: React.FC<ResourceListProps> = ({
  integrationId,
  resources: initialResources,
  isLoading: isLoadingProp = false,
  error: errorProp = null,
  onSync,
  isSyncing: isSyncingProp = false,
  teams = [],
  resourcesPerPage = 10,
}) => {
  // State
  const [resources, setResources] = useState<ServiceResource[]>([])
  const [isLoading, setIsLoading] = useState(isLoadingProp)
  const [error, setError] = useState<Error | null>(errorProp)
  const [isSyncing, setIsSyncing] = useState(isSyncingProp)
  const [selectedResource, setSelectedResource] =
    useState<ServiceResource | null>(null)
  const [accessData, setAccessData] = useState<ResourceAccess[]>([])
  const [loadingAccess, setLoadingAccess] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<ResourceFilters>({
    search: '',
    types: [],
    syncedOnly: false,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [availableTypes, setAvailableTypes] = useState<ResourceType[]>([])

  // UI State
  const {
    isOpen: isAccessOpen,
    onOpen: onAccessOpen,
    onClose: onAccessClose,
  } = useDisclosure()
  const toast = useToast()

  // UI Colors
  const tableBg = useColorModeValue('white', 'gray.800')
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.700')

  // Fetch resources from the API - wrap in useMemo to avoid dependency issues
  const fetchResources = useMemo(
    () => async () => {
      try {
        setIsLoading(true)
        setError(null)

        const result = await integrationService.getResources(
          integrationId,
          filters.types.length > 0 ? filters.types : undefined
        )

        if (integrationService.isApiError(result)) {
          throw new Error(result.message)
        }

        setResources(result)

        // Extract all resource types from the resources
        const types = [...new Set(result.map((r) => r.resource_type))]
        setAvailableTypes(types as ResourceType[])
      } catch (error) {
        setError(
          error instanceof Error ? error : new Error('Failed to load resources')
        )
      } finally {
        setIsLoading(false)
      }
    },
    [integrationId, filters.types]
  )

  // Fetch resources if not provided
  useEffect(() => {
    if (initialResources) {
      setResources(initialResources)

      // Extract all resource types from the resources
      const types = [...new Set(initialResources.map((r) => r.resource_type))]
      setAvailableTypes(types as ResourceType[])
    } else {
      fetchResources()
    }
  }, [initialResources, fetchResources])

  // Update loading state from props
  useEffect(() => {
    setIsLoading(isLoadingProp)
  }, [isLoadingProp])

  // Update error state from props
  useEffect(() => {
    setError(errorProp)
  }, [errorProp])

  // Update syncing state from props
  useEffect(() => {
    setIsSyncing(isSyncingProp)
  }, [isSyncingProp])

  // Handle resource sync
  const handleSyncResources = async () => {
    try {
      setIsSyncing(true)

      if (onSync) {
        await onSync()
      } else {
        const result = await integrationService.syncResources(
          integrationId,
          filters.types.length > 0 ? (filters.types as string[]) : undefined
        )

        if (integrationService.isApiError(result)) {
          throw new Error(result.message)
        }

        toast({
          title: 'Resources Synced',
          description: 'Successfully synced resources from the service',
          status: 'success',
          duration: 5000,
          isClosable: true,
        })

        // Refresh resources
        await fetchResources()
      }
    } catch (error) {
      setError(
        error instanceof Error ? error : new Error('Failed to sync resources')
      )
      toast({
        title: 'Sync Failed',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Fetch resource access
  const fetchResourceAccess = async (resourceId: string) => {
    try {
      setLoadingAccess(true)
      // This endpoint doesn't exist yet, so we'll simulate it for now
      // const result = await integrationService.getResourceAccess(integrationId, resourceId);

      // For now, let's simulate a response
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Mock data
      const mockAccess: ResourceAccess[] = []
      // Include a couple of demo entries if teams are available
      if (teams.length > 0) {
        teams.slice(0, 2).forEach((team, index) => {
          mockAccess.push({
            id: `access-${index}`,
            resource_id: resourceId,
            team_id: team.id,
            access_level: index === 0 ? AccessLevel.ADMIN : AccessLevel.READ,
            granted_by: {
              id: 'user-1',
              name: 'Admin User',
              email: 'admin@example.com',
            },
            team: team,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        })
      }

      setAccessData(mockAccess)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to load resource permissions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoadingAccess(false)
    }
  }

  // Open permission modal
  const handleOpenPermissions = (resource: ServiceResource) => {
    setSelectedResource(resource)
    fetchResourceAccess(resource.id)
    onAccessOpen()
  }

  // Used in the grant access form in the modal
  const handleGrantAccess = async (
    teamId: string,
    accessLevel: AccessLevel
  ) => {
    if (!selectedResource) return

    try {
      const result = await integrationService.grantResourceAccess(
        integrationId,
        selectedResource.id,
        { team_id: teamId, access_level: accessLevel }
      )

      if (integrationService.isApiError(result)) {
        throw new Error(result.message)
      }

      toast({
        title: 'Permission Updated',
        description: 'Resource permission updated successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      // Refresh access data
      await fetchResourceAccess(selectedResource.id)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update permission',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // Handle permission removal
  const handleRemovePermission = async (accessId: string) => {
    // This endpoint doesn't exist yet, so we'll simulate it
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Remove from local state
      setAccessData(accessData.filter((access) => access.id !== accessId))

      toast({
        title: 'Permission Removed',
        description: 'Resource permission removed successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to remove permission',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  // Handle search and filtering
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value })
    setCurrentPage(1) // Reset to first page on filter change
  }

  const handleFilterTypeToggle = (type: ResourceType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type]

    setFilters({ ...filters, types: newTypes })
    setCurrentPage(1) // Reset to first page on filter change
  }

  const handleFilterSyncedToggle = () => {
    setFilters({ ...filters, syncedOnly: !filters.syncedOnly })
    setCurrentPage(1) // Reset to first page on filter change
  }

  const handleClearFilters = () => {
    setFilters({
      search: '',
      types: [],
      syncedOnly: false,
    })
    setCurrentPage(1) // Reset to first page on filter change
  }

  // Calculate filtered and paginated resources
  const filteredResources = useMemo(() => {
    let result = [...resources]

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(
        (resource) =>
          resource.name.toLowerCase().includes(searchLower) ||
          resource.external_id.toLowerCase().includes(searchLower)
      )
    }

    // Apply type filter
    if (filters.types.length > 0) {
      result = result.filter((resource) =>
        filters.types.includes(resource.resource_type as ResourceType)
      )
    }

    // Apply synced only filter
    if (filters.syncedOnly) {
      result = result.filter((resource) => Boolean(resource.last_synced_at))
    }

    return result
  }, [resources, filters])

  // Calculate pagination
  const totalPages = Math.ceil(filteredResources.length / resourcesPerPage)
  const paginatedResources = useMemo(() => {
    const start = (currentPage - 1) * resourcesPerPage
    const end = start + resourcesPerPage
    return filteredResources.slice(start, end)
  }, [filteredResources, currentPage, resourcesPerPage])

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Render filter badge for UI feedback
  const renderFilterBadge = () => {
    const filterCount =
      (filters.search ? 1 : 0) +
      filters.types.length +
      (filters.syncedOnly ? 1 : 0)

    if (filterCount === 0) return null

    return (
      <Badge ml={2} colorScheme="blue" borderRadius="full" px={2}>
        {filterCount}
      </Badge>
    )
  }

  // Get access level label
  const getAccessLevelLabel = (level: AccessLevel) => {
    switch (level) {
      case AccessLevel.ADMIN:
        return 'Admin'
      case AccessLevel.WRITE:
        return 'Write'
      case AccessLevel.READ:
        return 'Read'
      default:
        return level
    }
  }

  // Get access level color
  const getAccessLevelColor = (level: AccessLevel) => {
    switch (level) {
      case AccessLevel.ADMIN:
        return 'purple'
      case AccessLevel.WRITE:
        return 'green'
      case AccessLevel.READ:
        return 'blue'
      default:
        return 'gray'
    }
  }

  // Render
  return (
    <Box width="100%">
      {/* Resources Header */}
      <Flex
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        flexDirection={{ base: 'column', md: 'row' }}
        gap={4}
      >
        <Heading size="md">Resources</Heading>
        <HStack spacing={2}>
          <Button
            leftIcon={<FiFilter />}
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
          >
            Filters
            {renderFilterBadge()}
          </Button>
          <Button
            leftIcon={<FiRefreshCw />}
            onClick={handleSyncResources}
            isLoading={isSyncing}
            size="sm"
            colorScheme="blue"
          >
            Sync Resources
          </Button>
        </HStack>
      </Flex>

      {/* Filters Section */}
      <Collapse in={showFilters} animateOpacity>
        <Box
          p={4}
          bg={useColorModeValue('gray.50', 'gray.700')}
          borderRadius="md"
          mb={4}
        >
          <VStack spacing={4} align="stretch">
            <HStack justifyContent="space-between">
              <Text fontWeight="bold">Resource Filters</Text>
              <Button
                size="xs"
                variant="ghost"
                onClick={handleClearFilters}
                isDisabled={
                  !filters.search &&
                  filters.types.length === 0 &&
                  !filters.syncedOnly
                }
              >
                Clear All
              </Button>
            </HStack>

            <Divider />

            {/* Search Filter */}
            <FormControl>
              <FormLabel fontSize="sm">Search Resources</FormLabel>
              <InputGroup size="sm">
                <Input
                  placeholder="Search by name or ID..."
                  value={filters.search}
                  onChange={handleSearchChange}
                />
                <InputRightElement>
                  <FiSearch />
                </InputRightElement>
              </InputGroup>
            </FormControl>

            {/* Resource Type Filter */}
            {availableTypes.length > 0 && (
              <FormControl>
                <FormLabel fontSize="sm">Resource Types</FormLabel>
                <Flex flexWrap="wrap" gap={2}>
                  {availableTypes.map((type) => (
                    <Tag
                      key={type}
                      size="md"
                      borderRadius="full"
                      variant={
                        filters.types.includes(type) ? 'solid' : 'outline'
                      }
                      colorScheme={
                        filters.types.includes(type) ? 'blue' : 'gray'
                      }
                      cursor="pointer"
                      onClick={() => handleFilterTypeToggle(type)}
                    >
                      <TagLabel>{getReadableResourceType(type)}</TagLabel>
                    </Tag>
                  ))}
                </Flex>
              </FormControl>
            )}

            {/* Synced Only Filter */}
            <FormControl>
              <Checkbox
                isChecked={filters.syncedOnly}
                onChange={handleFilterSyncedToggle}
                size="sm"
              >
                Show only synced resources
              </Checkbox>
            </FormControl>
          </VStack>
        </Box>
      </Collapse>

      {/* Error Message */}
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          Error: {error.message}
        </Alert>
      )}

      {/* Resources Table */}
      {isLoading && !paginatedResources.length ? (
        <Flex justify="center" align="center" p={10}>
          <Spinner />
          <Text ml={3}>Loading resources...</Text>
        </Flex>
      ) : paginatedResources.length === 0 ? (
        <Box
          p={6}
          textAlign="center"
          borderWidth="1px"
          borderStyle="dashed"
          borderRadius="lg"
        >
          <Text mb={4}>
            {resources.length > 0
              ? 'No resources match the current filters.'
              : 'No resources found for this integration.'}
          </Text>
          {resources.length > 0 ? (
            <Button onClick={handleClearFilters} colorScheme="blue" size="sm">
              Clear Filters
            </Button>
          ) : (
            <Button
              onClick={handleSyncResources}
              colorScheme="blue"
              leftIcon={<FiRefreshCw />}
              isLoading={isSyncing}
            >
              Sync Now
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Box overflowX="auto">
            <Table
              variant="simple"
              bg={tableBg}
              borderRadius="lg"
              overflow="hidden"
            >
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
                {paginatedResources.map((resource) => (
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
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          aria-label="Resource options"
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem
                            icon={<FiShare2 />}
                            onClick={() => handleOpenPermissions(resource)}
                          >
                            Manage Access
                          </MenuItem>
                          <MenuItem icon={<FiSettings />}>Settings</MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Flex justifyContent="space-between" mt={4} alignItems="center">
              <Text fontSize="sm">
                Showing {(currentPage - 1) * resourcesPerPage + 1} to{' '}
                {Math.min(
                  currentPage * resourcesPerPage,
                  filteredResources.length
                )}{' '}
                of {filteredResources.length} resources
              </Text>
              <HStack>
                <IconButton
                  aria-label="Previous page"
                  icon={<FiChevronLeft />}
                  size="sm"
                  isDisabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                />
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <Button
                      key={page}
                      size="sm"
                      variant={page === currentPage ? 'solid' : 'outline'}
                      onClick={() => handlePageChange(page)}
                      display={{
                        base:
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                            ? 'flex'
                            : 'none',
                        md: 'flex',
                      }}
                    >
                      {page}
                    </Button>
                  )
                )}
                <IconButton
                  aria-label="Next page"
                  icon={<FiChevronRight />}
                  size="sm"
                  isDisabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                />
              </HStack>
            </Flex>
          )}
        </>
      )}

      {/* Resource Access Modal */}
      <Modal isOpen={isAccessOpen} onClose={onAccessClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Manage Resource Access
            {selectedResource && (
              <Text fontSize="sm" fontWeight="normal" mt={1} color="gray.500">
                {selectedResource.name}
              </Text>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {loadingAccess ? (
              <Flex justify="center" p={8}>
                <Spinner />
              </Flex>
            ) : (
              <>
                {/* Current Access Table */}
                <Box mb={6}>
                  <Text fontWeight="bold" mb={2}>
                    Current Access
                  </Text>
                  {accessData.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      No teams have explicit access to this resource.
                    </Text>
                  ) : (
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Team</Th>
                          <Th>Access Level</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {accessData.map((access) => (
                          <Tr key={access.id}>
                            <Td>{access.team.name}</Td>
                            <Td>
                              <Badge
                                colorScheme={getAccessLevelColor(
                                  access.access_level
                                )}
                              >
                                {getAccessLevelLabel(access.access_level)}
                              </Badge>
                            </Td>
                            <Td>
                              <IconButton
                                aria-label="Remove access"
                                icon={<FiTrash2 />}
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() =>
                                  handleRemovePermission(access.id)
                                }
                              />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  )}
                </Box>

                {/* Grant Access Form */}
                {teams.length > 0 && (
                  <Box>
                    <Text fontWeight="bold" mb={2}>
                      Grant Access
                    </Text>
                    <FormControl mb={4}>
                      <FormLabel fontSize="sm">Select Team</FormLabel>
                      <Select placeholder="Select team" size="sm">
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl mb={4}>
                      <FormLabel fontSize="sm">Access Level</FormLabel>
                      <RadioGroup
                        defaultValue={AccessLevel.READ}
                        name="radio-group"
                      >
                        <Stack direction="row" spacing={4}>
                          <Radio value={AccessLevel.READ}>Read</Radio>
                          <Radio value={AccessLevel.WRITE}>Write</Radio>
                          <Radio value={AccessLevel.ADMIN}>Admin</Radio>
                        </Stack>
                      </RadioGroup>
                    </FormControl>

                    <Button
                      colorScheme="blue"
                      size="sm"
                      onClick={() => {
                        const selectElement = document.querySelector('select')
                        const radioElement = document.querySelector(
                          'input[name="radio-group"]:checked'
                        ) as HTMLInputElement
                        handleGrantAccess(
                          selectElement ? selectElement.value : '',
                          radioElement
                            ? (radioElement.value as AccessLevel)
                            : AccessLevel.READ
                        )
                      }}
                    >
                      Grant Access
                    </Button>
                  </Box>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onAccessClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default ResourceList
