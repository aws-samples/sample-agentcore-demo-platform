/**
 * Cognito Authentication Helper
 *
 * Lightweight Cognito Hosted UI integration without Amplify.
 * Uses the OAuth 2.0 Authorization Code flow with PKCE.
 */

// Cognito config — loaded from env vars or fetched from backend /api/auth/config
const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || '';

const REDIRECT_URI = `${window.location.origin}/auth/callback`;
const LOGOUT_URI = `${window.location.origin}/login`;

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const TOKEN_KEYS = {
  idToken: 'cognito_id_token',
  accessToken: 'cognito_access_token',
  refreshToken: 'cognito_refresh_token',
  expiresAt: 'cognito_expires_at',
} as const;

/**
 * Returns the id_token if still valid, or null if expired.
 * For automatic refresh, use getValidIdToken() instead.
 */
export function getIdToken(): string | null {
  const expiresAt = localStorage.getItem(TOKEN_KEYS.expiresAt);
  if (expiresAt && Date.now() > Number(expiresAt)) {
    // Token expired — don't clear yet, refresh might save us
    return null;
  }
  return localStorage.getItem(TOKEN_KEYS.idToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.accessToken);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.refreshToken);
}

// Prevent concurrent refresh calls
let refreshPromise: Promise<string | null> | null = null;

/**
 * Returns a valid id_token, refreshing silently if expired.
 * Falls back to null (user must re-login) if refresh also fails.
 */
export async function getValidIdToken(): Promise<string | null> {
  // If current token is still valid, return it
  const current = getIdToken();
  if (current) return current;

  // Try refreshing with the refresh_token
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  // Deduplicate concurrent refresh attempts
  if (!refreshPromise) {
    refreshPromise = refreshTokens(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

/**
 * Uses the refresh_token to get new id/access tokens from Cognito.
 */
async function refreshTokens(refreshToken: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: COGNITO_CLIENT_ID,
      refresh_token: refreshToken,
    });

    const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const tokens = await response.json();
    // Cognito refresh response doesn't include a new refresh_token,
    // so we keep the existing one by not overwriting it
    storeTokens({
      id_token: tokens.id_token,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    });

    return tokens.id_token;
  } catch {
    clearTokens();
    return null;
  }
}

function storeTokens(tokens: { id_token: string; access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem(TOKEN_KEYS.idToken, tokens.id_token);
  localStorage.setItem(TOKEN_KEYS.accessToken, tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem(TOKEN_KEYS.refreshToken, tokens.refresh_token);
  }
  localStorage.setItem(TOKEN_KEYS.expiresAt, String(Date.now() + tokens.expires_in * 1000));
}

export function clearTokens(): void {
  Object.values(TOKEN_KEYS).forEach((key) => localStorage.removeItem(key));
  // Also clear legacy key from old auth
  localStorage.removeItem('auth_token');
}

export function isAuthenticated(): boolean {
  return getIdToken() !== null;
}

// ---------------------------------------------------------------------------
// OAuth flows
// ---------------------------------------------------------------------------

/**
 * Redirects the browser to the Cognito Hosted UI login page.
 */
export async function redirectToLogin(): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  // Store verifier for the callback
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  window.location.href = `https://${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchanges the authorization code from the callback URL for tokens.
 */
export async function handleCallback(code: string): Promise<void> {
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  if (!codeVerifier) {
    throw new Error('Missing PKCE code verifier. Please try logging in again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokens = await response.json();
  storeTokens(tokens);
  sessionStorage.removeItem('pkce_code_verifier');
}

/**
 * Logs out by clearing local tokens and redirecting to Cognito logout.
 */
export function logout(): void {
  clearTokens();

  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    logout_uri: LOGOUT_URI,
  });

  window.location.href = `https://${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

/**
 * Parses the id_token JWT payload (without verification — backend verifies).
 */
export function parseIdToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
