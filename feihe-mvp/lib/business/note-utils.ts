import type { Note } from '../types/project';

export function isOwnedNote(note: Partial<Note> | Record<string, unknown> | null | undefined): boolean {
  if (!note) return false;
  const st = String((note as { sourceType?: unknown }).sourceType || (note as { source_type?: unknown }).source_type || '');
  const coop = Number((note as { cooperation?: unknown }).cooperation || 0);
  return (
    st === 'owned' ||
    st === 'commercial' ||
    st === '自有发布' ||
    st === '商业笔记' ||
    st === '自有' ||
    coop === 1
  );
}

export function isCommercialNote(note: Partial<Note> | Record<string, unknown> | null | undefined): boolean {
  if (!note) return false;
  const st = String((note as { sourceType?: unknown }).sourceType || (note as { source_type?: unknown }).source_type || '');
  const coop = Number((note as { cooperation?: unknown }).cooperation || 0);
  return st === 'commercial' || st === '商业笔记' || coop === 1;
}

export function noteDirection(note: Partial<Note> | Record<string, unknown> | null | undefined): string {
  if (!note) return '待补充内容方向';
  const n = note as Record<string, unknown>;
  return String(n.category1 || n.category2 || n.brand || '待补充内容方向');
}
