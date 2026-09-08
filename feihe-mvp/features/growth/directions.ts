export const REVIEW_DIRECTION = '分类待核对';

export function validDirection(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 40 || /https?:\/\/|www\.|[\r\n\t\uFFFD]/i.test(text) || /^(?:—|-|#N\/A|null|undefined)$/i.test(text)) return null;
  return text;
}

/** Prefer the more specific valid category; never use a URL as a topic. */
export function sampleDirection(note: { category1?: unknown; category2?: unknown }): string {
  return validDirection(note.category2) || validDirection(note.category1) || REVIEW_DIRECTION;
}
