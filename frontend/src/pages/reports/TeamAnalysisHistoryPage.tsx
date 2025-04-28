import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Icon,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Flex,
  HStack,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  Select,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react'
import { 
  FiRefreshCw, 
  FiEye, 
  FiChevronRight, 
  FiPlusCircle, 
  FiFileText, 
  FiFilter
} from 'react-icons/fi'
import PageTitle from '../../components/layout/PageTitle'
import integrationService from '../../lib/integrationService'
import useAuth from '../../context/useAuth'

// Status styles
const getStatusInfo = (
  status: string
): {
  colorScheme: 'green' | 'yellow' | 'blue' | 'red' | 'gray'
  label: string
} => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { colorScheme: 'green', label: 'Completed' }
    case 'pending':
      return { colorScheme: 'yellow', label: 'Pending' }
    case 'in_progress':
      return { colorScheme: 'blue', label: 'In Progress' }
    case 'failed':
      return { colorScheme: 'red', label: 'Failed' }
    default:
      return { colorScheme: 'gray', label: status }
  }
}

interface AnalysisReport {
  id: string
  title: string
  description?: string
  status: string
  resource_count: number
  created_at: string
  updated_at: string
  created_by: {
    id: string
    name?: string
    email?: string
  }
}

const TeamAnalysisHistoryPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate() // Used in button click handlers 
  const toast = useToast() // Used for error notifications
  const { teamContext } = useAuth()
  
  const [reports, setReports] = useState<AnalysisReport[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(0)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [rowsPerPage, setRowsPerPage] = useState<number>(10)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const errorBgColor = useColorModeValue('red.50', 'red.900')
  const errorTextColor = useColorModeValue('red.600', 'red.200')

  // Get current team name from team context
  const currentTeam = teamContext.teams?.find(team => team.id === teamId)
  const teamName = currentTeam?.name || 'Team'

  const fetchReports = async () => {
    if (!teamId) return

    setLoading(true)
    setError(null)

    try {
      console.log('Fetching reports with params:', {
        teamId,
        page: page + 1,
        rowsPerPage,
        statusFilter: statusFilter || undefined
      });
      
      const response = await integrationService.getCrossResourceReports(
        teamId,
        page + 1, // API uses 1-based indexing
        rowsPerPage,
        statusFilter || undefined
      )

      // Add debugging to understand the response structure
      console.log('API Response:', response);
      
      if (integrationService.isApiError(response)) {
        setError(`Error loading reports: ${response.message}`)
        setReports([])
      } else {
        // Handle different possible response structures
        let reportItems = [];
        let totalItems = 0;
        
        if (Array.isArray(response)) {
          // Direct array response
          console.log('Response is array with', response.length, 'items');
          reportItems = response;
          totalItems = response.length;
        } else if (response.items && Array.isArray(response.items)) {
          // Object with items array
          console.log('Response has items array with', response.items.length, 'items');
          reportItems = response.items;
          totalItems = response.total || response.items.length;
        } else if (typeof response === 'object') {
          // Unknown structure - try to extract data intelligently
          console.log('Complex response structure:', Object.keys(response));
          
          // Try different common property names for items
          const possibleArrayProps = ['data', 'reports', 'results', 'content', 'records'];
          for (const prop of possibleArrayProps) {
            if (response[prop] && Array.isArray(response[prop])) {
              reportItems = response[prop];
              totalItems = response.total || response.count || reportItems.length;
              console.log(`Found data in property "${prop}" with ${reportItems.length} items`);
              break;
            }
          }
          
          // If we still don't have items, look for any array property
          if (reportItems.length === 0) {
            for (const key in response) {
              if (Array.isArray(response[key]) && response[key].length > 0) {
                reportItems = response[key];
                totalItems = response.total || response.count || reportItems.length;
                console.log(`Found data in array property "${key}" with ${reportItems.length} items`);
                break;
              }
            }
          }
        }

        // Log the first item to see its structure
        if (reportItems.length > 0) {
          console.log('First raw item structure:', reportItems[0]);
        }
        
        // Normalize the data format to match our expected structure
        const normalizedReports = reportItems.map(item => {
          // Log any fields that might contain resource counts
          const resourceFields = {};
          ['resource_count', 'resourceCount', 'resources', 'total_resources', 'totalResources', 'channel_count'].forEach(field => {
            if (item[field] !== undefined) {
              resourceFields[field] = item[field];
            }
          });
          console.log('Resource fields found:', resourceFields);
          
          return {
            id: item.id,
            title: item.title || item.name || 'Untitled Analysis',
            description: item.description,
            status: item.status || 'unknown',
            // Look for resource count in more possible fields
            resource_count: item.resource_count || item.resourceCount || item.total_resources || 
                           item.totalResources || item.channel_count || 
                           (Array.isArray(item.resources) ? item.resources.length : 0) || 0,
            created_at: item.created_at || item.createdAt || item.timestamp || new Date().toISOString(),
            updated_at: item.updated_at || item.updatedAt || item.created_at || new Date().toISOString(),
            created_by: {
              id: item.created_by?.id || item.createdBy?.id || 'unknown',
              name: item.created_by?.name || item.createdBy?.name,
              email: item.created_by?.email || item.createdBy?.email
            }
          };
        });
        
        console.log('Normalized reports:', normalizedReports);
        setReports(normalizedReports);
        setTotalCount(totalItems);
      }
    } catch (err) {
      setError('Failed to load analysis reports')
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, page, rowsPerPage, statusFilter])

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchReports()
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleStatusFilterChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatusFilter(event.target.value)
    setPage(0) // Reset to first page when filter changes
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      // Format as "MMM d, yyyy h:mm AM/PM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      })
    } catch {
      return dateString
    }
  }

  return (
    <Box p={5}>
      {/* Breadcrumb navigation */}
      <Breadcrumb
        spacing="8px"
        separator={<Icon as={FiChevronRight} color="gray.500" />}
        mb={4}
      >
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard">
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/dashboard/teams">
            Teams
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to={`/dashboard/teams/${teamId}`}>
            {teamName}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Analysis History</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <PageTitle title={`${teamName}: Analysis History`} />

        <HStack spacing={3}>
          <Select
            size="sm"
            width="140px"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            placeholder="All statuses"
            icon={<FiFilter />}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </Select>

          <Button
            variant="outline"
            leftIcon={<FiRefreshCw />}
            onClick={handleRefresh}
            isLoading={refreshing}
            loadingText="Refreshing"
          >
            Refresh
          </Button>
          
          <Button
            colorScheme="blue"
            as={Link}
            to={`/dashboard/analysis/create?team=${teamId}`}
            leftIcon={<FiPlusCircle />}
          >
            New Analysis
          </Button>
        </HStack>
      </Flex>

      {error && (
        <Box 
          p={4} 
          mb={6}
          bg={errorBgColor} 
          color={errorTextColor} 
          borderRadius="md"
        >
          {error}
        </Box>
      )}

      {/* Debug info - only shown in development */}
      <Box mb={4} p={3} bg="gray.100" borderRadius="md" fontSize="sm" color="gray.700">
        <Text fontWeight="bold">Debug Info:</Text>
        <Text>Team ID: {teamId}</Text>
        <Text>Reports count: {reports?.length || 0}</Text>
        <Text>Loading: {loading ? 'true' : 'false'}</Text>
        <Text>Total count: {totalCount}</Text>
        {error && <Text color="red.500">Error: {error}</Text>}
        <Text fontWeight="bold" mt={2}>First 2 reports data:</Text>
        <pre>{JSON.stringify(reports?.slice(0, 2), null, 2)}</pre>
      </Box>
      
      {loading ? (
        <Flex justify="center" py={10}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
        </Flex>
      ) : reports.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <Flex 
              direction="column" 
              align="center" 
              justify="center" 
              py={10} 
              px={6}
            >
              <Icon as={FiFileText} boxSize={16} color="gray.300" mb={4} />
              <Heading size="md" mb={2} textAlign="center">
                No Analysis Reports Found
              </Heading>
              <Text color="gray.500" mb={5} textAlign="center">
                Create a new analysis to generate insights across multiple resources.
              </Text>
              <Button
                colorScheme="blue"
                as={Link}
                to={`/dashboard/analysis/create?team=${teamId}`}
                leftIcon={<FiPlusCircle />}
              >
                Create New Analysis
              </Button>
            </Flex>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card variant="outline" mb={5}>
            <CardHeader pb={2}>
              <Heading size="md">Analysis Reports</Heading>
            </CardHeader>
            <CardBody pt={2}>
              <TableContainer>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Title</Th>
                      <Th>Resources</Th>
                      <Th>Created</Th>
                      <Th>Status</Th>
                      <Th textAlign="right">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {reports.map((report) => {
                      const statusInfo = getStatusInfo(report.status)
                      return (
                        <Tr key={report.id} _hover={{ bg: 'gray.50' }}>
                          <Td fontWeight="medium">
                            {report.title || 'Untitled Analysis'}
                          </Td>
                          <Td>
                            {report.resource_count > 0 ? (
                              <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2}>
                                {report.resource_count}
                              </Badge>
                            ) : (
                              <Text color="gray.400">-</Text>
                            )}
                          </Td>
                          <Td>{formatDate(report.created_at)}</Td>
                          <Td>
                            <Badge
                              colorScheme={statusInfo.colorScheme}
                              variant="subtle"
                              px={2}
                              py={1}
                              borderRadius="full"
                            >
                              {statusInfo.label}
                            </Badge>
                          </Td>
                          <Td textAlign="right">
                            <Button
                              as={Link}
                              to={`/dashboard/reports/${teamId}/report/${report.id}`}
                              size="sm"
                              colorScheme="blue"
                              variant="outline"
                              leftIcon={<FiEye />}
                            >
                              View
                            </Button>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            </CardBody>
          </Card>

          <Flex justify="space-between" align="center">
            <HStack>
              <Text fontSize="sm">Rows per page:</Text>
              <Select
                size="sm"
                width="70px"
                value={rowsPerPage}
                onChange={handleChangeRowsPerPage}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
              </Select>
            </HStack>
            
            <HStack>
              <Text fontSize="sm">
                {page * rowsPerPage + 1}-
                {Math.min((page + 1) * rowsPerPage, totalCount)} of {totalCount}
              </Text>
              <Button
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                isDisabled={page === 0}
                variant="ghost"
              >
                Previous
              </Button>
              <Button
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                isDisabled={(page + 1) * rowsPerPage >= totalCount}
                variant="ghost"
              >
                Next
              </Button>
            </HStack>
          </Flex>
        </>
      )}
    </Box>
  )
}

export default TeamAnalysisHistoryPage