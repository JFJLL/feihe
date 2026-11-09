/**
 * Central Project Registry
 * Automatically scans and registers all projects located under projects/<projectId>/.
 * Eliminates manual whitelist arrays and hardcoded catalog objects.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ProjectManifest,
  ProjectSources,
  BoardPayload,
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.resolve(__dirname, '../../projects');

export interface RegisteredProject {
  id: string;
  manifest: ProjectManifest;
  dirPath: string;
  hasSources: boolean;
  hasTransform: boolean;
}

/**
 * In-memory cache of registered manifests.
 */
let manifestCache: Map<string, ProjectManifest> | null = null;

/**
 * Resolves the absolute directory path for projects.
 */
export function getProjectsDir(): string {
  return PROJECTS_DIR;
}

/**
 * Discovers all project folders containing a manifest.ts.
 */
export function discoverProjectIds(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifestPath = path.join(PROJECTS_DIR, entry.name, 'manifest.ts');
      if (fs.existsSync(manifestPath)) {
        ids.push(entry.name);
      }
    }
  }
  return ids;
}

/**
 * Synchronously loads a project manifest by reading or statically importing it.
 */
export function getProjectManifest(projectId: string): ProjectManifest | null {
  if (!projectId) return null;
  const all = getAllProjectManifests();
  return all[projectId] || null;
}

/**
 * Loads all project manifests across projects/<id>/manifest.ts.
 */
export function getAllProjectManifests(): Record<string, ProjectManifest> {
  if (manifestCache) {
    return Object.fromEntries(manifestCache.entries());
  }

  const result: Record<string, ProjectManifest> = {};
  const ids = discoverProjectIds();

  for (const id of ids) {
    const manifestJsonPath = path.join(PROJECTS_DIR, id, 'manifest.json');
    const manifestTsPath = path.join(PROJECTS_DIR, id, 'manifest.ts');
    let manifestData: Partial<ProjectManifest> | null = null;

    // 1. Prefer co-located manifest.json for 100% deterministic, zero-regex synchronous loading
    if (fs.existsSync(manifestJsonPath)) {
      try {
        manifestData = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
      } catch (err) {
        console.warn(`[registry] Error reading manifest.json for ${id}:`, err);
      }
    }

    // 2. Safe AST / evaluation fallback for manifest.ts if manifest.json is absent
    if (!manifestData && fs.existsSync(manifestTsPath)) {
      try {
        const tsContent = fs.readFileSync(manifestTsPath, 'utf8');
        const sanitized = tsContent
          .replace(/^import\s+[^;]+;?\s*$/gm, '')
          .replace(/:\s*ProjectManifest\b/g, '')
          .replace(/^export\s+const\s+manifest\s*=\s*/m, 'return ')
          .replace(/export\s+default\s+manifest;?/m, '');
        const fn = new Function(sanitized);
        manifestData = fn();
      } catch (err) {
        console.warn(`[registry] Error evaluating manifest.ts for ${id}:`, err);
      }
    }

    if (manifestData) {
      const defaultRenderer: 'universal' | 'legacy-campaign' | 'legacy-huang-tiane' =
        manifestData.rendererMode || 'universal';

      result[id] = {
        id,
        name: manifestData.name || id,
        brand: manifestData.brand || id,
        spu: manifestData.spu || '核心主推品',
        category: manifestData.category || '全域营销',
        color: manifestData.color || '#2563eb',
        themeId: manifestData.themeId,
        defaultReportPeriod: manifestData.defaultReportPeriod || '营销观测周期',
        description: manifestData.description || '',
        subtitle: manifestData.subtitle || '',
        templateId: manifestData.templateId || 'campaign_review',
        mode: manifestData.mode || '全域数据贯通 · 真实入账',
        rendererMode: manifestData.rendererMode || defaultRenderer,
        enabledTabs: manifestData.enabledTabs || [
          { key: 'overview', label: '数据总览', icon: '📊', desc: '全域核心指标' },
          { key: 'daily', label: '分日看板', icon: '📅', desc: '当日指标与明细' },
          { key: 'ads', label: '版位投放', icon: '🎯', desc: '广告与渠道效率' },
          { key: 'content', label: '内容执行', icon: '📝', desc: '达人与笔记详情' },
        ],
      };
    }
  }

  manifestCache = new Map(Object.entries(result));
  return result;
}

/**
 * Clears the manifest cache.
 */
export function clearRegistryCache(): void {
  manifestCache = null;
}

/**
 * Dynamically loads the project's transform module.
 */
export async function loadProjectTransform(projectId: string): Promise<((rawSources?: unknown) => Promise<BoardPayload> | BoardPayload) | null> {
  const transformPath = path.join(PROJECTS_DIR, projectId, 'transform.ts');
  if (!fs.existsSync(transformPath)) return null;
  try {
    const mod = await import(`../../projects/${projectId}/transform.ts`);
    return mod.transformProject || mod.default || null;
  } catch (err) {
    console.error(`[registry] Failed to import transform for ${projectId}:`, err);
    return null;
  }
}

/**
 * Dynamically loads the project's sources configuration.
 */
export async function loadProjectSources(projectId: string): Promise<ProjectSources | null> {
  const sourcesPath = path.join(PROJECTS_DIR, projectId, 'sources.ts');
  if (!fs.existsSync(sourcesPath)) return null;
  try {
    const mod = await import(`../../projects/${projectId}/sources.ts`);
    return mod.sources || mod.default || null;
  } catch (err) {
    console.error(`[registry] Failed to import sources for ${projectId}:`, err);
    return null;
  }
}

/**
 * High-level runner: executes project transformation and generates the BoardPayload.
 */
export async function buildProjectBoard(projectId: string, rawSources?: unknown): Promise<BoardPayload | null> {
  const transformFn = await loadProjectTransform(projectId);
  if (!transformFn) {
    throw new Error(`[registry] Project "${projectId}" has no valid transformProject export.`);
  }
  return await transformFn(rawSources);
}

/**
 * Checks whether a given project is registered under projects/.
 */
export function isProjectRegistered(projectId: unknown): boolean {
  if (typeof projectId !== 'string' || !projectId) return false;
  const all = getAllProjectManifests();
  return Boolean(all[projectId]);
}
