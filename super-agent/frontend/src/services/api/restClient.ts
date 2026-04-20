/**
 * REST API Client
 * 
 * Base HTTP client for communicating with the backend REST API.
 * Handles authentication, error mapping, and request/response processing.
 */

import { ServiceError, httpStatusToErrorCode } from '@/utils/errorHandling';
import { getValidToken } from '@/services/auth';
import { clearLocalToken } from '@/services/auth';

// API base URL - configurable via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * Token storage for JWT authentication
 * Now reads from Cognito token storage.
 */

/**
 * Sets the authentication token (kept for backward compatibility with internal flows)
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('cognito_id_token', token);
  } else {
    localStorage.removeItem('cognito_id_token');
  }
}

/**
 * Gets the current authentication token (local JWT or Cognito id_token)
 */
export function getAuthToken(): string | null {
  // Check local auth token first
  const localToken = localStorage.getItem('local_auth_token');
  if (localToken) return localToken;

  // Fall back to Cognito token with expiry check
  const expiresAt = localStorage.getItem('cognito_expires_at');
  if (expiresAt && Date.now() > Number(expiresAt)) {
    clearAuthToken();
    return null;
  }
  return localStorage.getItem('cognito_id_token');
}

/**
 * Clears the authentication token
 */
export function clearAuthToken(): void {
  localStorage.removeItem('local_auth_token');
  localStorage.removeItem('cognito_id_token');
  localStorage.removeItem('cognito_access_token');
  localStorage.removeItem('cognito_refresh_token');
  localStorage.removeItem('cognito_expires_at');
  localStorage.removeItem('auth_token');
}

/**
 * Maps API error response to ServiceError
 */
function mapApiError(status: number, body: any, context?: string): ServiceError {
  const code = httpStatusToErrorCode(status);
  const message = body?.error || body?.message || `Request failed with status ${status}`;
  return new ServiceError(
    context ? `${context}: ${message}` : message,
    code,
    status,
    body?.details
  );
}

/**
 * Request options for the REST client
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean;
}

/**
 * Makes an authenticated HTTP request to the API
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  
  const headers: Record<string, string> = {
    ...options.headers,
  };

  // Only add Content-Type for requests with body
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Add auth token if available and not skipped
  if (!options.skipAuth) {
    const token = await getValidToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = options.timeout 
    ? setTimeout(() => controller.abort(), options.timeout)
    : null;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw mapApiError(response.status, { error: await response.text() });
      }
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      // Auto-redirect to login on 401 (expired/invalid token)
      if (response.status === 401) {
        clearLocalToken();
        clearAuthToken();
        window.location.href = '/login';
        throw mapApiError(response.status, data);
      }
      throw mapApiError(response.status, data);
    }

    return data as T;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (error instanceof ServiceError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ServiceError('Request timed out', 'TIMEOUT');
      }
      if (error.message.includes('fetch')) {
        throw new ServiceError(`Network error: ${error.message}`, 'NETWORK_ERROR');
      }
    }

    throw new ServiceError(
      `Request failed: ${(error as Error).message}`,
      'UNKNOWN'
    );
  }
}

/**
 * REST API client with typed methods
 */
export const restClient = {
  get: <T>(path: string, options?: RequestOptions) => 
    request<T>('GET', path, undefined, options),
  
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => 
    request<T>('POST', path, body, options),
  
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => 
    request<T>('PUT', path, body, options),
  
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => 
    request<T>('PATCH', path, body, options),
  
  delete: <T>(path: string, options?: RequestOptions) => 
    request<T>('DELETE', path, undefined, options),
};

/**
 * Check if REST API is configured and available
 */
export function isRestApiConfigured(): boolean {
  // Empty string means "use relative URLs via Vite proxy" — still configured
  return true;
}

/**
 * Get REST API configuration status
 */
export function getRestApiConfig() {
  return {
    baseUrl: API_BASE_URL,
    isConfigured: isRestApiConfigured(),
    hasToken: Boolean(getAuthToken()),
  };
}

export default restClient;
