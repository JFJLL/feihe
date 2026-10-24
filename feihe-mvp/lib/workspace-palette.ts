/**
 * Stable workspace palette.
 *
 * Colors are assigned by stable keys (brand id, series key, category name),
 * never by sort index, so a brand keeps its color across months, filters and
 * sort orders. The overview palette stays untouched; these tones serve the
 * non-overview workspaces and visually match the reference dashboard.
 */

const DATA_TONES = {
  blue: '#0090ff',
  teal: '#12a594',
  green: '#29a383',
  purple: '#5b5bd6',
  amber: '#ffc53d',
  coral: '#e5484d',
  slate: '#8b8d98',
} as const;

export type DataTone = keyof typeof DATA_TONES;

export const DATA_TONE_LIST: DataTone[] = ['blue', 'teal', 'green', 'purple', 'amber', 'coral', 'slate'];

/** Deterministic hash so the same key always maps to the same tone. */
function hashKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Assign colors from an explicit list of stable keys.
 * Colors are deterministically mapped by key identity so that reordering
 * or filtering the keys never changes any individual key's color.
 */
export function paletteForKeys(keys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of keys) {
    map[key] = paletteColor(key);
  }
  return map;
}

/** Fallback for open-ended sets: deterministic per key, independent of order. */
export function paletteColor(key: string): string {
  return DATA_TONES[DATA_TONE_LIST[hashKey(key) % DATA_TONE_LIST.length]];
}

export const WORKSPACE_TONES = DATA_TONES;
