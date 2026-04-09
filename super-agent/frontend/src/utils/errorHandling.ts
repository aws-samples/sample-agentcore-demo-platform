// Common error types across the application
export type ServiceErrorCode = 
  | 'NOT_FOUND' 
  | 'VALIDATION_ERROR' 
  | 'NETWORK_ERROR' 
  | 'UNAUTHORIZED' 
  | 'FORBIDDEN' 
  | 'TIMEOUT' 
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN'

export class ServiceError extends Error {
  code: ServiceErrorCode
  statusCode?: number
  details?: any

  constructor(message: string, code: ServiceErrorCode, statusCode?: number, details?: any) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryableErrors: ServiceErrorCode[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR']
}

// Exponential backoff with jitter
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
    config.maxDelay
  )
  
  // Add jitter (±25% of the delay)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
  return Math.max(0, exponentialDelay + jitter)
}

// Retry wrapper for async operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry if it's not a retryable error
      if (error instanceof ServiceError && !finalConfig.retryableErrors.includes(error.code)) {
        throw error
      }
      
      // Don't retry on the last attempt
      if (attempt === finalConfig.maxAttempts) {
        throw error
      }
      
      // Wait before retrying
      const delay = calculateDelay(attempt, finalConfig)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      console.warn(`Retry attempt ${attempt}/${finalConfig.maxAttempts} after ${delay}ms:`, (error as Error).message)
    }
  }
  
  throw lastError!
}

// Convert HTTP status codes to service error codes
export function httpStatusToErrorCode(status: number): ServiceErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 408:
      return 'TIMEOUT'
    case 429:
      return 'RATE_LIMITED'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'SERVER_ERROR'
    default:
      return 'UNKNOWN'
  }
}

// Convert fetch errors to ServiceError
export function handleFetchError(error: any, context?: string): ServiceError {
  if (error instanceof ServiceError) {
    return error
  }
  
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ServiceError(
      `Network error${context ? ` in ${context}` : ''}: ${error.message}`,
      'NETWORK_ERROR'
    )
  }
  
  // HTTP errors
  if (error.status) {
    const code = httpStatusToErrorCode(error.status)
    return new ServiceError(
      `HTTP ${error.status}${context ? ` in ${context}` : ''}: ${error.message || 'Request failed'}`,
      code,
      error.status
    )
  }
  
  // Timeout errors
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return new ServiceError(
      `Request timeout${context ? ` in ${context}` : ''}`,
      'TIMEOUT'
    )
  }
  
  // Generic error
  return new ServiceError(
    `Unknown error${context ? ` in ${context}` : ''}: ${error.message || 'Something went wrong'}`,
    'UNKNOWN'
  )
}

// Timeout wrapper for promises
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ServiceError(`Operation timed out after ${timeoutMs}ms`, 'TIMEOUT'))
      }, timeoutMs)
    })
  ])
}

// Error logging utility
export function logError(error: Error, context?: string, additionalData?: any): void {
  const errorData = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    ...additionalData
  }
  
  if (error instanceof ServiceError) {
    errorData.code = error.code
    errorData.statusCode = error.statusCode
    errorData.details = error.details
  }
  
  // In development, log to console
  if (import.meta.env.DEV) {
    console.error('Service Error:', errorData)
  }
  
  // In production, you would send this to your error tracking service
  // Example: Sentry, LogRocket, etc.
}

// User-friendly error messages
export function getErrorMessage(error: Error): string {
  if (error instanceof ServiceError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'The requested resource was not found.'
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.'
      case 'NETWORK_ERROR':
        return 'Network connection failed. Please check your internet connection.'
      case 'UNAUTHORIZED':
        return 'You are not authorized to perform this action.'
      case 'FORBIDDEN':
        return 'Access to this resource is forbidden.'
      case 'TIMEOUT':
        return 'The request timed out. Please try again.'
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment and try again.'
      case 'SERVER_ERROR':
        return 'Server error occurred. Please try again later.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }
  
  return error.message || 'An unexpected error occurred.'
}

// Validation helpers
export function validateRequired(value: any, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new ServiceError(`${fieldName} is required`, 'VALIDATION_ERROR')
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new ServiceError('Invalid email format', 'VALIDATION_ERROR')
  }
}

export function validateUrl(url: string): void {
  try {
    new URL(url)
  } catch {
    throw new ServiceError('Invalid URL format', 'VALIDATION_ERROR')
  }
}

export function validateJson(jsonString: string): void {
  try {
    JSON.parse(jsonString)
  } catch {
    throw new ServiceError('Invalid JSON format', 'VALIDATION_ERROR')
  }
}