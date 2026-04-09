/**
 * Avatar Utilities
 * 
 * Handles avatar URL resolution for agents.
 * S3 avatar keys are resolved to presigned URLs (browser fetches directly from S3).
 * Falls back to backend proxy while presigned URL is being fetched.
 */

import { getAuthToken } from '@/services/api/restClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * In-memory cache for presigned avatar URLs.
 */
const presignedCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Negative cache for keys that returned 404 — avoid retrying.
 */
const notFoundCache = new Set<string>();

/**
 * In-flight requests to avoid duplicate fetches.
 */
const inflightRequests = new Map<string, Promise<string | null>>();

/**
 * Checks if the avatar value is an S3 key (generated image)
 */
export function isS3AvatarKey(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith('avatars/');
}

/**
 * Checks if the avatar value is a URL (external image)
 */
export function isAvatarUrl(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith('http://') || 
         avatar.startsWith('https://') || 
         avatar.startsWith('data:image/');
}

/**
 * Fetch and cache a presigned URL for an S3 avatar key.
 * Cached for 50 minutes (presigned URLs valid for 1 hour).
 */
function fetchPresignedUrl(s3Key: string): void {
  if (inflightRequests.has(s3Key)) return;
  if (notFoundCache.has(s3Key)) return;

  const filename = s3Key.replace('avatars/', '');
  const promise = (async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/avatars/presign/${encodeURIComponent(filename)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        // Cache 404s so we don't retry missing images
        if (res.status === 404) notFoundCache.add(s3Key);
        return null;
      }
      const data = await res.json();
      const url = data.url as string;
      presignedCache.set(s3Key, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
      return url;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(s3Key);
    }
  })();

  inflightRequests.set(s3Key, promise);
}

/**
 * Gets the display URL for an avatar.
 * - For S3 keys: returns cached presigned URL (direct S3), or triggers async fetch
 *   and returns null in the meantime (component shows fallback character).
 * - For URLs: returns the URL as-is.
 * - For characters/fallback: returns null.
 */
export function getAvatarDisplayUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  
  if (isS3AvatarKey(avatar)) {
    if (notFoundCache.has(avatar)) return null;
    const cached = presignedCache.get(avatar);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
    // Trigger async presigned URL fetch
    fetchPresignedUrl(avatar);
    // Return null — component shows fallback character until presigned URL is cached.
    // On next render (e.g. user interaction, state change), the cached URL will be used.
    return null;
  }
  
  if (isAvatarUrl(avatar)) {
    return avatar;
  }
  
  return null;
}

/**
 * Async version — resolves to the presigned URL. Use in useEffect or async contexts.
 */
export async function getAvatarDisplayUrlAsync(avatar: string | null | undefined): Promise<string | null> {
  if (!avatar) return null;
  if (isS3AvatarKey(avatar)) {
    const cached = presignedCache.get(avatar);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const filename = avatar.replace('avatars/', '');
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/avatars/presign/${encodeURIComponent(filename)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      const data = await res.json();
      const url = data.url as string;
      presignedCache.set(avatar, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
      return url;
    } catch {
      return null;
    }
  }
  if (isAvatarUrl(avatar)) return avatar;
  return null;
}

/**
 * Gets the fallback character for an avatar (first character of display name)
 */
export function getAvatarFallback(displayName: string, avatar?: string | null): string {
  if (avatar && !isS3AvatarKey(avatar) && !isAvatarUrl(avatar)) {
    return avatar;
  }
  return displayName.charAt(0).toUpperCase();
}

/**
 * Determines if the avatar should be displayed as an image
 */
export function shouldShowAvatarImage(avatar: string | null | undefined): boolean {
  if (isS3AvatarKey(avatar)) {
    if (notFoundCache.has(avatar!)) return false;
    // Only show as image if presigned URL is already cached
    const cached = presignedCache.get(avatar!);
    return !!(cached && cached.expiresAt > Date.now());
  }
  return isAvatarUrl(avatar);
}
