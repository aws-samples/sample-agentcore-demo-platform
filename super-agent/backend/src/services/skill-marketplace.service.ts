/**
 * Skill Marketplace Service
 *
 * Integrates with the skills.sh open ecosystem to search, preview,
 * and install community skills into the platform.
 *
 * Skills on skills.sh are GitHub-hosted repos with a standard structure:
 *   {repo}/.claude/skills/{skill-name}/SKILL.md
 *
 * The install flow:
 *   1. Fetch SKILL.md (or README.md fallback) from GitHub raw content
 *   2. Write to local data/skills/{hashId}/ directory
 *   3. Create DB record via SkillService
 *   4. Optionally assign to an agent
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, cp, readFile, readdir, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { skillService, type CreateSkillInput } from './skill.service.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketplaceSkillResult {
  /** e.g. "vercel-labs/skills" */
  owner: string;
  /** e.g. "find-skills" */
  name: string;
  /** Full install ref: "vercel-labs/skills@find-skills" or "owner/repo" */
  installRef: string;
  /** URL on skills.sh */
  url: string;
  /** Description from the listing */
  description: string | null;
}

export interface MarketplaceSkillDetail {
  name: string;
  owner: string;
  installRef: string;
  url: string;
  description: string | null;
  /** Raw SKILL.md or README.md content (fetched from GitHub) */
  skillMdContent: string | null;
  /** Which file was found: 'SKILL.md' | 'README.md' | null */
  contentFileName: string | null;
  /** GitHub repo URL */
  repoUrl: string;
}

export interface InstallSkillOptions {
  organizationId: string;
  /** The marketplace install ref (e.g. "vercel-labs/skills@find-skills") */
  installRef: string;
  /** Override display name */
  displayName?: string;
  /** Override description */
  description?: string;
  /** Tags to apply */
  tags?: string[];
  /** Agent ID to assign the skill to after install */
  assignToAgentId?: string;
  /** User performing the install */
  userId?: string;
}

export interface InstalledSkillResult {
  skillId: string;
  name: string;
  displayName: string;
  assignedToAgent: boolean;
  localPath: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip ANSI escape codes from CLI output.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Parse `npx skills find` output into structured results.
 *
 * Actual CLI output format (with ANSI color codes):
 *   Install with npx skills add <owner/repo@skill>
 *
 *   ouachitalabs/skills@beancount accounting
 *   └── https://skills.sh/ouachitalabs/skills/beancount-accounting
 */
function parseSkillsFindOutput(stdout: string): MarketplaceSkillResult[] {
  const results: MarketplaceSkillResult[] = [];
  // Strip ANSI escape codes first
  const clean = stripAnsi(stdout);
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Match "owner/repo@skill name with spaces" or "owner/repo"
    // The skill name after @ can contain spaces
    const refMatch = line.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)(?:@(.+))?$/);
    if (!refMatch) continue;

    // Skip the "Install with..." instruction line
    if (line.startsWith('Install ')) continue;

    const owner = refMatch[1]!;
    // Strip trailing star/rating info (e.g. "⭐ 42", "★ 123", "⭐42")
    // and install count info (e.g. "141.9K installs", "3.9K installs", "999 installs")
    const rawSkillName = refMatch[2]
      ?.replace(/\s*[⭐★☆✩✪✫✬✭✮✯]\s*\d+\s*$/, '')
      .replace(/\s+\d+\.?\d*[KMBkmb]?\s*installs?\s*$/i, '')
      .trim() || undefined;
    // For installRef, convert spaces to hyphens (the actual install ref format)
    const skillSlug = rawSkillName ? rawSkillName.replace(/\s+/g, '-') : (owner.split('/')[1] || owner);
    const installRef = rawSkillName ? `${owner}@${skillSlug}` : owner;

    // Next line might be the URL (starts with └ or contains skills.sh URL)
    let url = `https://skills.sh/${owner}/${skillSlug}`;
    let description: string | null = rawSkillName || null;
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1]!;
      const urlMatch = nextLine.match(/https:\/\/skills\.sh\/\S+/);
      if (urlMatch) {
        url = urlMatch[0];
        i++; // skip the URL line
      }
    }

    results.push({
      owner,
      name: skillSlug,
      installRef,
      url,
      description,
    });
  }

  return results;
}

/**
 * Fetch skill content from GitHub raw content.
 * Tries SKILL.md first, then falls back to README.md.
 */
async function fetchSkillContentFromGitHub(installRef: string): Promise<{ content: string; repoUrl: string; fileName: string } | null> {
  // Parse "owner/repo@skill-name" or "owner/repo"
  const atIdx = installRef.indexOf('@');
  const repoPath = atIdx > -1 ? installRef.substring(0, atIdx) : installRef;
  const skillName = atIdx > -1 ? installRef.substring(atIdx + 1) : null;
  const repoUrl = `https://github.com/${repoPath}`;

  // Build candidate paths: SKILL.md first, then README.md
  const candidatePaths: { path: string; fileName: string }[] = [];

  if (skillName) {
    candidatePaths.push(
      { path: `.claude/skills/${skillName}/SKILL.md`, fileName: 'SKILL.md' },
      { path: `skills/${skillName}/SKILL.md`, fileName: 'SKILL.md' },
      { path: `${skillName}/SKILL.md`, fileName: 'SKILL.md' },
    );
  }
  candidatePaths.push(
    { path: 'SKILL.md', fileName: 'SKILL.md' },
    { path: 'README.md', fileName: 'README.md' },
  );

  for (const { path, fileName } of candidatePaths) {
    for (const branch of ['main', 'master']) {
      const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${path}`;
      try {
        const res = await fetch(rawUrl);
        if (res.ok) {
          const content = await res.text();
          return { content, repoUrl, fileName };
        }
      } catch { /* try next */ }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(private ttl: number = DEFAULT_CACHE_TTL) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttl });
  }

  /**
   * Deduplicate concurrent requests for the same key.
   * If a fetch is already in-flight, piggyback on it instead of starting another.
   */
  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = fetcher().then(data => {
      this.set(key, data);
      this.inflight.delete(key);
      return data;
    }).catch(err => {
      this.inflight.delete(key);
      throw err;
    });

    this.inflight.set(key, promise);
    return promise;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SkillMarketplaceService {
  private searchCache = new MemoryCache<MarketplaceSkillResult[]>();
  private featuredCache = new MemoryCache<MarketplaceSkillResult[]>();

  /**
   * Search the skills.sh marketplace using the CLI.
   */
  async search(query: string): Promise<MarketplaceSkillResult[]> {
    const cacheKey = query.toLowerCase().trim();
    return this.searchCache.getOrFetch(cacheKey, async () => {
      try {
        const { stdout } = await execFileAsync('npx', ['skills', 'find', query], {
          timeout: 30_000,
          env: { ...process.env, NODE_NO_WARNINGS: '1' },
        });
        return parseSkillsFindOutput(stdout);
      } catch (error) {
        console.warn('npx skills find failed, falling back to GitHub search:', error instanceof Error ? error.message : error);
        return this.searchViaGitHub(query);
      }
    });
  }

  /**
   * Return a list of featured / popular skills from skills.sh.
   * Uses `npx skills find` with a broad query, falling back to GitHub.
   */
  async featured(): Promise<MarketplaceSkillResult[]> {
    return this.featuredCache.getOrFetch('featured', async () => {
      const queries = ['claude', 'agent', 'code'];
      const seen = new Set<string>();
      const all: MarketplaceSkillResult[] = [];

      for (const q of queries) {
        try {
          const results = await this.search(q);
          for (const r of results) {
            if (!seen.has(r.installRef)) {
              seen.add(r.installRef);
              all.push(r);
            }
          }
        } catch {
          // continue with next query
        }
        if (all.length >= 12) break;
      }

      return all.slice(0, 12);
    });
  }


  /**
   * Fallback: search GitHub for Claude skills repos.
   */
  private async searchViaGitHub(query: string): Promise<MarketplaceSkillResult[]> {
    try {
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query + ' claude skill SKILL.md')}&sort=stars&per_page=10`;
      const res = await fetch(searchUrl, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'frontend' },
      });
      if (!res.ok) return [];
      const data = await res.json() as { items: Array<{ full_name: string; description: string | null; html_url: string }> };
      return (data.items || []).map(repo => ({
        owner: repo.full_name,
        name: repo.full_name.split('/')[1] || repo.full_name,
        installRef: repo.full_name,
        url: `https://skills.sh/${repo.full_name}`,
        description: repo.description,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get detailed info about a marketplace skill, including SKILL.md content.
   */
  /**
   * Get detailed info about a marketplace skill, including SKILL.md content.
   * Tries local .agents/skills/ first, then falls back to GitHub raw fetch.
   */
  async getDetail(installRef: string): Promise<MarketplaceSkillDetail | null> {
    const atIdx = installRef.indexOf('@');
    const owner = atIdx > -1 ? installRef.substring(0, atIdx) : installRef;
    const name = atIdx > -1 ? installRef.substring(atIdx + 1) : (installRef.split('/')[1] || installRef);

    // Try reading from local .agents/skills/ first (if previously installed via CLI)
    let content: string | null = null;
    let contentFileName: string | null = null;
    const localSkillPath = resolve(process.cwd(), '.agents', 'skills', name, 'SKILL.md');
    try {
      content = await readFile(localSkillPath, 'utf-8');
      contentFileName = 'SKILL.md';
    } catch { /* not installed locally */ }

    // Fall back to GitHub raw fetch
    if (!content) {
      const fetched = await fetchSkillContentFromGitHub(installRef);
      content = fetched?.content ?? null;
      contentFileName = fetched?.fileName ?? null;
    }

    return {
      name,
      owner,
      installRef,
      url: `https://skills.sh/${owner}/${name}`,
      description: null,
      skillMdContent: content,
      contentFileName,
      repoUrl: `https://github.com/${owner}`,
    };
  }

  /**
   * Install a skill from the marketplace into the platform.
   *
   * Uses `npx skills add` to clone and install the skill into a temp directory,
   * then copies the skill files to data/skills/{hashId}/.
   */
  async install(options: InstallSkillOptions): Promise<InstalledSkillResult> {
    const { organizationId, installRef, assignToAgentId, userId } = options;

    // Parse name from installRef
    const atIdx = installRef.indexOf('@');
    const repoRef = atIdx > -1 ? installRef.substring(0, atIdx) : installRef;
    const skillName = atIdx > -1 ? installRef.substring(atIdx + 1) : installRef.split('/').pop()!;
    const displayName = options.displayName || skillName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const hashId = createHash('sha256').update(`${organizationId}:marketplace:${installRef}:${Date.now()}`).digest('hex').substring(0, 16);

    // Permanent skill directory
    const skillDir = resolve(process.cwd(), 'data', 'skills', hashId);
    await mkdir(skillDir, { recursive: true });

    let skillContent: string | null = null;
    let contentFileName = 'SKILL.md';

    // Try `npx skills add` first, fall back to GitHub raw fetch
    let installed = false;
    const tmpDir = resolve(process.cwd(), 'data', 'tmp', `install-${hashId}`);

    try {
      await mkdir(tmpDir, { recursive: true });
      const skillFlag = atIdx > -1 ? skillName : '*';
      await execFileAsync('npx', ['skills', 'add', repoRef, '--yes', '--skill', skillFlag], {
        timeout: 60_000,
        cwd: tmpDir,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      });

      // Find installed skill files in .agents/skills/{skillName}/
      const agentsSkillsDir = join(tmpDir, '.agents', 'skills');
      const installedSkills = await readdir(agentsSkillsDir).catch(() => [] as string[]);

      let sourceSkillDir: string | null = null;
      if (installedSkills.includes(skillName)) {
        sourceSkillDir = join(agentsSkillsDir, skillName);
      } else if (installedSkills.length > 0) {
        sourceSkillDir = join(agentsSkillsDir, installedSkills[0]!);
      }

      if (sourceSkillDir) {
        await cp(sourceSkillDir, skillDir, { recursive: true });
        installed = true;
      }
    } catch (err) {
      console.warn('npx skills add failed, falling back to GitHub fetch:', err instanceof Error ? err.message : err);
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    // Fallback: fetch SKILL.md from GitHub directly
    if (!installed) {
      const fetched = await fetchSkillContentFromGitHub(installRef);
      if (fetched) {
        skillContent = fetched.content;
        contentFileName = fetched.fileName;
        await writeFile(join(skillDir, contentFileName), skillContent, 'utf-8');
        installed = true;
      }
    }

    if (!installed) {
      await rm(skillDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Failed to install skill "${installRef}": CLI unavailable and GitHub fetch failed`);
    }

    // Read SKILL.md content for DB metadata (if not already fetched)
    if (!skillContent) {
      try {
        skillContent = await readFile(join(skillDir, 'SKILL.md'), 'utf-8');
      } catch {
        try {
          skillContent = await readFile(join(skillDir, 'README.md'), 'utf-8');
          contentFileName = 'README.md';
        } catch { /* no content file */ }
      }
    }

    // Extract description from SKILL.md frontmatter
    let description = options.description || null;
    if (!description && skillContent) {
      const descMatch = skillContent.match(/^description:\s*(.+)$/m);
      if (descMatch?.[1]) description = descMatch[1].trim();
    }

    // Write metadata.json
    await writeFile(join(skillDir, 'metadata.json'), JSON.stringify({
      installRef,
      source: 'skills.sh',
      repoUrl: `https://github.com/${repoRef}`,
      contentFileName,
      installedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');

    // Create or update DB record
    const existing = await skillService.findByName(organizationId, skillName);
    let skill;

    const metadata = {
      source: 'skills.sh',
      installRef,
      repoUrl: `https://github.com/${repoRef}`,
      contentFileName,
      localPath: skillDir,
      installedAt: new Date().toISOString(),
      hash_id: hashId,
    };

    if (existing) {
      skill = await skillService.updateSkill(organizationId, existing.id, {
        display_name: displayName,
        description: description || existing.description || `Installed from skills.sh: ${installRef}`,
        tags: [...(options.tags || []), 'marketplace', 'skills.sh'],
        metadata,
      });
      if (!skill) throw new Error(`Failed to update existing skill: ${skillName}`);
    } else {
      const createInput: CreateSkillInput = {
        name: skillName,
        display_name: displayName,
        description: description || `Installed from skills.sh: ${installRef}`,
        version: '1.0.0',
        tags: [...(options.tags || []), 'marketplace', 'skills.sh'],
        metadata,
      };
      skill = await skillService.createSkill(organizationId, createInput);
    }

    // Optionally assign to agent
    let assignedToAgent = false;
    if (assignToAgentId) {
      try {
        await skillService.assignSkillToAgent(organizationId, assignToAgentId, skill.id, userId);
        assignedToAgent = true;
      } catch (err) {
        console.warn(`Failed to assign skill to agent ${assignToAgentId}:`, err);
      }
    }

    // Auto-publish to enterprise catalog so it appears in the Internal tab
    try {
      const { enterpriseSkillRepository } = await import('../repositories/enterprise-skill.repository.js');
      const existingEntry = await enterpriseSkillRepository.findBySkillId(skill.id, organizationId);
      if (!existingEntry) {
        await enterpriseSkillRepository.publish(organizationId, {
          skillId: skill.id,
          publishedBy: userId || 'system',
          source: 'skills.sh',
          sourceRef: installRef,
        });
      }
    } catch (err) {
      console.warn(`Failed to auto-publish skill to enterprise catalog:`, err);
    }

    return {
      skillId: skill.id,
      name: skillName,
      displayName,
      assignedToAgent,
      localPath: skillDir,
    };
  }

  /**
   * Parse an arbitrary GitHub URL into repo path and sub-directory.
   * Supports formats like:
   *   https://github.com/owner/repo
   *   https://github.com/owner/repo/tree/main/some/path
   *   https://github.com/owner/repo/blob/main/some/file.md
   */
  parseGitHubUrl(url: string): { repoPath: string; subPath: string | null; branch: string | null } | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com') return null;

      // pathname: /owner/repo[/tree|blob/branch/...path]
      const parts = parsed.pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
      if (parts.length < 2) return null;

      const repoPath = `${parts[0]}/${parts[1]}`;

      if (parts.length === 2) {
        return { repoPath, subPath: null, branch: null };
      }

      // /tree/main/some/path or /blob/main/some/file
      if ((parts[2] === 'tree' || parts[2] === 'blob') && parts.length >= 4) {
        const branch = parts[3]!;
        const subPath = parts.length > 4 ? parts.slice(4).join('/') : null;
        return { repoPath, subPath, branch };
      }

      return { repoPath, subPath: null, branch: null };
    } catch {
      return null;
    }
  }

  /**
   * Probe a GitHub URL for SKILL.md files.
   * Returns a list of discovered skills with their install refs.
   */
  async probeGitHubUrl(url: string): Promise<{
    found: boolean;
    repoPath: string;
    skills: Array<{ name: string; installRef: string; skillMdUrl: string; description: string | null }>;
    error?: string;
  }> {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed) {
      return { found: false, repoPath: '', skills: [], error: 'Invalid GitHub URL' };
    }

    const { repoPath, subPath, branch: urlBranch } = parsed;
    const branches = urlBranch ? [urlBranch] : ['main', 'master'];
    const skills: Array<{ name: string; installRef: string; skillMdUrl: string; description: string | null }> = [];

    // Strategy 1: Check if SKILL.md exists directly at the given path
    if (subPath) {
      for (const branch of branches) {
        // Check SKILL.md in the directory itself
        const directUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${subPath}/SKILL.md`;
        try {
          const res = await fetch(directUrl);
          if (res.ok) {
            const content = await res.text();
            const descMatch = content.match(/^description:\s*(.+)$/m);
            const skillName = subPath.split('/').pop() || repoPath.split('/')[1] || 'skill';
            skills.push({
              name: skillName,
              installRef: `${repoPath}@${skillName}`,
              skillMdUrl: `https://github.com/${repoPath}/blob/${branch}/${subPath}/SKILL.md`,
              description: descMatch?.[1]?.trim() || null,
            });
            return { found: true, repoPath, skills };
          }
        } catch { /* try next */ }

        // Check if the path itself IS a SKILL.md file
        if (subPath.endsWith('SKILL.md') || subPath.endsWith('skill.md')) {
          const fileUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${subPath}`;
          try {
            const res = await fetch(fileUrl);
            if (res.ok) {
              const content = await res.text();
              const descMatch = content.match(/^description:\s*(.+)$/m);
              const parentDir = subPath.split('/').slice(0, -1).pop() || repoPath.split('/')[1] || 'skill';
              skills.push({
                name: parentDir,
                installRef: `${repoPath}@${parentDir}`,
                skillMdUrl: `https://github.com/${repoPath}/blob/${branch}/${subPath}`,
                description: descMatch?.[1]?.trim() || null,
              });
              return { found: true, repoPath, skills };
            }
          } catch { /* try next */ }
        }
      }
    }

    // Strategy 2: Use GitHub API to list directory contents and find SKILL.md files
    for (const branch of branches) {
      const apiPath = subPath || '';
      const apiUrl = `https://api.github.com/repos/${repoPath}/contents/${apiPath}?ref=${branch}`;
      try {
        const res = await fetch(apiUrl, {
          headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'super-agent' },
        });
        if (!res.ok) continue;

        const entries = await res.json() as Array<{ name: string; type: string; path: string }>;
        if (!Array.isArray(entries)) continue;

        // Check for SKILL.md directly in this directory
        const skillMd = entries.find(e => e.name.toUpperCase() === 'SKILL.MD');
        if (skillMd) {
          const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${skillMd.path}`;
          let description: string | null = null;
          try {
            const contentRes = await fetch(rawUrl);
            if (contentRes.ok) {
              const content = await contentRes.text();
              const descMatch = content.match(/^description:\s*(.+)$/m);
              description = descMatch?.[1]?.trim() || null;
            }
          } catch { /* ignore */ }

          const dirName = apiPath ? apiPath.split('/').pop()! : repoPath.split('/')[1] || 'skill';
          skills.push({
            name: dirName,
            installRef: `${repoPath}@${dirName}`,
            skillMdUrl: `https://github.com/${repoPath}/blob/${branch}/${skillMd.path}`,
            description,
          });
        }

        // Check subdirectories for SKILL.md (one level deep)
        const dirs = entries.filter(e => e.type === 'dir');
        const subChecks = dirs.map(async (dir) => {
          const subApiUrl = `https://api.github.com/repos/${repoPath}/contents/${dir.path}?ref=${branch}`;
          try {
            const subRes = await fetch(subApiUrl, {
              headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'super-agent' },
            });
            if (!subRes.ok) return null;
            const subEntries = await subRes.json() as Array<{ name: string; path: string }>;
            if (!Array.isArray(subEntries)) return null;

            const subSkillMd = subEntries.find(e => e.name.toUpperCase() === 'SKILL.MD');
            if (!subSkillMd) return null;

            const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${subSkillMd.path}`;
            let description: string | null = null;
            try {
              const contentRes = await fetch(rawUrl);
              if (contentRes.ok) {
                const content = await contentRes.text();
                const descMatch = content.match(/^description:\s*(.+)$/m);
                description = descMatch?.[1]?.trim() || null;
              }
            } catch { /* ignore */ }

            return {
              name: dir.name,
              installRef: `${repoPath}@${dir.name}`,
              skillMdUrl: `https://github.com/${repoPath}/blob/${branch}/${subSkillMd.path}`,
              description,
            };
          } catch { return null; }
        });

        const subResults = await Promise.all(subChecks);
        for (const r of subResults) {
          if (r) skills.push(r);
        }

        if (skills.length > 0) {
          return { found: true, repoPath, skills };
        }
      } catch { /* try next branch */ }
    }

    // Strategy 3: Check common skill directory patterns at repo root
    if (!subPath) {
      const commonPaths = ['.claude/skills', 'skills', '.agents/skills'];
      for (const branch of branches) {
        for (const basePath of commonPaths) {
          const apiUrl = `https://api.github.com/repos/${repoPath}/contents/${basePath}?ref=${branch}`;
          try {
            const res = await fetch(apiUrl, {
              headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'super-agent' },
            });
            if (!res.ok) continue;

            const entries = await res.json() as Array<{ name: string; type: string; path: string }>;
            if (!Array.isArray(entries)) continue;

            for (const dir of entries.filter(e => e.type === 'dir')) {
              const skillMdUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${dir.path}/SKILL.md`;
              try {
                const mdRes = await fetch(skillMdUrl);
                if (!mdRes.ok) continue;
                const content = await mdRes.text();
                const descMatch = content.match(/^description:\s*(.+)$/m);
                skills.push({
                  name: dir.name,
                  installRef: `${repoPath}@${dir.name}`,
                  skillMdUrl: `https://github.com/${repoPath}/blob/${branch}/${dir.path}/SKILL.md`,
                  description: descMatch?.[1]?.trim() || null,
                });
              } catch { /* skip */ }
            }

            if (skills.length > 0) {
              return { found: true, repoPath, skills };
            }
          } catch { /* try next */ }
        }
      }
    }

    return { found: false, repoPath, skills: [] };
  }

  /**
   * Process an uploaded zip file to find and install skills.
   *
   * 1. Save the zip to a temp directory
   * 2. Extract it using the system `unzip` command
   * 3. Recursively scan for SKILL.md files
   * 4. For each found skill, copy files and create DB records
   */
  async installFromZip(options: {
    organizationId: string;
    zipBuffer: Buffer;
    fileName: string;
    userId?: string;
  }): Promise<{
    skills: Array<{ skillId: string; name: string; displayName: string }>;
    errors: string[];
  }> {
    const { organizationId, zipBuffer, fileName, userId } = options;
    const tmpId = createHash('sha256').update(`${organizationId}:zip:${Date.now()}`).digest('hex').substring(0, 16);
    const tmpDir = resolve(process.cwd(), 'data', 'tmp', `zip-${tmpId}`);
    const extractDir = join(tmpDir, 'extracted');

    const installedSkills: Array<{ skillId: string; name: string; displayName: string }> = [];
    const errors: string[] = [];

    try {
      await mkdir(extractDir, { recursive: true });

      // Write zip to temp file
      const zipPath = join(tmpDir, fileName || 'upload.zip');
      await writeFile(zipPath, zipBuffer);

      // Extract using system unzip
      try {
        await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', extractDir], { timeout: 30_000 });
      } catch (err) {
        // Try tar for .tar.gz / .tgz files
        if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')) {
          await execFileAsync('tar', ['-xzf', zipPath, '-C', extractDir], { timeout: 30_000 });
        } else {
          throw new Error(`Failed to extract archive: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Recursively find all SKILL.md files
      const skillFiles = await this.findSkillMdFiles(extractDir);

      if (skillFiles.length === 0) {
        return { skills: [], errors: ['No SKILL.md files found in the uploaded archive.'] };
      }

      // Install each discovered skill
      for (const skillMdPath of skillFiles) {
        try {
          const skillDir = join(skillMdPath, '..');
          const skillContent = await readFile(skillMdPath, 'utf-8');

          // Derive skill name from parent directory
          const parentDirName = resolve(skillDir).split('/').pop() || 'skill';
          // If the parent is the extract root itself, use the zip file name
          const skillName = (resolve(skillDir) === resolve(extractDir))
            ? (fileName.replace(/\.(zip|tar\.gz|tgz)$/i, '') || 'skill')
            : parentDirName;

          const displayName = skillName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          // Extract description from frontmatter
          const descMatch = skillContent.match(/^description:\s*(.+)$/m);
          const description = descMatch?.[1]?.trim() || `Uploaded from ${fileName}`;

          const hashId = createHash('sha256')
            .update(`${organizationId}:zip-upload:${skillName}:${Date.now()}`)
            .digest('hex').substring(0, 16);

          // Copy skill files to permanent location
          const permDir = resolve(process.cwd(), 'data', 'skills', hashId);
          await mkdir(permDir, { recursive: true });
          await cp(skillDir, permDir, { recursive: true });

          // Write metadata
          await writeFile(join(permDir, 'metadata.json'), JSON.stringify({
            source: 'zip-upload',
            fileName,
            contentFileName: 'SKILL.md',
            installedAt: new Date().toISOString(),
          }, null, 2), 'utf-8');

          // Create or update DB record
          const existing = await skillService.findByName(organizationId, skillName);
          let skill;

          const metadata = {
            source: 'zip-upload',
            fileName,
            contentFileName: 'SKILL.md',
            localPath: permDir,
            installedAt: new Date().toISOString(),
            hash_id: hashId,
          };

          if (existing) {
            skill = await skillService.updateSkill(organizationId, existing.id, {
              display_name: displayName,
              description,
              tags: ['zip-upload'],
              metadata,
            });
            if (!skill) throw new Error(`Failed to update existing skill: ${skillName}`);
          } else {
            skill = await skillService.createSkill(organizationId, {
              name: skillName,
              display_name: displayName,
              description,
              version: '1.0.0',
              tags: ['zip-upload'],
              metadata,
            });
          }

          // Auto-publish to enterprise catalog
          try {
            const { enterpriseSkillRepository } = await import('../repositories/enterprise-skill.repository.js');
            const existingEntry = await enterpriseSkillRepository.findBySkillId(skill.id, organizationId);
            if (!existingEntry) {
              await enterpriseSkillRepository.publish(organizationId, {
                skillId: skill.id,
                publishedBy: userId || 'system',
                source: 'zip-upload',
                sourceRef: fileName,
              });
            }
          } catch (err) {
            console.warn(`Failed to auto-publish zip-uploaded skill:`, err);
          }

          installedSkills.push({ skillId: skill.id, name: skillName, displayName });
        } catch (err) {
          errors.push(`Failed to install skill from ${skillMdPath}: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    } finally {
      // Cleanup temp directory
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    return { skills: installedSkills, errors };
  }

  /**
   * Recursively find all SKILL.md files in a directory.
   */
  private async findSkillMdFiles(dir: string, maxDepth = 5, currentDepth = 0): Promise<string[]> {
    if (currentDepth > maxDepth) return [];

    const results: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.toUpperCase() === 'SKILL.MD' && !entry.isDirectory()) {
        results.push(join(dir, entry.name));
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subResults = await this.findSkillMdFiles(join(dir, entry.name), maxDepth, currentDepth + 1);
        results.push(...subResults);
      }
    }

    return results;
  }
}

export const skillMarketplaceService = new SkillMarketplaceService();
