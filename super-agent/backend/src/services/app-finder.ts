/**
 * App Finder
 *
 * Intelligently locates the actual app root within a session workspace.
 * Solves the problem where the agent creates apps in nested/unexpected
 * subdirectories, causing blank pages in preview and publish.
 *
 * Strategy (in priority order):
 *   1. Root has package.json with a dev/build script → root IS the app
 *   2. Walk immediate children for a package.json with vite/react/vue deps
 *   3. Walk up to 3 levels deep for any package.json with a build script
 *   4. Find any index.html (including in nested dirs)
 *   5. Fall back to workspace root
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';

interface AppCandidate {
  /** Absolute path to the app root directory */
  path: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** Confidence score (higher = better match) */
  score: number;
  /** Why this was chosen */
  reason: string;
}

/** Directories to skip when scanning */
const SKIP_DIRS = new Set([
  'node_modules', '.claude', '.git', '.sessions', 'dist', 'build', '.next', '.nuxt',
]);

/**
 * Find the most likely app root directory within a workspace.
 * Returns the relative path from workspaceRoot, or '.' if the root itself is the app.
 */
export async function findAppRoot(workspaceRoot: string): Promise<AppCandidate> {
  const candidates: AppCandidate[] = [];

  // 1. Check workspace root itself
  const rootScore = await scoreDirectory(workspaceRoot);
  if (rootScore > 0) {
    candidates.push({
      path: workspaceRoot,
      relativePath: '.',
      score: rootScore + 10, // bonus for being root
      reason: 'Workspace root has app indicators',
    });
  }

  // 2. Scan subdirectories up to 3 levels deep
  await scanForApps(workspaceRoot, workspaceRoot, 0, 3, candidates);

  // 3. Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return best candidate, or fall back to root
  return candidates[0] ?? {
    path: workspaceRoot,
    relativePath: '.',
    score: 0,
    reason: 'Fallback to workspace root',
  };
}

/**
 * Find all app candidates (useful for multi-app workspaces).
 */
export async function findAllApps(workspaceRoot: string): Promise<AppCandidate[]> {
  const candidates: AppCandidate[] = [];

  const rootScore = await scoreDirectory(workspaceRoot);
  if (rootScore > 0) {
    candidates.push({
      path: workspaceRoot,
      relativePath: '.',
      score: rootScore + 10,
      reason: 'Workspace root',
    });
  }

  await scanForApps(workspaceRoot, workspaceRoot, 0, 3, candidates);
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

async function scanForApps(
  workspaceRoot: string,
  dir: string,
  depth: number,
  maxDepth: number,
  candidates: AppCandidate[],
): Promise<void> {
  if (depth >= maxDepth) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);
    const score = await scoreDirectory(fullPath);

    if (score > 0) {
      candidates.push({
        path: fullPath,
        relativePath: relative(workspaceRoot, fullPath),
        score,
        reason: `Found app in ${entry.name}/`,
      });
    }

    // Keep scanning deeper (the nested folder problem means the real app
    // might be at todo-app/todo-app/)
    await scanForApps(workspaceRoot, fullPath, depth + 1, maxDepth, candidates);
  }
}

/**
 * Score a directory on how likely it is to be a web app root.
 * Returns 0 if it's definitely not an app.
 */
async function scoreDirectory(dir: string): Promise<number> {
  let score = 0;

  // Check for package.json
  const pkg = await readPackageJson(dir);
  if (pkg) {
    score += 5;

    // Has vite, react, vue, next, etc. as dependency
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps.vite) score += 10;
    if (allDeps.react || allDeps['react-dom']) score += 8;
    if (allDeps.vue) score += 8;
    if (allDeps.next) score += 8;
    if (allDeps.nuxt) score += 8;
    if (allDeps.svelte) score += 8;

    // Has build/dev scripts
    if (pkg.scripts?.build) score += 5;
    if (pkg.scripts?.dev) score += 5;
    if (pkg.scripts?.start) score += 3;
  }

  // Check for index.html at root (strong signal for Vite/vanilla apps)
  if (await fileExists(join(dir, 'index.html'))) score += 8;

  // Check for built output
  if (await fileExists(join(dir, 'dist', 'index.html'))) score += 12;
  if (await fileExists(join(dir, 'build', 'index.html'))) score += 12;

  // Check for vite.config
  if (
    await fileExists(join(dir, 'vite.config.ts')) ||
    await fileExists(join(dir, 'vite.config.js'))
  ) {
    score += 10;
  }

  return score;
}

async function readPackageJson(dir: string): Promise<Record<string, any> | null> {
  try {
    const raw = await readFile(join(dir, 'package.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
