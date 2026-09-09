import type { Note } from '../../lib/types/project';

const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function scenePerformance(notes: Note[]) {
  const groups = new Map<string, { scene: string; level: string; notes: Note[] }>();
  for (const note of notes) {
    const scene = note.category1 || '未标注';
    const level = note.creatorLevel || '未标注';
    const key = JSON.stringify([scene, level]);
    const group = groups.get(key) || { scene, level, notes: [] };
    group.notes.push(note);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const interactions = group.notes.filter(n => valid(n.interactionCount));
    const costs = group.notes.filter(n => valid(n.notePrice) && valid(n.interactionCount));
    const denominator = costs.reduce((sum, n) => sum + n.interactionCount!, 0);
    return { scene: group.scene, level: group.level, count: group.notes.length,
      samples: interactions.length, costSamples: costs.length,
      avg: interactions.length ? interactions.reduce((sum, n) => sum + n.interactionCount!, 0) / interactions.length : null,
      cpe: denominator > 0 ? costs.reduce((sum, n) => sum + n.notePrice!, 0) / denominator : null };
  }).sort((a, b) => b.count - a.count || a.scene.localeCompare(b.scene));
}
