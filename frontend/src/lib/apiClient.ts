/**
 * Base API Client
 * Common utilities for API clients
 */

// Standard error response
export interface ApiError {
  status: number | string
  message: string
  detail?: string
}

// Base API Client class
export class ApiClient {
  protected baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  // Helper to check if a response is an API error
  isApiError(response: unknown): response is ApiError {
    return (
      response !== null &&
      typeof response === 'object' &&
      'status' in response &&
      'message' in response
    )
  }

  // Standard GET request
  protected async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T | ApiError> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value)
        }
      })
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      // If the response is not OK, return an ApiError instead of throwing
      if (!response.ok) {
        let errorDetail: string
        try {
          // Try to parse error details from response
          const errorJson = await response.json()
          errorDetail =
            errorJson.detail || errorJson.message || response.statusText
        } catch {
          // If can't parse JSON, use status text
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `API Error: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        } as ApiError
      }

      return response.json()
    } catch (error) {
      // Network errors or other fetch exceptions
      return {
        status: 'NETWORK_ERROR',
        message: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as ApiError
    }
  }

  // Standard POST request
  protected async post<T>(
    path: string,
    data?: Record<string, unknown>
  ): Promise<T | ApiError> {
    const url = `${this.baseUrl}${path}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      })

      // If the response is not OK, return an ApiError instead of throwing
      if (!response.ok) {
        let errorDetail: string
        try {
          // Try to parse error details from response
          const errorJson = await response.json()
          errorDetail =
            errorJson.detail || errorJson.message || response.statusText
        } catch {
          // If can't parse JSON, use status text
          errorDetail = response.statusText
        }

        return {
          status: response.status,
          message: `API Error: ${response.status} ${response.statusText}`,
          detail: errorDetail,
        } as ApiError
      }

      return response.json()
    } catch (error) {
      // Network errors or other fetch exceptions
      return {
        status: 'NETWORK_ERROR',
        message: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as ApiError
    }
  }
}
