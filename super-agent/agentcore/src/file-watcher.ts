/**
 * File Watcher — monitors /workspace for changes, debounces, then syncs to S3.
 */

import fs from 'fs';
import { S3Client } from '@aws-sdk/client-s3';
import { syncWorkspaceToS3 } from './workspace-sync.js';

const DEBOUNCE_MS = 2000;
const WORKSPACE_DIR = '/workspace';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let watchers: fs.FSWatcher[] = [];
let activeS3: S3Client | null = null;
let activeBucket: string | null = null;
let activePrefix: string | null = null;

export function startFileWatcher(s3: S3Client, bucket: string, prefix: string): void {
  stopFileWatcher();
  activeS3 = s3;
  activeBucket = bucket;
  activePrefix = prefix;

  if (!fs.existsSync(WORKSPACE_DIR)) return;

  try {
    const watcher = fs.watch(WORKSPACE_DIR, { recursive: true }, () => {
      scheduleSync();
    });
    watchers.push(watcher);
    console.log(`[file-watcher] Watching ${WORKSPACE_DIR}`);
  } catch (err) {
    console.warn(`[file-watcher] Failed to watch ${WORKSPACE_DIR}:`, err);
  }
}

export function stopFileWatcher(): void {
  for (const w of watchers) {
    try { w.close(); } catch { /* ignore */ }
  }
  watchers = [];
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function scheduleSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    if (!activeS3 || !activeBucket || !activePrefix) return;
    try {
      await syncWorkspaceToS3(activeS3, activeBucket, activePrefix);
    } catch (err) {
      console.warn('[file-watcher] Sync failed:', err);
    }
  }, DEBOUNCE_MS);
}
