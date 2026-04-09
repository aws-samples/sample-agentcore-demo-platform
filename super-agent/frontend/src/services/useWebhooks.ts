/**
 * useWebhooks Hook
 * 
 * React hook for managing workflow webhooks.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { RestWebhookService } from './api/restWebhookService';
import type { 
  Webhook, 
  WebhookCallRecord, 
  CreateWebhookRequest, 
  UpdateWebhookRequest,
  CreateWebhookResponse 
} from './api/restWebhookService';

export interface UseWebhooksState {
  webhooks: Webhook[];
  isLoading: boolean;
  error: string | null;
}

export interface UseWebhooksReturn extends UseWebhooksState {
  loadWebhooks: (workflowId: string) => Promise<void>;
  createWebhook: (workflowId: string, data?: CreateWebhookRequest) => Promise<CreateWebhookResponse | null>;
  updateWebhook: (webhookId: string, data: UpdateWebhookRequest) => Promise<Webhook | null>;
  deleteWebhook: (webhookId: string) => Promise<boolean>;
  getCallHistory: (webhookId: string, page?: number, limit?: number) => Promise<{
    records: WebhookCallRecord[];
    total: number;
    totalPages: number;
  } | null>;
  clearError: () => void;
}

export function useWebhooks(initialWorkflowId?: string): UseWebhooksReturn {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load webhooks on mount if workflowId provided
  useEffect(() => {
    if (initialWorkflowId) {
      void loadWebhooks(initialWorkflowId);
    }
  }, [initialWorkflowId]);

  const loadWebhooks = useCallback(async (workflowId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await RestWebhookService.listWebhooks(workflowId);
      if (isMountedRef.current) {
        setWebhooks(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load webhooks');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const createWebhook = useCallback(async (
    workflowId: string,
    data: CreateWebhookRequest = {}
  ): Promise<CreateWebhookResponse | null> => {
    try {
      const response = await RestWebhookService.createWebhook(workflowId, data);
      if (isMountedRef.current) {
        setWebhooks(prev => [...prev, response.webhook]);
      }
      return response;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to create webhook');
      }
      return null;
    }
  }, []);

  const updateWebhook = useCallback(async (
    webhookId: string,
    data: UpdateWebhookRequest
  ): Promise<Webhook | null> => {
    try {
      const webhook = await RestWebhookService.updateWebhook(webhookId, data);
      if (isMountedRef.current) {
        setWebhooks(prev => prev.map(w => w.webhookId === webhookId ? { ...w, ...webhook } : w));
      }
      return webhook;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to update webhook');
      }
      return null;
    }
  }, []);

  const deleteWebhook = useCallback(async (webhookId: string): Promise<boolean> => {
    try {
      await RestWebhookService.deleteWebhook(webhookId);
      if (isMountedRef.current) {
        setWebhooks(prev => prev.filter(w => w.webhookId !== webhookId));
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to delete webhook');
      }
      return false;
    }
  }, []);

  const getCallHistory = useCallback(async (
    webhookId: string,
    page = 1,
    limit = 20
  ) => {
    try {
      const response = await RestWebhookService.getCallHistory(webhookId, page, limit);
      return {
        records: response.data,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      };
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load call history');
      }
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    webhooks,
    isLoading,
    error,
    loadWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    getCallHistory,
    clearError,
  };
}

export type { Webhook, WebhookCallRecord, CreateWebhookRequest, UpdateWebhookRequest };
