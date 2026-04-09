/**
 * Authentication Context
 *
 * Supports both Cognito and local auth modes.
 * Detects mode from backend /api/auth/config on startup.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  getAuthConfig,
  getCachedAuthMode,
  getValidToken,
  getLocalToken,
  clearLocalToken,
  localLogin,
  localRegister,
  localLogout,
  type AuthMode,
} from './auth';
import { restClient } from './api/restClient';
import { shouldUseRestApi } from './api/index';

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  login: (username?: string, password?: string) => Promise<void>;
  register: (username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('local');
  const [error, setError] = useState<string | null>(null);

  // Detect auth mode and load existing session on mount
  useEffect(() => {
    const init = async () => {
      if (!shouldUseRestApi()) {
        setIsLoading(false);
        return;
      }

      try {
        const cfg = await getAuthConfig();
        setAuthMode(cfg.authMode);

        const token = await getValidToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        const userData = await restClient.get<User>('/api/auth/me');
        setUser(userData);
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = useCallback(async (username?: string, password?: string) => {
    setError(null);
    const mode = getCachedAuthMode();

    if (mode === 'cognito') {
      const { redirectToLogin } = await import('./cognito');
      await redirectToLogin();
      return;
    }

    // Local mode
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      const result = await localLogin(username, password);
      setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        organizationId: result.user.organizationId,
        organizationName: '',
        role: result.user.role,
      });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  }, []);

  const register = useCallback(async (username: string, password: string, fullName?: string) => {
    setError(null);
    try {
      const result = await localRegister(username, password, fullName);
      setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        organizationId: result.user.organizationId,
        organizationName: '',
        role: result.user.role,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
    const mode = getCachedAuthMode();
    if (mode === 'cognito') {
      import('./cognito').then(({ logout: cognitoLogout }) => cognitoLogout());
    } else {
      localLogout();
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const isAuthenticated = Boolean(user) || (getCachedAuthMode() === 'local' ? Boolean(getLocalToken()) : false);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    authMode,
    login,
    register,
    logout,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
