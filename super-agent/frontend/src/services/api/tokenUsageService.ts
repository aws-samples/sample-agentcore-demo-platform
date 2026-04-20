/**
 * Token Usage API Service
 */

import { restClient } from './restClient';

export interface MonthlyUsage {
  userId: string;
  userName?: string;
  email?: string;
  month: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  invocationCount: number;
}

export const TokenUsageService = {
  /** Get current user's usage history */
  getMyUsage: (months = 6) =>
    restClient
      .get<{ data: MonthlyUsage[] }>(`/api/token-usage/me?months=${months}`)
      .then((r) => r.data),

  /** Get all members' usage for a month (Admin/Owner only) */
  getOrganizationUsage: (month?: string) =>
    restClient
      .get<{ data: MonthlyUsage[] }>(`/api/token-usage/organization${month ? `?month=${month}` : ''}`)
      .then((r) => r.data),

  /** Get a specific user's usage history (Admin/Owner only) */
  getUserUsage: (userId: string, months = 6) =>
    restClient
      .get<{ data: MonthlyUsage[] }>(`/api/token-usage/users/${userId}?months=${months}`)
      .then((r) => r.data),
};
