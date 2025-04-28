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
import { 
  AnalysisReport, 
  normalizeReportData, 
  getTotalCount, 
  getStatusInfo,
  formatDate
} from '../../utils/reportUtils'

const TeamAnalysisHistoryPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate() // Used in button click handlers 
  const toast = useToast() // Used for error notifications
  const { teamContext } = useAuth()
  
  const [allReports, setAllReports] = useState<AnalysisReport[]>([])
  const [displayedReports, setDisplayedReports] = useState<AnalysisReport[]>([])
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
      // Use server-side pagination with appropriate page and page_size parameters
      const response = await integrationService.getCrossResourceReports(
        teamId,
        page + 1, // Convert 0-based page to 1-based for API
        rowsPerPage, 
        statusFilter || undefined
      )
      
      if (integrationService.isApiError(response)) {
        setError(`Error loading reports: ${response.message}`)
        setAllReports([])
        setDisplayedReports([])
        setTotalCount(0)
      } else {
        // Use the utility functions to normalize the data
        const normalizedReports = normalizeReportData(response);
        
        // Extract total count from the paginated response
        const totalItems = getTotalCount(response, normalizedReports);
        
        // Set the normalized reports directly as displayed reports
        // No need for client-side pagination since server is handling it
        setDisplayedReports(normalizedReports);
        setAllReports(normalizedReports); // Keep for consistency
        
        // Set the total count for pagination UI
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

  // Fetch reports when teamId or statusFilter changes
  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, statusFilter])
  
  // Refetch data when pagination parameters change
  useEffect(() => {
    if (teamId) {
      fetchReports();
    }
  }, [page, rowsPerPage])
  // eslint-disable-next-line react-hooks/exhaustive-deps

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
    // Ensure we don't go below 0 as our frontend uses 0-based pagination
    setPage(Math.max(0, newPage))
  }

  const handleStatusFilterChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatusFilter(event.target.value)
    setPage(0) // Reset to first page when filter changes
  }

  // Using formatDate from reportUtils

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

      
      {loading ? (
        <Flex justify="center" py={10}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
        </Flex>
      ) : displayedReports.length === 0 ? (
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
                    {displayedReports.map((report) => {
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
                <option value="20">20</option>
                <option value="50">50</option>
              </Select>
            </HStack>
            
            <HStack>
              <Text fontSize="sm">
                {totalCount > 0 
                  ? `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} of ${totalCount}`
                  : `0 of 0`}
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
                isDisabled={totalCount === 0 || (page + 1) * rowsPerPage >= totalCount}
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