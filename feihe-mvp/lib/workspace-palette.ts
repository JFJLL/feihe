/**
 * Stable workspace palette.
 *
 * Colors are assigned by stable keys (brand id, series key, category name),
 * never by sort index, so a brand keeps its color across months, filters and
 * sort orders. The overview palette stays untouched; these tones serve the
 * non-overview workspaces and visually match the reference dashboard.
 */

const DATA_TONES = {
  blue: '#1e6091',
  teal: '#0f807a',
  green: '#3f815e',
  purple: '#7864a5',
  amber: '#a66f22',
  coral: '#b85c55',
  slate: '#64748b',
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
 * Assign colors from an explicit list of stable keys. Position in the list,
 * not row order, decides the tone; a brand keeps its color everywhere.
 */
export function paletteForKeys(keys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  keys.forEach((key, index) => {
    map[key] = DATA_TONES[DATA_TONE_LIST[index % DATA_TONE_LIST.length]];
  });
  return map;
}

/** Fallback for open-ended sets: deterministic per key, independent of order. */
export function paletteColor(key: string): string {
  return DATA_TONES[DATA_TONE_LIST[hashKey(key) % DATA_TONE_LIST.length]];
}

export const WORKSPACE_TONES = DATA_TONES;
