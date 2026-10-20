import fs from 'fs';
import path from 'path';
import assert from 'assert';

const cwd = process.cwd();
const chartsFilePath = path.join(cwd, 'features', 'campaign', 'CampaignCharts.tsx');
const cssFilePath = path.join(cwd, 'features', 'campaign', 'campaign-analytics.css');

console.log('Testing CampaignCharts & campaign-analytics.css exports and contracts...');

// 1. Check existence
assert(fs.existsSync(chartsFilePath), 'CampaignCharts.tsx must exist');
assert(fs.existsSync(cssFilePath), 'campaign-analytics.css must exist');

const chartsCode = fs.readFileSync(chartsFilePath, 'utf8');
const cssCode = fs.readFileSync(cssFilePath, 'utf8');

// 2. Verify all exported types
assert(chartsCode.includes('export type ChartDatum'), 'Must export type ChartDatum');
assert(chartsCode.includes('export type ComparisonDatum'), 'Must export type ComparisonDatum');

// 3. Verify all exported components
const expectedComponents = [
  'export function ChartPanel',
  'export function HorizontalBarChart',
  'export function DonutChart',
  'export function BudgetComparisonChart',
  'export function TargetBulletChart',
  'export function ScatterChart',
  'export function MetricStrip',
];

for (const comp of expectedComponents) {
  assert(chartsCode.includes(comp), `Must export component: ${comp}`);
}

// 4. Verify CSS .ca- scope classes required by contract
const requiredCssClasses = [
  '.ca-page',
  '.ca-header',
  '.ca-toolbar',
  '.ca-grid',
  '.ca-grid-wide',
  '.ca-panel',
  '.ca-tabs',
  '.ca-table-wrap',
  '.ca-note',
  '.ca-empty',
  '.ca-insight',
];

for (const cls of requiredCssClasses) {
  assert(cssCode.includes(cls), `CSS must include required class: ${cls}`);
}

// 5. Verify palette colors in CSS and TSX
const requiredPaletteColors = [
  '#2c7168', // deep teal
  '#8273a3', // purple
  '#b88a45', // gold
  '#bd7964', // terracotta
];

for (const col of requiredPaletteColors) {
  assert(chartsCode.includes(col), `TSX palette must include ${col}`);
  assert(cssCode.includes(col), `CSS palette must include ${col}`);
}

// 6. Verify responsiveness and no-clip logic
assert(cssCode.includes('@media (max-width: 980px)') || cssCode.includes('@media (max-width: 640px)'), 'CSS must include responsive breakpoints');
assert(chartsCode.includes('超支'), 'Must support over-budget visualization without clipping');
assert(chartsCode.includes('100% 目标') || chartsCode.includes('100%'), 'Must display clear 100% target benchmark');

console.log('✓ All contract and code checks passed successfully!');
