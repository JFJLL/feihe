/**
 * SPU / Brand Auto-Adaptive Theme Engine
 * Inspired by Tencent Beacon Design System & 90-8-2 Color Discipline.
 *
 * Pure frontend-safe TypeScript module with 0 node:* dependencies.
 */

export interface BeaconChrome {
  canvas: string;   // 90% page background (extremely subtle hue tint or pure white)
  surface: string;  // Card background (pure white #ffffff)
  headBg: string;   // Table header / secondary container background
  text: string;     // Primary text (#18263c)
  muted: string;    // Secondary/caption text (#64748b)
  border: string;   // 1px hairline border
  accent: string;   // Calibrated SPU/brand accent color (< 5% visual footprint)
}

export interface BeaconSemanticColors {
  positive: string; // Positive/growth/passed (#0f766e)
  negative: string; // Negative/decline/error (#b91c1c)
  warning: string;  // Warning/risk/overbudget (#b45309)
  neutral: string;  // Neutral (#64748b)
}

export interface BeaconTheme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  chrome: BeaconChrome;
  chartPalette: string[];
  semanticColors: BeaconSemanticColors;
  cssVariables: Record<string, string>;
}

export const semanticColors: BeaconSemanticColors = {
  positive: '#0f766e',
  negative: '#b91c1c',
  warning: '#b45309',
  neutral: '#64748b',
};

/**
 * Converts a hex color (#RRGGBB or #RGB) to HSL components (H: 0-360, S: 0-100, L: 0-100).
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { h: 215, s: 72, l: 40 }; // Safe fallback
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL components to Hex string.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const normH = ((h % 360) + 360) % 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normL = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * normL - 1)) * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normL - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (normH < 60) {
    r = c; g = x; b = 0;
  } else if (normH < 120) {
    r = x; g = c; b = 0;
  } else if (normH < 180) {
    r = 0; g = c; b = x;
  } else if (normH < 240) {
    r = 0; g = x; b = c;
  } else if (normH < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (val: number): string => {
    const hex = Math.round((val + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Built-in curated presets from Tencent Beacon (official component-library)
 */
export const presetThemes: Record<string, Omit<BeaconTheme, 'cssVariables'>> = {
  'beacon-blue': {
    id: 'beacon-blue',
    name: '灯塔蓝 (Beacon Blue)',
    mode: 'light',
    chrome: {
      canvas: '#f8fafc',
      surface: '#ffffff',
      headBg: '#f1f5f9',
      text: '#18263c',
      muted: '#64748b',
      border: '#e2e8f0',
      accent: '#2563eb',
    },
    chartPalette: ['#2563eb', '#d97706', '#0d9488', '#7c3aed', '#ec4899', '#64748b'],
    semanticColors,
  },
  'amber-dusk': {
    id: 'amber-dusk',
    name: '琥珀日落 (Amber Dusk)',
    mode: 'light',
    chrome: {
      canvas: '#fdfbf7',
      surface: '#ffffff',
      headBg: '#f8f4eb',
      text: '#18263c',
      muted: '#64748b',
      border: '#ece5d8',
      accent: '#d97706',
    },
    chartPalette: ['#d97706', '#0f5f78', '#b45309', '#d946ef', '#0284c7', '#64748b'],
    semanticColors,
  },
  'store-red': {
    id: 'store-red',
    name: '红线简报 (Store Red)',
    mode: 'light',
    chrome: {
      canvas: '#faf7f7',
      surface: '#ffffff',
      headBg: '#f5eded',
      text: '#18263c',
      muted: '#64748b',
      border: '#e8dbdb',
      accent: '#b8322f',
    },
    chartPalette: ['#b8322f', '#0f5f78', '#ea580c', '#4f46e5', '#059669', '#64748b'],
    semanticColors,
  },
  'teal-mist': {
    id: 'teal-mist',
    name: '深海青雾 (Teal Mist)',
    mode: 'light',
    chrome: {
      canvas: '#f6f9f8',
      surface: '#ffffff',
      headBg: '#edf3f1',
      text: '#18263c',
      muted: '#64748b',
      border: '#dbe7e4',
      accent: '#0f5e52',
    },
    chartPalette: ['#0f5e52', '#d97706', '#0284c7', '#7c3aed', '#059669', '#64748b'],
    semanticColors,
  },
  'executive': {
    id: 'executive',
    name: '高端商务 (Executive)',
    mode: 'light',
    chrome: {
      canvas: '#fafaf8',
      surface: '#ffffff',
      headBg: '#f5f3ef',
      text: '#18263c',
      muted: '#64748b',
      border: '#e8e4df',
      accent: '#b8860b',
    },
    chartPalette: ['#b8860b', '#1d4ed8', '#475569', '#059669', '#b91c1c', '#64748b'],
    semanticColors,
  },
  'coral-cream': {
    id: 'coral-cream',
    name: '珊瑚奶油 (Coral Cream)',
    mode: 'light',
    chrome: {
      canvas: '#fdf7f8',
      surface: '#ffffff',
      headBg: '#faecef',
      text: '#18263c',
      muted: '#64748b',
      border: '#f2dadf',
      accent: '#e11d48',
    },
    chartPalette: ['#e11d48', '#0284c7', '#ea580c', '#8b5cf6', '#10b981', '#64748b'],
    semanticColors,
  },
  'sage-greige': {
    id: 'sage-greige',
    name: '鼠尾草 (Sage Greige)',
    mode: 'light',
    chrome: {
      canvas: '#f8f9f6',
      surface: '#ffffff',
      headBg: '#eff2eb',
      text: '#18263c',
      muted: '#64748b',
      border: '#dee3d7',
      accent: '#4d7c0f',
    },
    chartPalette: ['#4d7c0f', '#c2410c', '#0284c7', '#7c3aed', '#b45309', '#64748b'],
    semanticColors,
  },
};

/**
 * Builds CSS Variables object from chrome, palette, and semantics.
 */
function buildCssVariables(chrome: BeaconChrome, chartPalette: string[]): Record<string, string> {
  const vars: Record<string, string> = {
    '--dtc-theme-canvas': chrome.canvas,
    '--dtc-theme-surface': chrome.surface,
    '--dtc-theme-text': chrome.text,
    '--dtc-theme-muted': chrome.muted,
    '--dtc-theme-border': chrome.border,
    '--dtc-theme-accent': chrome.accent,
    '--dtc-theme-head': chrome.headBg,
    '--dtc-theme-head-bg': chrome.headBg,
    '--dtc-radius': '8px',
    '--dtc-font': "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    '--dtc-semantic-positive': semanticColors.positive,
    '--dtc-semantic-negative': semanticColors.negative,
    '--dtc-semantic-warning': semanticColors.warning,
    '--dtc-semantic-neutral': semanticColors.neutral,
  };

  chartPalette.forEach((col, idx) => {
    vars[`--dtc-chart-color-${idx}`] = col;
  });

  return vars;
}

/**
 * Derives a full BeaconTheme from a brand hex color and/or preset ID.
 *
 * Implements:
 * 1. HSL anti-glare guardrails: clamps saturation (<=78%) and lightness (32%-46%).
 * 2. 90-8-2 color discipline: 90% canvas subtle tint, 8% surface/headers, 2% accent line.
 * 3. Dual-axis harmonic chart palette with high-contrast complementary secondary series.
 * 4. Physical isolation of semantic colors.
 */
export function deriveThemeFromBrandColor(brandHex?: string, presetId?: string): BeaconTheme {
  if (presetId && presetThemes[presetId]) {
    const base = presetThemes[presetId];
    if (!brandHex) {
      return {
        ...base,
        cssVariables: buildCssVariables(base.chrome, base.chartPalette),
      };
    }
  }

  const raw = brandHex || '#0f5e52';
  const { h, s, l } = hexToHsl(raw);

  // 1. HSL Guardrail: clamp saturation & lightness for high readability and premium tone
  const clampedS = s > 78 ? 72 : s < 20 ? 25 : s;
  const clampedL = l > 55 ? 44 : l < 22 ? 34 : Math.min(46, Math.max(32, l));
  const accent = hslToHex(h, clampedS, clampedL);

  // 2. 90-8-2 Chrome generation
  const canvas = hslToHex(h, 12, 97.5);
  const surface = '#ffffff';
  const headBg = hslToHex(h, 14, 95.5);
  const text = '#18263c';
  const muted = '#64748b';
  const border = hslToHex(h, 16, 89);

  const chrome: BeaconChrome = {
    canvas,
    surface,
    headBg,
    text,
    muted,
    border,
    accent,
  };

  // 3. 6-color Harmonic Chart Palette
  // chartPalette[0]: primary accent
  // chartPalette[1]: secondary dual-axis curve (contrast +165° warm/cold complement)
  let secondaryColor: string;
  const isCool = (h >= 75 && h <= 255);
  if (isCool) {
    // Primary is cool (green/cyan/blue), pick high-contrast warm amber/terracotta
    secondaryColor = '#d97706'; // Amber orange
  } else {
    // Primary is warm (red/orange/gold), pick deep ocean teal / indigo
    secondaryColor = '#0f5f78'; // Ocean cyan
  }

  // chartPalette[2..4]: triadic & analogous gradient series
  const color2 = hslToHex((h + 45) % 360, Math.min(65, Math.max(45, Math.round(clampedS * 0.8))), Math.min(55, Math.max(40, Math.round(clampedL * 1.08))));
  const color3 = hslToHex((h + 90) % 360, Math.min(65, Math.max(45, Math.round(clampedS * 0.75))), Math.min(52, Math.max(38, Math.round(clampedL * 0.95))));
  const color4 = hslToHex((h + 140) % 360, Math.min(65, Math.max(45, Math.round(clampedS * 0.7))), Math.min(56, Math.max(42, Math.round(clampedL * 1.05))));
  const color5 = '#64748b'; // Restrained slate gray for long-tail categories

  const chartPalette = [accent, secondaryColor, color2, color3, color4, color5];

  return {
    id: `custom-${accent.replace('#', '')}`,
    name: `Custom (${accent})`,
    mode: 'light',
    chrome,
    chartPalette,
    semanticColors,
    cssVariables: buildCssVariables(chrome, chartPalette),
  };
}
