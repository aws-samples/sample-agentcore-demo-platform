/**
 * Authentication Service (Cognito)
 *
 * Login/register are handled by Cognito Hosted UI.
 * This service provides helper methods for checking auth state
 * and fetching the current user profile from the backend.
 */

import { restClient, getAuthToken, clearAuthToken } from './restClient';

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

export const AuthService = {
  /**
   * Get current user information from the backend.
   * The backend verifies the Cognito id_token.
   */
  async getCurrentUser(): Promise<User | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
      return await restClient.get<User>('/api/auth/me');
    } catch {
      clearAuthToken();
      return null;
    }
  },

  /**
   * Logout — clears stored tokens.
   * The actual Cognito logout redirect is handled by cognito.ts.
   */
  logout(): void {
    clearAuthToken();
  },

  /**
   * Check if user has a valid token stored.
   */
  isAuthenticated(): boolean {
    return Boolean(getAuthToken());
  },
};

export default AuthService;
