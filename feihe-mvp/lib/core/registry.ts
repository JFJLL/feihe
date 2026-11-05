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
    const manifestPath = path.join(PROJECTS_DIR, id, 'manifest.ts');
    if (fs.existsSync(manifestPath)) {
      try {
        // Parse basic manifest properties safely from file content for sync availability
        const content = fs.readFileSync(manifestPath, 'utf8');
        const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
        const brandMatch = content.match(/brand:\s*['"]([^'"]+)['"]/);
        const spuMatch = content.match(/spu:\s*['"]([^'"]+)['"]/);
        const catMatch = content.match(/category:\s*['"]([^'"]+)['"]/);
        const colorMatch = content.match(/color:\s*['"]([^'"]+)['"]/);
        const periodMatch = content.match(/defaultReportPeriod:\s*['"]([^'"]+)['"]/);
        const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
        const subMatch = content.match(/subtitle:\s*['"]([^'"]+)['"]/);
        const tplMatch = content.match(/templateId:\s*['"]([^'"]+)['"]/);
        const modeMatch = content.match(/mode:\s*['"]([^'"]+)['"]/);

        result[id] = {
          id,
          name: nameMatch ? nameMatch[1] : id,
          brand: brandMatch ? brandMatch[1] : id,
          spu: spuMatch ? spuMatch[1] : '核心主推品',
          category: catMatch ? catMatch[1] : '全域营销',
          color: colorMatch ? colorMatch[1] : '#2563eb',
          defaultReportPeriod: periodMatch ? periodMatch[1] : '营销观测周期',
          description: descMatch ? descMatch[1] : '',
          subtitle: subMatch ? subMatch[1] : '',
          templateId: tplMatch ? tplMatch[1] : 'campaign_review',
          mode: modeMatch ? modeMatch[1] : '全域数据贯通 · 真实入账',
        };
      } catch (err) {
        console.warn(`[registry] Error reading manifest for ${id}:`, err);
      }
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
