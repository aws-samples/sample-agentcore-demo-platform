import { useState, useCallback, useEffect, useRef } from 'react';
import { TokenUsageService, type MonthlyUsage } from './api/tokenUsageService';

export function useMyTokenUsage(months = 6) {
  const [data, setData] = useState<MonthlyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await TokenUsageService.getMyUsage(months);
      if (mountedRef.current) setData(rows);
    } catch (e) {
      console.error('Failed to load token usage:', e);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [months]);

  useEffect(() => { void load(); }, [load]);

  return { data, isLoading, reload: load };
}

export function useOrganizationTokenUsage(month?: string) {
  const [data, setData] = useState<MonthlyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await TokenUsageService.getOrganizationUsage(month);
      if (mountedRef.current) setData(rows);
    } catch (e) {
      console.error('Failed to load org token usage:', e);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  return { data, isLoading, reload: load };
}
