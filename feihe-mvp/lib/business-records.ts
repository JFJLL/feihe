import { db } from './db';
import type { Dataset } from './datasets';
import { DefinitionError } from './metrics/definitions';
import type { BusinessDomain, FieldRoles } from './metrics/recommendations';

const text = (value: unknown) => value === null || value === undefined ? '' : String(value).trim();
export function safeRecordLink(value: unknown): string | undefined {
  const valueText = text(value); if (!valueText) return undefined;
  try { const url = new URL(valueText); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
// Validate the complete imported snapshot, not the inspect sample or a current page.
// Domain records are typed views over the source snapshot, never a second editable copy.
export async function validateBusinessRecords(dataset: Dataset, domain: BusinessDomain, roles: FieldRoles) {
  if (domain === 'ad') return;
  const stored = await db().prepare('SELECT data_json FROM dataset_rows WHERE dataset_id=? ORDER BY rowid ASC').bind(dataset.id).all<{ data_json: string }>();
  const ids = new Set<string>(), idField = domain === 'content' ? roles.contentId || roles.link : roles.commentId;
  for (const [index, storedRow] of stored.results.entries()) {
    const row = JSON.parse(storedRow.data_json) as Record<string, unknown>;
    if (idField) {
      const id = text(row[idField]);
      if (!id) throw new DefinitionError('第' + (index + 1) + '条：业务记录编号/链接不能为空，请在原表补齐或重新对应字段');
      if (ids.has(id)) throw new DefinitionError('第' + (index + 1) + '条：业务记录编号/链接重复，请在原表修正');
      ids.add(id);
    }
    if (domain === 'comment' && (!roles.commentText || !text(row[roles.commentText]))) throw new DefinitionError('第' + (index + 1) + '条：评论内容不能为空，请在原表修正');
    if (roles.link && text(row[roles.link]) && !safeRecordLink(row[roles.link])) throw new DefinitionError('第' + (index + 1) + '条：内容链接必须是有效的http或https地址');
  }
}
export type BusinessRecord = { recordId: string; identity: 'source_id' | 'source_link' | 'row_position'; date?: string; title?: string; author?: string; link?: string; channel?: string;
  reads?: unknown; interactions?: unknown; spend?: unknown; commentText?: string; sentiment?: string; treatmentStatus?: string };
export function businessRecords(rows: Record<string, unknown>[], domain: 'content' | 'comment', roles: FieldRoles, offset: number): BusinessRecord[] {
  return rows.map((row, index) => {
    const value = (role: keyof FieldRoles) => roles[role] ? row[roles[role]!] : undefined;
    const idRole = domain === 'content' ? 'contentId' : 'commentId';
    return { recordId: text(value(idRole)) || (domain === 'content' ? text(value('link')) : '') || String(offset + index + 1),
      identity: value(idRole) !== undefined ? 'source_id' : domain === 'content' && roles.link ? 'source_link' : 'row_position',
      date: text(value('date')), title: text(value('title')), author: text(value('author')), channel: text(value('channel')), link: safeRecordLink(value('link')),
      reads: value('reads'), interactions: value('interactions'), spend: value('spend'), commentText: text(value('commentText')), sentiment: text(value('sentiment')), treatmentStatus: text(value('treatmentStatus')) };
  });
}
