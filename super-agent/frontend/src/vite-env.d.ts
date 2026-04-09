/// <reference types="vite/client" />

/**
 * Environment Variable Type Declarations
 * 
 * This file provides TypeScript type definitions for Vite environment variables.
 * All VITE_ prefixed variables are exposed to the client-side code.
 */

interface ImportMetaEnv {
  /** Supabase project URL */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anonymous (public) key */
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Whether to use mock services instead of Supabase */
  readonly VITE_USE_MOCK: string;
  /** API mode: 'rest' for backend API, 'supabase' for direct Supabase access */
  readonly VITE_API_MODE?: string;
  /** REST API backend base URL */
  readonly VITE_API_BASE_URL?: string;
  /** Current mode (development, production, test) */
  readonly MODE: string;
  /** Base URL for the application */
  readonly BASE_URL: string;
  /** Whether running in production mode */
  readonly PROD: boolean;
  /** Whether running in development mode */
  readonly DEV: boolean;
  /** Whether running in SSR mode */
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
