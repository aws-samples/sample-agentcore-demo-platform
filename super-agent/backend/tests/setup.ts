/**
 * Test setup file
 * Sets up environment variables required for tests
 */

// Set required environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-for-property-based-testing-minimum-32-chars';
process.env.NODE_ENV = 'test';
