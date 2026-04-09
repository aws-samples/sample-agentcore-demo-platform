/**
 * Unified Auth Service
 *
 * Supports two modes:
 * - cognito: Cognito Hosted UI with PKCE OAuth flow
 * - local: Username/password with JWT
 *
 * The mode is determined by fetching /api/auth/config from the backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// ---------------------------------------------------------------------------
// Auth mode detection
// ---------------------------------------------------------------------------

export type AuthMode = 'cognito' | 'local';

interface AuthConfig {
  authMode: AuthMode;
  userPoolId?: string;
  clientId?: string;
  region?: string;
  domain?: string;
}

let cachedConfig: AuthConfig | null = null;

export async function getAuthConfig(): Promise<AuthConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/config`);
    cachedConfig = await res.json();
    return cachedConfig!;
  } catch {
    // Default to local if backend is unreachable
    cachedConfig = { authMode: 'local' };
    return cachedConfig;
  }
}

export function getCachedAuthMode(): AuthMode {
  return cachedConfig?.authMode ?? 'local';
}

// ---------------------------------------------------------------------------
// Local auth token management
// ---------------------------------------------------------------------------

const LOCAL_TOKEN_KEY = 'local_auth_token';

export function getLocalToken(): string | null {
  return localStorage.getItem(LOCAL_TOKEN_KEY);
}

export function setLocalToken(token: string): void {
  localStorage.setItem(LOCAL_TOKEN_KEY, token);
}

export function clearLocalToken(): void {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Unified token getter (works for both modes)
// ---------------------------------------------------------------------------

export async function getValidToken(): Promise<string | null> {
  const mode = getCachedAuthMode();
  if (mode === 'local') {
    return getLocalToken();
  }
  // Cognito mode — delegate to cognito service
  const { getValidIdToken } = await import('./cognito');
  return getValidIdToken();
}

// ---------------------------------------------------------------------------
// Local auth API calls
// ---------------------------------------------------------------------------

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    role: string;
  };
}

export async function localLogin(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Login failed');
  }
  const data: LoginResponse = await res.json();
  setLocalToken(data.token);
  return data;
}

export async function localRegister(username: string, password: string, fullName?: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, fullName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(err.error || 'Registration failed');
  }
  const data: LoginResponse = await res.json();
  setLocalToken(data.token);
  return data;
}

// ---------------------------------------------------------------------------
// Unified logout
// ---------------------------------------------------------------------------

export function localLogout(): void {
  clearLocalToken();
  window.location.href = '/login';
}
