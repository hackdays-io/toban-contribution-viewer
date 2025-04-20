import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
} from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import useIntegration from '../../context/useIntegration';
import TeamChannelSelector from '../../components/integration/TeamChannelSelector';
import { IntegrationType } from '../../lib/integrationService';

/**
 * Page for selecting channels in a team integration
 */
const TeamChannelSelectorPage: React.FC = () => {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  
  const {
    currentIntegration,
    loading,
    error,
    fetchIntegration,
  } = useIntegration();

  // Fetch integration data when component mounts
  useEffect(() => {
    if (integrationId) {
      fetchIntegration(integrationId);
    }
  }, [integrationId, fetchIntegration]);

  // Handle back button click
  const handleBack = () => {
    navigate(`/dashboard/integrations/${integrationId}`);
  };

  // Show loading state
  if (loading) {
    return (
      <Box textAlign="center" p={8}>
        <Spinner size="xl" />
        <Text mt={4}>Loading integration data...</Text>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Alert status="error" borderRadius="md" mb={4}>
        <AlertIcon />
        <AlertTitle>Error loading integration:</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'An unknown error occurred'}
        </AlertDescription>
      </Alert>
    );
  }

  // Show not found state
  if (!currentIntegration) {
    return (
      <Alert status="warning" borderRadius="md" mb={4}>
        <AlertIcon />
        <AlertTitle>Integration not found</AlertTitle>
        <AlertDescription>
          The integration you're looking for could not be found.
        </AlertDescription>
      </Alert>
    );
  }

  // Show incompatible integration type
  if (currentIntegration.service_type !== IntegrationType.SLACK) {
    return (
      <Box>
        <Button leftIcon={<FiArrowLeft />} onClick={handleBack} mb={4} variant="outline">
          Back to Integration
        </Button>
        
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Unsupported integration type</AlertTitle>
          <AlertDescription>
            Channel selection is currently only available for Slack integrations.
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button leftIcon={<FiArrowLeft />} onClick={handleBack} mb={4} variant="outline">
        Back to Integration
      </Button>
      
      <Breadcrumb mb={4} fontSize="sm">
        <BreadcrumbItem>
          <BreadcrumbLink onClick={() => navigate('/dashboard/integrations')}>
            Integrations
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink onClick={() => navigate(`/dashboard/integrations/${integrationId}`)}>
            {currentIntegration.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Channel Selection</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Heading as="h1" size="lg" mb={2}>
        Select Channels for Analysis
      </Heading>
      
      <Text mb={6} color="gray.600">
        Choose which channels from {currentIntegration.name} to include in contribution analysis.
      </Text>
      
      <TeamChannelSelector integrationId={integrationId || ''} />
    </Box>
  );
};

export default TeamChannelSelectorPage;