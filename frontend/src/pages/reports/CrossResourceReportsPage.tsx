import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Refresh as RefreshIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import PageTitle from '../../components/layout/PageTitle';
import integrationService from '../../lib/integrationService';
import Breadcrumb from '../../components/layout/Breadcrumb';

// Status styles
const getStatusStyles = (status: string): { color: 'success' | 'warning' | 'info' | 'error' | 'default', label: string } => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { color: 'success', label: 'Completed' };
    case 'pending':
      return { color: 'warning', label: 'Pending' };
    case 'in_progress':
      return { color: 'info', label: 'In Progress' };
    case 'failed':
      return { color: 'error', label: 'Failed' };
    default:
      return { color: 'default', label: status };
  }
};

interface CrossResourceReport {
  id: string;
  title: string;
  created_at: string;
  status: string;
  resource_count: number;
  description?: string;
  created_by: {
    id: string;
    name?: string;
    email?: string;
  };
}

const CrossResourceReportsPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [reports, setReports] = useState<CrossResourceReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchReports = async () => {
    if (!teamId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await integrationService.getCrossResourceReports(
        teamId,
        page + 1, // API uses 1-based indexing
        rowsPerPage
      );
      
      if (integrationService.isApiError(response)) {
        setError(`Error loading reports: ${response.message}`);
        setReports([]);
      } else {
        setReports(response.items || []);
        setTotalCount(response.total || 0);
      }
    } catch (err) {
      setError('Failed to load cross-resource reports');
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumb
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Teams', to: '/dashboard/teams' },
          { label: 'Cross-Resource Reports', to: '#' },
        ]}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="Cross-Resource Analysis Reports" />
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to={`/dashboard/integrations/create-analysis/${teamId}`}
          >
            Create New Analysis
          </Button>
        </Box>
      </Box>

      {loading && !refreshing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <CardContent>
            <Typography variant="h6">Error</Typography>
            <Typography>{error}</Typography>
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" align="center" sx={{ my: 3 }}>
              No cross-resource reports found
            </Typography>
            <Typography align="center" color="textSecondary">
              Create a new analysis to generate insights across multiple resources.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to={`/dashboard/integrations/create-analysis/${teamId}`}
              >
                Create Analysis
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Resources</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((report) => {
                  const statusInfo = getStatusStyles(report.status);
                  return (
                    <TableRow key={report.id} hover>
                      <TableCell component="th" scope="row">
                        <Typography variant="body1" fontWeight="medium">
                          {report.title}
                        </Typography>
                        {report.description && (
                          <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 300 }}>
                            {report.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(report.created_at)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={statusInfo.label} 
                          color={statusInfo.color} 
                          size="small" 
                          variant="filled" 
                        />
                      </TableCell>
                      <TableCell>{report.resource_count}</TableCell>
                      <TableCell>
                        {report.created_by?.name || report.created_by?.email || 'Unknown user'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Report">
                          <IconButton 
                            component={Link} 
                            to={`/dashboard/integrations/team-analysis/${report.id}`}
                            color="primary"
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </Box>
  );
};

export default CrossResourceReportsPage;