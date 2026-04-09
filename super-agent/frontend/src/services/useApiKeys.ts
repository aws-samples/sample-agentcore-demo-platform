/**
 * useApiKeys Hook
 * 
 * React hook for managing API keys.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { RestApiKeyService } from './api/restApiKeyService';
import type { ApiKey, CreateApiKeyRequest, CreateApiKeyResponse } from './api/restApiKeyService';

export interface UseApiKeysState {
  apiKeys: ApiKey[];
  isLoading: boolean;
  error: string | null;
}

export interface UseApiKeysReturn extends UseApiKeysState {
  loadApiKeys: () => Promise<void>;
  createApiKey: (data: CreateApiKeyRequest) => Promise<CreateApiKeyResponse | null>;
  revokeApiKey: (keyId: string) => Promise<boolean>;
  deleteApiKey: (keyId: string) => Promise<boolean>;
  clearError: () => void;
}

export function useApiKeys(autoLoad = true): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadApiKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await RestApiKeyService.listApiKeys();
      if (isMountedRef.current) {
        setApiKeys(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load API keys');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void loadApiKeys();
    }
  }, [autoLoad, loadApiKeys]);

  const createApiKey = useCallback(async (
    data: CreateApiKeyRequest
  ): Promise<CreateApiKeyResponse | null> => {
    try {
      const response = await RestApiKeyService.createApiKey(data);
      if (isMountedRef.current) {
        setApiKeys(prev => [...prev, response.data]);
      }
      return response;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to create API key');
      }
      return null;
    }
  }, []);

  const revokeApiKey = useCallback(async (keyId: string): Promise<boolean> => {
    try {
      await RestApiKeyService.revokeApiKey(keyId);
      if (isMountedRef.current) {
        setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive: false } : k));
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to revoke API key');
      }
      return false;
    }
  }, []);

  const deleteApiKey = useCallback(async (keyId: string): Promise<boolean> => {
    try {
      await RestApiKeyService.deleteApiKey(keyId);
      if (isMountedRef.current) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId));
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to delete API key');
      }
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    apiKeys,
    isLoading,
    error,
    loadApiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
    clearError,
  };
}

export type { ApiKey, CreateApiKeyRequest };
