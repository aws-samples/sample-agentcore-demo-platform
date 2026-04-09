/**
 * Service Factory Pattern
 * 
 * This module provides a factory function for creating services that can
 * switch between mock and REST API implementations based on environment
 * configuration.
 */

/**
 * Configuration for service creation
 */
export interface ServiceConfig {
  /**
   * Whether to use mock services instead of real REST API services.
   * When true, mock services are used (development mode).
   * When false, REST API services are used (production mode).
   */
  useMock: boolean;
}

/**
 * Gets the current service configuration from environment variables.
 * 
 * @returns ServiceConfig based on environment variables
 */
export function getServiceConfig(): ServiceConfig {
  const useMockEnv = import.meta.env.VITE_USE_MOCK;
  
  // Parse VITE_USE_MOCK: 'true' or '1' means use mock, anything else means use REST API
  // Default to mock in development if not explicitly set
  const useMock = useMockEnv === 'true' || useMockEnv === '1' || 
    (useMockEnv === undefined && import.meta.env.DEV);
  
  return {
    useMock,
  };
}

/**
 * Checks if the application is configured to use mock services.
 * 
 * @returns true if mock services should be used
 */
export function shouldUseMock(): boolean {
  return getServiceConfig().useMock;
}

/**
 * Creates a service that switches between mock and REST API implementations
 * based on the current environment configuration.
 * 
 * @template T - The service interface type
 * @param mockService - The mock implementation of the service
 * @param restService - The REST API implementation of the service
 * @param config - Optional configuration override (defaults to environment config)
 * @returns The appropriate service implementation based on configuration
 */
export function createService<T>(
  mockService: T,
  restService: T,
  config?: ServiceConfig
): T {
  const effectiveConfig = config ?? getServiceConfig();
  return effectiveConfig.useMock ? mockService : restService;
}

/**
 * Type helper for defining service interfaces that work with the factory.
 * Ensures both mock and REST implementations have the same interface.
 * 
 * @template T - The service interface
 */
export type ServiceImplementation<T> = T;

export default createService;
