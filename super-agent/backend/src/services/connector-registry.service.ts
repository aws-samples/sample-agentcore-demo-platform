/**
 * Connector Registry Service
 *
 * Loads connector packages from the filesystem at startup.
 * Each package is a self-contained plugin with manifest.json, setup-guide.md,
 * and tools.json. The platform renders everything from manifest data —
 * no code changes needed to add a new connector.
 *
 * Package location: backend/connector-packages/{connector-id}/manifest.json
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Types (derived from manifest.json schema)
// ---------------------------------------------------------------------------

export interface ConnectorManifest {
  id: string;
  version: string;
  name: string;
  icon: string;
  category: 'saas' | 'database' | 'aws_service' | 'internal_api';
  description: { en: string; cn: string };
  auth: {
    type: string;
    oauth?: {
      provider: string;
      scopes: string[];
      authorize_url: string;
      token_url: string;
      extra_params?: Record<string, string>;
    };
    credential_fields: Array<{
      key: string;
      label: { en: string; cn: string };
      type?: string;
      placeholder?: string;
      required?: boolean;
    }>;
  };
  config_fields: Array<{
    key: string;
    label: { en: string; cn: string };
    type?: string;
    placeholder?: string;
    required?: boolean;
  }>;
  setup_guide: string;
  tools_definition: string;
  lambda_handler: string;
}

export interface LoadedConnectorPackage {
  manifest: ConnectorManifest;
  setupGuide: string;       // Markdown content
  toolsDefinition: unknown; // Parsed tools.json
  packageDir: string;       // Absolute path to the package directory
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ConnectorRegistryService {
  private packages = new Map<string, LoadedConnectorPackage>();
  private loaded = false;

  /** Load all connector packages from disk. Called once at startup. */
  async loadAll(): Promise<void> {
    if (this.loaded) return;

    const packagesDir = join(process.cwd(), 'connector-packages');
    if (!existsSync(packagesDir)) {
      console.warn('[connector-registry] No connector-packages directory found');
      this.loaded = true;
      return;
    }

    const entries = await readdir(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

      const pkgDir = join(packagesDir, entry.name);
      const manifestPath = join(pkgDir, 'manifest.json');

      if (!existsSync(manifestPath)) {
        console.warn(`[connector-registry] Skipping ${entry.name}: no manifest.json`);
        continue;
      }

      try {
        const manifestRaw = await readFile(manifestPath, 'utf-8');
        const manifest: ConnectorManifest = JSON.parse(manifestRaw);

        // Load setup guide
        let setupGuide = '';
        const guidePath = join(pkgDir, manifest.setup_guide ?? 'setup-guide.md');
        if (existsSync(guidePath)) {
          setupGuide = await readFile(guidePath, 'utf-8');
        }

        // Load tools definition
        let toolsDefinition: unknown = [];
        const toolsPath = join(pkgDir, manifest.tools_definition ?? 'tools.json');
        if (existsSync(toolsPath)) {
          toolsDefinition = JSON.parse(await readFile(toolsPath, 'utf-8'));
        }

        this.packages.set(manifest.id, { manifest, setupGuide, toolsDefinition, packageDir: pkgDir });
        console.log(`[connector-registry] Loaded: ${manifest.id} (${manifest.name})`);
      } catch (err) {
        console.error(`[connector-registry] Failed to load ${entry.name}:`, err);
      }
    }

    console.log(`[connector-registry] ${this.packages.size} connector packages loaded`);
    this.loaded = true;
  }

  /** Get all loaded manifests (for the catalog API) */
  getAll(): ConnectorManifest[] {
    return Array.from(this.packages.values()).map(p => p.manifest);
  }

  /** Get a single package by ID */
  getById(id: string): LoadedConnectorPackage | undefined {
    return this.packages.get(id);
  }

  /** Get manifest only */
  getManifest(id: string): ConnectorManifest | undefined {
    return this.packages.get(id)?.manifest;
  }

  /** Get setup guide markdown */
  getSetupGuide(id: string): string | undefined {
    return this.packages.get(id)?.setupGuide;
  }

  /** Get tools definition */
  getToolsDefinition(id: string): unknown | undefined {
    return this.packages.get(id)?.toolsDefinition;
  }
}

export const connectorRegistryService = new ConnectorRegistryService();
