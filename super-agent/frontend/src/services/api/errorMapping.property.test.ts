/**
 * Property-Based Tests for API Layer Error Mapping
 * 
 * Feature: supabase-backend, Property 16: API Layer Error Mapping
 * Validates: Requirements 11.7
 * 
 * Property 16: API Layer Error Mapping
 * *For any* Supabase error, the API layer SHALL map it to the corresponding 
 * existing error type (NOT_FOUND, VALIDATION_ERROR, NETWORK_ERROR, etc.).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { PostgrestError, AuthError } from '@supabase/supabase-js';
import { ServiceError, type ServiceErrorCode } from '@/utils/errorHandling';
import {
  mapSupabaseError,
  mapPostgrestError,
  mapAuthError,
  mapStorageError,
  ERROR_CODE_MAPS,
} from './supabaseErrorMapper';

// Valid ServiceErrorCode values
const VALID_ERROR_CODES: ServiceErrorCode[] = [
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'NETWORK_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TIMEOUT',
  'RATE_LIMITED',
  'SERVER_ERROR',
  'UNKNOWN',
];

// Generators for PostgrestError
const postgresErrorCodeArbitrary = fc.constantFrom(
  ...Object.keys(ERROR_CODE_MAPS.postgres)
);

const postgrestErrorCodeArbitrary = fc.constantFrom(
  ...Object.keys(ERROR_CODE_MAPS.postgrest)
);

const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

// Create PostgrestError-like objects (matching the interface structure)
function createPostgrestError(
  message: string,
  code: string,
  details: string | null = null,
  hint: string | null = null
): PostgrestError {
  return {
    message,
    code,
    details,
    hint,
  } as PostgrestError;
}

const postgrestErrorArbitrary = fc.record({
  message: errorMessageArbitrary,
  code: fc.oneof(
    postgresErrorCodeArbitrary,
    postgrestErrorCodeArbitrary,
    fc.string({ minLength: 1, maxLength: 10 }) // Unknown codes
  ),
  details: fc.option(fc.string(), { nil: undefined }).map(v => v ?? null),
  hint: fc.option(fc.string(), { nil: undefined }).map(v => v ?? null),
}).map(({ message, code, details, hint }) => 
  createPostgrestError(message, code, details, hint)
);

// Generator for AuthError-like objects
const authErrorArbitrary = fc.record({
  message: fc.oneof(
    fc.constant('Invalid login credentials'),
    fc.constant('User not found'),
    fc.constant('Email already registered'),
    fc.constant('Rate limit exceeded'),
    fc.constant('Session expired'),
    fc.constant('JWT expired'),
    errorMessageArbitrary
  ),
  status: fc.oneof(
    fc.constant(401),
    fc.constant(403),
    fc.constant(404),
    fc.constant(429),
    fc.constant(500),
    fc.integer({ min: 400, max: 599 })
  ),
  name: fc.constant('AuthError'),
});

// Generator for StorageError-like objects
const storageErrorArbitrary = fc.record({
  message: fc.oneof(
    fc.constant('Object not found'),
    fc.constant('Permission denied'),
    fc.constant('File too large'),
    fc.constant('Invalid file type'),
    errorMessageArbitrary
  ),
  name: fc.constant('StorageError'),
});

// Generator for generic errors
const genericErrorArbitrary = fc.record({
  message: errorMessageArbitrary,
}).map(({ message }) => new Error(message));

describe('API Layer Error Mapping - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 16: API Layer Error Mapping
   * Validates: Requirements 11.7
   */
  describe('Property 16: API Layer Error Mapping', () => {
    it('should always return a ServiceError instance for any input', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            postgrestErrorArbitrary,
            authErrorArbitrary,
            storageErrorArbitrary,
            genericErrorArbitrary,
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer()
          ),
          (error) => {
            const result = mapSupabaseError(error);
            expect(result).toBeInstanceOf(ServiceError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return a valid ServiceErrorCode', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            postgrestErrorArbitrary,
            authErrorArbitrary,
            storageErrorArbitrary,
            genericErrorArbitrary
          ),
          (error) => {
            const result = mapSupabaseError(error);
            expect(VALID_ERROR_CODES).toContain(result.code);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve the original error message in the ServiceError', () => {
      fc.assert(
        fc.property(
          postgrestErrorArbitrary,
          (error) => {
            const result = mapPostgrestError(error);
            expect(result.message).toContain(error.message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map known PostgreSQL error codes to correct ServiceErrorCode', () => {
      fc.assert(
        fc.property(
          postgresErrorCodeArbitrary,
          errorMessageArbitrary,
          (code, message) => {
            const error = createPostgrestError(message, code);
            const result = mapPostgrestError(error);
            const expectedCode = ERROR_CODE_MAPS.postgres[code];
            
            expect(result.code).toBe(expectedCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map known PostgREST error codes to correct ServiceErrorCode', () => {
      fc.assert(
        fc.property(
          postgrestErrorCodeArbitrary,
          errorMessageArbitrary,
          (code, message) => {
            const error = createPostgrestError(message, code);
            const result = mapPostgrestError(error);
            const expectedCode = ERROR_CODE_MAPS.postgrest[code];
            
            expect(result.code).toBe(expectedCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map unknown error codes to UNKNOWN', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }).filter(
            code => 
              !Object.prototype.hasOwnProperty.call(ERROR_CODE_MAPS.postgres, code) &&
              !Object.prototype.hasOwnProperty.call(ERROR_CODE_MAPS.postgrest, code)
          ),
          errorMessageArbitrary,
          (code, message) => {
            const error = createPostgrestError(message, code);
            const result = mapPostgrestError(error);
            expect(result.code).toBe('UNKNOWN');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include context in error message when provided', () => {
      fc.assert(
        fc.property(
          postgrestErrorArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          (error, context) => {
            const result = mapPostgrestError(error, context);
            expect(result.message).toContain(context);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map PGRST116 (row not found) to NOT_FOUND', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (message) => {
            const error = createPostgrestError(message, 'PGRST116');
            const result = mapPostgrestError(error);
            expect(result.code).toBe('NOT_FOUND');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map 23505 (unique violation) to VALIDATION_ERROR', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (message) => {
            const error = createPostgrestError(message, '23505');
            const result = mapPostgrestError(error);
            expect(result.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map 42501 (RLS violation) to FORBIDDEN', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (message) => {
            const error = createPostgrestError(message, '42501');
            const result = mapPostgrestError(error);
            expect(result.code).toBe('FORBIDDEN');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map network errors to NETWORK_ERROR', () => {
      fc.assert(
        fc.property(
          fc.constant(new TypeError('Failed to fetch')),
          (error) => {
            const result = mapSupabaseError(error);
            expect(result.code).toBe('NETWORK_ERROR');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return the same ServiceError if already a ServiceError', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.constantFrom(...VALID_ERROR_CODES),
          (message, code) => {
            const originalError = new ServiceError(message, code);
            const result = mapSupabaseError(originalError);
            
            expect(result).toBe(originalError);
            expect(result.message).toBe(message);
            expect(result.code).toBe(code);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve error details in the mapped ServiceError', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.string(),
          fc.string(),
          (message, details, hint) => {
            const error = createPostgrestError(message, '23505', details, hint);
            const result = mapPostgrestError(error);
            
            expect(result.details).toBeDefined();
            expect(result.details.originalCode).toBe('23505');
            expect(result.details.details).toBe(details);
            expect(result.details.hint).toBe(hint);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Auth Error Mapping', () => {
    it('should map auth errors with 401 status to UNAUTHORIZED', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (message) => {
            const error = {
              message,
              status: 401,
              name: 'AuthError',
            } as AuthError;
            
            const result = mapAuthError(error);
            expect(result.code).toBe('UNAUTHORIZED');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map auth errors with 403 status to FORBIDDEN', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (message) => {
            const error = {
              message,
              status: 403,
              name: 'AuthError',
            } as AuthError;
            
            const result = mapAuthError(error);
            expect(result.code).toBe('FORBIDDEN');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map rate limit messages to RATE_LIMITED', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('rate limit exceeded', 'too many requests'),
          (message) => {
            const error = {
              message,
              status: 429,
              name: 'AuthError',
            } as AuthError;
            
            const result = mapAuthError(error);
            expect(result.code).toBe('RATE_LIMITED');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Storage Error Mapping', () => {
    it('should map "not found" storage errors to NOT_FOUND', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Object not found', 'File does not exist'),
          (message) => {
            const error = { message, name: 'StorageError' };
            const result = mapStorageError(error);
            expect(result.code).toBe('NOT_FOUND');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map permission storage errors to FORBIDDEN', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Permission denied', 'Not authorized', 'Policy violation'),
          (message) => {
            const error = { message, name: 'StorageError' };
            const result = mapStorageError(error);
            expect(result.code).toBe('FORBIDDEN');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map size limit storage errors to VALIDATION_ERROR', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('File too large', 'Size limit exceeded'),
          (message) => {
            const error = { message, name: 'StorageError' };
            const result = mapStorageError(error);
            expect(result.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
