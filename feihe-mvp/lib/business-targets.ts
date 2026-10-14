import type { Acceptance } from './types/project';
export function defaultAcceptance(projectId: string): Acceptance {
  return { reportCount: projectId === 'qicui' ? 200 : 0, baseCount: projectId === 'qicui' ? 30 : 0, brandTopRate: projectId === 'qicui' ? 0.4 : 0,
    freshnessHours: 24, supplierSimilarity: 0.58, targetsConfirmed: projectId === 'qicui' };
}
// Existing explicitly stored legacy targets retain their meaning. A new project's
// zero/unconfirmed values never qualify records automatically.
export function acceptanceTargetsConfirmed(acceptance: Acceptance) {
  return acceptance.targetsConfirmed !== false && acceptance.reportCount > 0 && acceptance.baseCount > 0;
}
