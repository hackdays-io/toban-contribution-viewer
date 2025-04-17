/**
 * Core API Client
 * Centralized API request handling with consistent URL management
 */

import env from '../config/env'
import { supabase } from './supabase'

// Base API client class
export class ApiClient {
  protected baseUrl: string

  constructor(basePath: string = '') {
    // Get the base URL from environment and ensure consistent formatting
    const apiUrl = env.apiUrl.endsWith('/')
      ? env.apiUrl.slice(0, -1)
      : env.apiUrl

    // Add optional base path for service-specific clients
    this.baseUrl = basePath
      ? `${apiUrl}${basePath.startsWith('/') ? basePath : `/${basePath}`}`
      : apiUrl
  }

  /**
   * Builds a complete URL from the endpoint
   */
  protected buildUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`

    return `${this.baseUrl}${normalizedEndpoint}`
  }

  /**
   * Get authorization headers with JWT token
   */
  protected async getAuthHeaders(): Promise<HeadersInit> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token

    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }

  /**
   * Handle API errors consistently
   */
  protected handleError(error: unknown, defaultMessage: string): ApiError {
    console.error('API Error:', error)

    // Handle Response objects
    if (error instanceof Response) {
      return {
        status: error.status,
        message: error.statusText || defaultMessage,
      }
    }

    // Handle response-like objects
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      'statusText' in error
    ) {
      const responseError = error as { status: number; statusText: string }
      return {
        status: responseError.status,
        message: responseError.statusText || defaultMessage,
      }
    }

    // Default error handling
    return {
      status: 500,
      message: error instanceof Error ? error.message : defaultMessage,
    }
  }

  /**
   * Check if a response is an API error
   */
  public isApiError(response: unknown): response is ApiError {
    return (
      response !== null &&
      typeof response === 'object' &&
      'status' in response &&
      'message' in response
    )
  }

  /**
   * Perform a GET request
   */
  public async get<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T | ApiError> {
    try {
      const url = this.buildUrl(endpoint)
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          ...options?.headers,
        },
        credentials: 'include',
        ...options,
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, `Failed to fetch from ${endpoint}`)
    }
  }

  /**
   * Perform a POST request
   */
  public async post<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: RequestInit
  ): Promise<T | ApiError> {
    try {
      const url = this.buildUrl(endpoint)
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          ...options?.headers,
        },
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, `Failed to post to ${endpoint}`)
    }
  }

  /**
   * Perform a PUT request
   */
  public async put<T>(
    endpoint: string,
    data: Record<string, unknown>,
    options?: RequestInit
  ): Promise<T | ApiError> {
    try {
      const url = this.buildUrl(endpoint)
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          ...options?.headers,
        },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options,
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, `Failed to update ${endpoint}`)
    }
  }

  /**
   * Perform a DELETE request
   */
  public async delete<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T | ApiError> {
    try {
      const url = this.buildUrl(endpoint)
      const headers = await this.getAuthHeaders()

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...headers,
          ...options?.headers,
        },
        credentials: 'include',
        ...options,
      })

      if (!response.ok) {
        throw response
      }

      return await response.json()
    } catch (error) {
      return this.handleError(error, `Failed to delete ${endpoint}`)
    }
  }
}

// Error types
export interface ApiError {
  status: number
  message: string
  details?: unknown
}

// Create default API client instance
export const apiClient = new ApiClient()
export default apiClient
