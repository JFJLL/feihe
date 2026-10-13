import { db } from './db';
import { getProjectDatasets } from './datasets';
import { validateCardConfig } from './metrics/config';

export async function projectReadiness(projectId: string, savedSteps: string[] = []) {
  const d1 = db();
  const [project, sources, datasets, cards, members] = await Promise.all([
    d1.prepare('SELECT template_id FROM projects WHERE id=?').bind(projectId).first<{ template_id: string }>(),
    d1.prepare('SELECT last_synced_at, last_row_count, last_error FROM data_sources WHERE project_id=?').bind(projectId).all<{ last_synced_at: string; last_row_count: number; last_error: string }>(),
    getProjectDatasets(projectId),
    d1.prepare('SELECT title, type, config_json FROM dashboard_cards WHERE project_id=?').bind(projectId).all<{ title: string; type: string; config_json: string }>(),
    d1.prepare('SELECT COUNT(*) AS count FROM project_members WHERE project_id=?').bind(projectId).first<{ count: number }>(),
  ]);
  const hasData = datasets.some(d => d.rowCount > 0) || (sources.results || []).some(s => s.last_synced_at && s.last_row_count > 0 && !s.last_error);
  const configuredCards = cards.results || [];
  const metrics = configuredCards.length > 0 && (project?.template_id !== 'general_workbench' || configuredCards.every(c => {
    try { return validateCardConfig({ ...JSON.parse(c.config_json), title: c.title, type: c.type, datasetId: JSON.parse(c.config_json).datasetId || datasets[0]?.id }, datasets, true).length === 0; } catch { return false; }
  }));
  const teamDone = (members?.count || 0) > 1;
  const teamSkipped = (members?.count || 0) === 1 && savedSteps.includes('skip:members');
  const completed = [
    ...(project ? ['template'] : []),
    ...((sources.results || []).length || datasets.length ? ['source'] : []),
    ...(hasData ? ['first_sync'] : []),
    ...(hasData && metrics ? ['metrics'] : []),
    ...(teamDone ? ['members'] : []),
  ];
  const blocked = ['template', 'source', 'first_sync', 'metrics'].filter(step => !completed.includes(step));
  if (!teamDone && !teamSkipped) blocked.push('members');
  return { completedSteps: [...completed, ...(teamSkipped ? ['skip:members'] : [])], blockedSteps: blocked, memberCount: members?.count || 0, ready: blocked.length === 0 };
}
