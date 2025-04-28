import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardBody,
  Text,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Flex,
  VStack,
  HStack,
  Badge,
  IconButton,
  Tooltip,
  Select,
  useColorModeValue,
} from '@chakra-ui/react'
import { FiRefreshCw, FiEye } from 'react-icons/fi'
import PageTitle from '../../components/layout/PageTitle'
import integrationService from '../../lib/integrationService'

// Status styles
const getStatusStyles = (
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

interface CrossResourceReport {
  id: string
  title: string
  created_at: string
  status: string
  resource_count: number
  description?: string
  created_by: {
    id: string
    name?: string
    email?: string
  }
}

const CrossResourceReportsPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const [reports, setReports] = useState<CrossResourceReport[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(0)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [rowsPerPage, setRowsPerPage] = useState<number>(10)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const errorBgColor = useColorModeValue('red.50', 'red.900')
  const errorTextColor = useColorModeValue('red.600', 'red.200')

  const fetchReports = async () => {
    if (!teamId) return

    setLoading(true)
    setError(null)

    try {
      const response = await integrationService.getCrossResourceReports(
        teamId,
        page + 1, // API uses 1-based indexing
        rowsPerPage
      )

      if (integrationService.isApiError(response)) {
        setError(`Error loading reports: ${response.message}`)
        setReports([])
      } else {
        setReports(response.items || [])
        setTotalCount(response.total || 0)
      }
    } catch (err) {
      setError('Failed to load cross-resource reports')
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, page, rowsPerPage])

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
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <PageTitle title="Cross-Resource Analysis Reports" />

        <HStack spacing={3}>
          <Button
            variant="outline"
            colorScheme="blue"
            leftIcon={<FiRefreshCw />}
            onClick={handleRefresh}
            isLoading={refreshing}
            loadingText="Refreshing..."
          >
            Refresh
          </Button>

          <Button
            colorScheme="blue"
            as={Link}
            to={`/dashboard/integrations/create-analysis/${teamId}`}
          >
            Create New Analysis
          </Button>
        </HStack>
      </Flex>

      {loading && !refreshing ? (
        <Flex justify="center" align="center" my={10}>
          <Spinner size="xl" thickness="4px" color="blue.500" />
        </Flex>
      ) : error ? (
        <Card mb={5} bg={errorBgColor} color={errorTextColor}>
          <CardBody>
            <Text fontWeight="bold">Error</Text>
            <Text>{error}</Text>
          </CardBody>
        </Card>
      ) : reports.length === 0 ? (
        <Card variant="outline" mb={5}>
          <CardBody textAlign="center" py={10}>
            <Text fontSize="lg" fontWeight="semibold" mb={3}>
              No cross-resource reports found
            </Text>
            <Text color="gray.500" mb={5}>
              Create a new analysis to generate insights across multiple
              resources.
            </Text>
            <Button
              colorScheme="blue"
              as={Link}
              to={`/dashboard/integrations/create-analysis/${teamId}`}
            >
              Create Analysis
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <TableContainer borderWidth="1px" borderRadius="md" mb={5}>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th>Resources</Th>
                  <Th>Created By</Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {reports.map((report) => {
                  const statusInfo = getStatusStyles(report.status)
                  return (
                    <Tr key={report.id}>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="medium">{report.title}</Text>
                          {report.description && (
                            <Text fontSize="sm" color="gray.500" noOfLines={1}>
                              {report.description}
                            </Text>
                          )}
                        </VStack>
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
                      <Td>{report.resource_count}</Td>
                      <Td>
                        {report.created_by?.name ||
                          report.created_by?.email ||
                          'Unknown user'}
                      </Td>
                      <Td isNumeric>
                        <Tooltip label="View Report">
                          <IconButton
                            as={Link}
                            to={`/dashboard/integrations/team-analysis/${report.id}`}
                            icon={<FiEye />}
                            aria-label="View Report"
                            colorScheme="blue"
                            variant="ghost"
                            size="sm"
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </TableContainer>

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

export default CrossResourceReportsPage