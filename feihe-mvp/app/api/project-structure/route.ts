import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { getProjectDatasets } from '@/lib/datasets';
import { loadStructureBlueprint, storedStructure, initialStructureBindings, planStructure, structurePreviews, applyStructure, type StructureChoices } from '@/lib/project-structure';
import { DefinitionError } from '@/lib/metrics/definitions';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  try {
    if (url.searchParams.get('mode') === 'source') return Response.json({ ok: true, blueprint: await loadStructureBlueprint(access.context!) }, { headers: { 'Cache-Control': 'no-store' } });
    const stored = await storedStructure(access.context!.projectId), datasets = await getProjectDatasets(access.context!.projectId);
    if (!stored) return Response.json({ ok: true, blueprint: null, datasets });
    if (url.searchParams.get('mode') === 'summary') return Response.json({ ok: true, blueprint: stored.blueprint }, { headers: { 'Cache-Control': 'no-store' } });
    const choices: StructureChoices = url.searchParams.has('choices') ? JSON.parse(url.searchParams.get('choices')!) : { bindings: initialStructureBindings(stored.blueprint, datasets, url.searchParams.get('datasetId') || '') };
    const plan = planStructure(stored.blueprint, datasets, choices);
    const previews = await structurePreviews(access.context!.projectId, plan, datasets);
    return Response.json({ ok: true, blueprint: stored.blueprint, datasets, ...plan, errors: [...new Set([...plan.errors, ...previews.filter(card => card.error).map(card => card.title + '：' + card.error)])], previews }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '读取项目结构失败', error instanceof DefinitionError ? error.status : 400); }
}
export async function POST(request: Request) {
  let body: StructureChoices & { projectId?: string; revision?: string };
  try { body = await request.json(); } catch { return jsonError('无效的结构确认'); }
  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  try {
    const choices = { bindings: body.bindings, selectedCards: body.selectedCards, targets: body.targets, percentConfirmations: body.percentConfirmations };
    return Response.json({ ok: true, cards: await applyStructure(access.context!, body.revision || '', choices) });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '复用确认失败', error instanceof DefinitionError ? error.status : 500); }
}
