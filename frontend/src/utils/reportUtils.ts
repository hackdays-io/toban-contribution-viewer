/**
 * Utilities for working with reports and analysis data
 */

/**
 * Report data structure from API
 */
export interface AnalysisReport {
  id: string
  title: string
  description?: string
  status: string
  resource_count: number
  created_at: string
  updated_at: string
  created_by?: {
    id?: string
    name?: string
    email?: string
  }
}

interface ResponseItem {
  id?: string
  title?: string
  name?: string
  description?: string
  status?: string
  resource_count?: number
  resourceCount?: number
  total_resources?: number
  totalResources?: number
  resources?: unknown[]
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
}

// Type that represents the backend paginated response structure
// Used to guide implementation but not directly referenced
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _PaginatedResponse = {
  items: ResponseItem[]
  total: number
  page: number
  page_size: number
  pages: number
}

/**
 * Normalizes raw report data from the API to a consistent format
 * @param rawData - Raw data from the API
 * @returns Normalized array of AnalysisReport objects
 */
export function normalizeReportData(rawData: unknown): AnalysisReport[] {
  // Handle empty or invalid data
  if (!rawData) {
    return []
  }

  // Extract the items array from the response
  let items: ResponseItem[] = []

  if (Array.isArray(rawData)) {
    // Direct array response
    items = rawData
  } else if (rawData && typeof rawData === 'object') {
    // Object with items array or other structure
    const objData = rawData as Record<string, unknown>

    // Check for the new paginated response format first
    if (objData.items && Array.isArray(objData.items)) {
      items = objData.items as ResponseItem[]
    }
    // Legacy format or other formats
    else {
      // Try common property names for arrays of items
      const possibleArrayProps = [
        'data',
        'reports',
        'results',
        'content',
        'records',
      ]
      for (const prop of possibleArrayProps) {
        if (
          objData[prop] &&
          Array.isArray(objData[prop]) &&
          (objData[prop] as unknown[]).length > 0
        ) {
          items = objData[prop] as ResponseItem[]
          break
        }
      }

      // If we still don't have items, look for any array property
      if (items.length === 0) {
        for (const key in objData) {
          if (
            Array.isArray(objData[key]) &&
            (objData[key] as unknown[]).length > 0
          ) {
            items = objData[key] as ResponseItem[]
            break
          }
        }
      }
    }
  }

  // Map the items to a consistent format
  return items.map((item) => ({
    id: item.id || '',
    title: item.title || item.name || 'Untitled Analysis',
    description: item.description,
    status: item.status || 'pending',
    resource_count:
      item.resource_count ||
      item.resourceCount ||
      item.total_resources ||
      item.totalResources ||
      (Array.isArray(item.resources) ? item.resources.length : 0),
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    updated_at:
      item.updated_at ||
      item.updatedAt ||
      item.created_at ||
      new Date().toISOString(),
  }))
}

/**
 * Apply pagination to data client-side
 * @param reports All reports from the API
 * @param page Current page (0-based for client-side)
 * @param pageSize Number of items per page
 * @returns Paginated array of reports
 */
export function paginateReports(
  reports: AnalysisReport[],
  page: number,
  pageSize: number
): AnalysisReport[] {
  const startIndex = page * pageSize
  return reports.slice(startIndex, startIndex + pageSize)
}

/**
 * Gets the total count from a paginated response
 * @param response - The API response
 * @param items - The normalized items array
 * @returns The total count of items
 */
export function getTotalCount(
  response: unknown,
  items: AnalysisReport[]
): number {
  if (!response || typeof response !== 'object') {
    return items.length
  }

  const responseObj = response as Record<string, unknown>

  // Handle the new paginated response format
  if (
    responseObj.total !== undefined &&
    typeof responseObj.total === 'number'
  ) {
    return responseObj.total
  }

  // Fallback to items length
  return items.length
}

/**
 * Get a display-friendly status label and color for a report status
 */
export function getStatusInfo(status: string): {
  colorScheme: 'green' | 'yellow' | 'blue' | 'red' | 'gray'
  label: string
} {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return { colorScheme: 'green', label: 'Completed' }
    case 'pending':
      return { colorScheme: 'yellow', label: 'Pending' }
    case 'in_progress':
      return { colorScheme: 'blue', label: 'In Progress' }
    case 'failed':
      return { colorScheme: 'red', label: 'Failed' }
    default:
      return { colorScheme: 'gray', label: status || 'Unknown' }
  }
}

/**
 * Format a date string for display
 * @param dateString ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    // Format as "MMM d, yyyy h:mm AM/PM"
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })
  } catch {
    return dateString
  }
}
