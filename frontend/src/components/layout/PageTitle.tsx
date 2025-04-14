import React, { ReactNode } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  HStack,
  BoxProps,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageTitleProps extends BoxProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

/**
 * Consistent page title component with optional breadcrumbs and action buttons
 */
const PageTitle: React.FC<PageTitleProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  ...rest
}) => {
  return (
    <Box mb={6} {...rest}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          mb={2}
          fontSize="sm"
          separator={<FiChevronRight color="gray.500" />}
          spacing="8px"
        >
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem key={index} isCurrentPage={index === breadcrumbs.length - 1}>
              {crumb.href ? (
                <BreadcrumbLink as={Link} to={crumb.href}>
                  {crumb.label}
                </BreadcrumbLink>
              ) : (
                <Text>{crumb.label}</Text>
              )}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      )}
      
      <Flex justify="space-between" align="center">
        <Box>
          <Heading size="lg">{title}</Heading>
          {description && (
            <Text mt={1} color="gray.600">
              {description}
            </Text>
          )}
        </Box>
        
        {actions && (
          <HStack spacing={3}>
            {actions}
          </HStack>
        )}
      </Flex>
    </Box>
  );
};

export default PageTitle;
