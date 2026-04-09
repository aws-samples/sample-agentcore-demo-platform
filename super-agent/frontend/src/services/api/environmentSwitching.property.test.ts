/**
 * Property-Based Tests for API Layer Environment Switching
 * 
 * Feature: supabase-backend, Property 15: API Layer Environment Switching
 * Validates: Requirements 11.3, 11.4, 11.5
 * 
 * Property 15: API Layer Environment Switching
 * *For any* service call, the API layer SHALL use mock services when 
 * `VITE_USE_MOCK=true` and Supabase services otherwise.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  createService,
  createLazyService,
  getServiceConfig,
  shouldUseMock,
  shouldUseSupabase,
  type ServiceConfig,
} from './createService';

// Define a test service interface
interface TestService {
  getValue(): string;
  getAsyncValue(): Promise<string>;
  processData(input: string): string;
}

// Mock implementation
const createMockService = (identifier: string): TestService => ({
  getValue: () => `mock-${identifier}`,
  getAsyncValue: async () => `mock-async-${identifier}`,
  processData: (input: string) => `mock-processed-${input}`,
});

// Supabase implementation
const createSupabaseService = (identifier: string): TestService => ({
  getValue: () => `supabase-${identifier}`,
  getAsyncValue: async () => `supabase-async-${identifier}`,
  processData: (input: string) => `supabase-processed-${input}`,
});

// Arbitrary generators
const identifierArbitrary = fc.string({ minLength: 1, maxLength: 20 });
const inputDataArbitrary = fc.string({ minLength: 0, maxLength: 100 });

describe('API Layer Environment Switching - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 15: API Layer Environment Switching
   * Validates: Requirements 11.3, 11.4, 11.5
   */
  describe('Property 15: API Layer Environment Switching', () => {
    describe('createService factory', () => {
      it('should return mock service when useMock is true', () => {
        fc.assert(
          fc.property(
            identifierArbitrary,
            (identifier) => {
              const mockService = createMockService(identifier);
              const supabaseService = createSupabaseService(identifier);
              const config: ServiceConfig = { useMock: true };
              
              const service = createService(mockService, supabaseService, config);
              
              // The returned service should be the mock service
              expect(service.getValue()).toBe(`mock-${identifier}`);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should return Supabase service when useMock is false', () => {
        fc.assert(
          fc.property(
            identifierArbitrary,
            (identifier) => {
              const mockService = createMockService(identifier);
              const supabaseService = createSupabaseService(identifier);
              const config: ServiceConfig = { useMock: false };
              
              const service = createService(mockService, supabaseService, config);
              
              // The returned service should be the Supabase service
              expect(service.getValue()).toBe(`supabase-${identifier}`);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should consistently return the same implementation for all methods', async () => {
        await fc.assert(
          fc.asyncProperty(
            identifierArbitrary,
            inputDataArbitrary,
            fc.boolean(),
            async (identifier, input, useMock) => {
              const mockService = createMockService(identifier);
              const supabaseService = createSupabaseService(identifier);
              const config: ServiceConfig = { useMock };
              
              const service = createService(mockService, supabaseService, config);
              
              const expectedPrefix = useMock ? 'mock' : 'supabase';
              
              // All methods should use the same implementation
              expect(service.getValue()).toBe(`${expectedPrefix}-${identifier}`);
              expect(await service.getAsyncValue()).toBe(`${expectedPrefix}-async-${identifier}`);
              expect(service.processData(input)).toBe(`${expectedPrefix}-processed-${input}`);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should preserve service interface for any input data', () => {
        fc.assert(
          fc.property(
            identifierArbitrary,
            inputDataArbitrary,
            fc.boolean(),
            (identifier, input, useMock) => {
              const mockService = createMockService(identifier);
              const supabaseService = createSupabaseService(identifier);
              const config: ServiceConfig = { useMock };
              
              const service = createService(mockService, supabaseService, config);
              
              // Service should have all expected methods
              expect(typeof service.getValue).toBe('function');
              expect(typeof service.getAsyncValue).toBe('function');
              expect(typeof service.processData).toBe('function');
              
              // Methods should return expected types
              expect(typeof service.getValue()).toBe('string');
              expect(typeof service.processData(input)).toBe('string');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('createLazyService factory', () => {
      it('should return mock service immediately when useMock is true', () => {
        fc.assert(
          fc.property(
            identifierArbitrary,
            (identifier) => {
              const mockService = createMockService(identifier);
              const getSupabaseService = () => createSupabaseService(identifier);
              const config: ServiceConfig = { useMock: true };
              
              const service = createLazyService(mockService, getSupabaseService, config);
              
              // Should use mock service
              expect(service.getValue()).toBe(`mock-${identifier}`);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should use Supabase service when useMock is false (sync getter)', () => {
        fc.assert(
          fc.property(
            identifierArbitrary,
            (identifier) => {
              const mockService = createMockService(identifier);
              const getSupabaseService = () => createSupabaseService(identifier);
              const config: ServiceConfig = { useMock: false };
              
              const service = createLazyService(mockService, getSupabaseService, config);
              
              // Should use Supabase service
              expect(service.getValue()).toBe(`supabase-${identifier}`);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle async Supabase service getter', async () => {
        await fc.assert(
          fc.asyncProperty(
            identifierArbitrary,
            inputDataArbitrary,
            async (identifier, input) => {
              const mockService = createMockService(identifier);
              const getSupabaseService = async () => {
                // Simulate async module loading
                await new Promise(resolve => setTimeout(resolve, 1));
                return createSupabaseService(identifier);
              };
              const config: ServiceConfig = { useMock: false };
              
              const service = createLazyService(mockService, getSupabaseService, config);
              
              // Async methods should resolve to Supabase implementation
              const result = await service.processData(input);
              expect(result).toBe(`supabase-processed-${input}`);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('ServiceConfig behavior', () => {
      it('should correctly interpret useMock boolean', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (useMock) => {
              const config: ServiceConfig = { useMock };
              const mockService = { id: 'mock' };
              const supabaseService = { id: 'supabase' };
              
              const service = createService(mockService, supabaseService, config);
              
              if (useMock) {
                expect(service.id).toBe('mock');
              } else {
                expect(service.id).toBe('supabase');
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should allow optional supabaseUrl and supabaseKey', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            fc.option(fc.webUrl(), { nil: undefined }),
            fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
            (useMock, supabaseUrl, supabaseKey) => {
              const config: ServiceConfig = {
                useMock,
                supabaseUrl,
                supabaseKey,
              };
              
              // Config should be valid regardless of optional fields
              expect(typeof config.useMock).toBe('boolean');
              expect(config.supabaseUrl === undefined || typeof config.supabaseUrl === 'string').toBe(true);
              expect(config.supabaseKey === undefined || typeof config.supabaseKey === 'string').toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Environment switching consistency', () => {
      it('should return the exact same service instance (not a copy)', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (useMock) => {
              const mockService = { value: 'mock' };
              const supabaseService = { value: 'supabase' };
              const config: ServiceConfig = { useMock };
              
              const service = createService(mockService, supabaseService, config);
              
              // Should be the exact same object reference
              if (useMock) {
                expect(service).toBe(mockService);
              } else {
                expect(service).toBe(supabaseService);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should be deterministic - same config always returns same implementation type', () => {
        fc.assert(
          fc.property(
            identifierArbitrary,
            fc.boolean(),
            fc.integer({ min: 1, max: 10 }),
            (identifier, useMock, iterations) => {
              const mockService = createMockService(identifier);
              const supabaseService = createSupabaseService(identifier);
              const config: ServiceConfig = { useMock };
              
              const results: string[] = [];
              for (let i = 0; i < iterations; i++) {
                const service = createService(mockService, supabaseService, config);
                results.push(service.getValue());
              }
              
              // All results should be identical
              const firstResult = results[0];
              expect(results.every(r => r === firstResult)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Helper functions', () => {
      it('shouldUseMock and shouldUseSupabase should be mutually exclusive', () => {
        // Note: This test verifies the logical relationship, not the actual env values
        // In a real scenario, these would depend on VITE_USE_MOCK env variable
        const useMock = shouldUseMock();
        const useSupabase = shouldUseSupabase();
        
        // They should always be opposite
        expect(useMock).toBe(!useSupabase);
      });

      it('getServiceConfig should return a valid ServiceConfig', () => {
        const config = getServiceConfig();
        
        expect(typeof config.useMock).toBe('boolean');
        expect(config.supabaseUrl === undefined || typeof config.supabaseUrl === 'string').toBe(true);
        expect(config.supabaseKey === undefined || typeof config.supabaseKey === 'string').toBe(true);
      });
    });
  });
});
