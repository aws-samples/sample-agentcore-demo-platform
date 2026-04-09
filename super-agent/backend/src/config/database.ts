import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from './index.js';

// Declare global type for PrismaClient to prevent multiple instances in development
declare global {
  var __prisma: PrismaClient | undefined;
  var __pgPool: pg.Pool | undefined;
}

/**
 * Create a singleton PrismaClient instance with pg adapter.
 * In development, we store the client on the global object to prevent
 * creating multiple instances during hot reloading.
 *
 * Note: Prisma 7 requires an adapter for the "client" engine type.
 */
function createPrismaClient(): PrismaClient {
  // Create pg Pool
  const pool = globalThis.__pgPool ?? new pg.Pool({
    connectionString: config.database.url,
  });
  
  if (config.isDevelopment) {
    globalThis.__pgPool = pool;
  }

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: config.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

// Use global instance in development to prevent multiple connections during hot reload
export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (config.isDevelopment) {
  globalThis.__prisma = prisma;
}

/**
 * Connect to the database.
 * Call this during application startup.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Disconnect from the database.
 * Call this during application shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Failed to disconnect from database:', error);
    throw error;
  }
}

/**
 * Check database connectivity.
 * Useful for health checks.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export type { PrismaClient };
