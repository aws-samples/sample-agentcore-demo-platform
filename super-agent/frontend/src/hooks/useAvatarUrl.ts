/**
 * Hook to resolve S3 avatar keys to presigned URLs.
 * Returns the presigned URL once fetched, or null while loading.
 */
import { useState, useEffect } from 'react';
import { getAvatarDisplayUrlAsync, isS3AvatarKey, isAvatarUrl } from '@/utils/avatarUtils';

export function useAvatarUrl(avatar: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!avatar) return null;
    if (isAvatarUrl(avatar)) return avatar;
    // For S3 keys, start as null — will resolve async
    return null;
  });

  useEffect(() => {
    if (!avatar) { setUrl(null); return; }
    if (isAvatarUrl(avatar)) { setUrl(avatar); return; }
    if (!isS3AvatarKey(avatar)) { setUrl(null); return; }

    let cancelled = false;
    getAvatarDisplayUrlAsync(avatar).then(resolved => {
      if (!cancelled) setUrl(resolved);
    });
    return () => { cancelled = true; };
  }, [avatar]);

  return url;
}
