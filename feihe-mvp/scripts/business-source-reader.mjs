import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const cli = process.env.FEIHE_LARK_CLI || 'lark-cli';
async function call(args) {
  // Invoke the installed JS entry directly on Windows; no shell interpolation or .cmd quoting.
  const entry = process.env.FEIHE_LARK_CLI_JS || (process.platform === 'win32' ? path.join(process.env.APPDATA, 'npm/node_modules/@larksuite/cli/scripts/run.js') : null);
  const result = await exec(entry ? process.execPath : cli, [...(entry ? [entry] : []), ...args, '--as', 'user'], { timeout: 120000, maxBuffer: 24 * 1024 * 1024, windowsHide: true });
  const envelope = JSON.parse(result.stdout);
  if (!envelope.ok) throw new Error('飞书只读请求失败');
  return envelope.data;
}
async function tableRead(locator, sheetId, range, invoke) {
  const before = await invoke(['sheets', '+workbook-info', ...locator]);
  const sheet = before.sheets.find(s => s.sheet_id === sheetId);
  if (!sheet) throw new Error('工作表ID不属于当前已绑定来源');
  const file = '.verification/vendor-' + crypto.randomUUID() + '.json';
  await fs.mkdir('.verification', { recursive: true });
  try {
  const receipt = await invoke(['sheets', '+table-get', ...locator, '--sheet-id', sheetId, '--no-header', ...(range ? ['--range', range] : []), '--output-path', './' + file]);
  if (!receipt.complete || receipt.has_more || receipt.truncated) throw new Error('飞书读取截断；保留上次成功数据');
  const result = JSON.parse(await fs.readFile(file, 'utf8'));
  if (result.complete === false || result.has_more || result.truncated) throw new Error('飞书响应未完成');
  const after = await invoke(['sheets', '+workbook-info', ...locator]);
  if (before.revision !== after.revision) throw new Error('来源在读取过程中变化，将自动重试');
  const value = result.sheets[0];
  if (!value || result.sheets.length !== 1 || !Array.isArray(value.data) || value.has_more || value.truncated) throw new Error('表格响应不完整');
  const bounds = value.range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (bounds && value.data.length !== Number(bounds[4]) - Number(bounds[2]) + 1) throw new Error('实际源行范围不完整');
  // Keep the file only for this read. Captures persist in the app's isolated database.
  const version = after.revision ? String(after.revision) : 'unversioned-sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return { rows: value.data, range: value.range, version, capturedAt: new Date().toISOString() };
  } finally { await fs.unlink(path.resolve(file)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
export async function readBusinessSource(spec, task, existingConfig, window = null, invoke = call) {
  const from = window?.window_from, to = window?.window_to;
  if (spec.type === 'feishu_table') {
    const raw = await tableRead(['--url', spec.sourceUrl], spec.sheetId, spec.range, invoke);
    // Undated cumulative tables cannot substantiate a requested daily backfill.
    if (from && (spec.role !== 'weekly' || !spec.periodFrom || !spec.periodTo || from < spec.periodFrom || to > spec.periodTo)) throw new Error('指定补跑日期不在该来源已配置的日粒度区间');
    return { bundle: { tables: [{ key: spec.sourceKey, role: spec.role, url: spec.sourceUrl, sheetId: spec.sheetId, reportDay: spec.reportDay, periodFrom: spec.periodFrom, periodTo: spec.periodTo, complete: true, ...raw }] }, rows: raw.rows.length };
  }
  if (spec.type !== 'feishu_document') throw new Error('该任务需指定平台账号桥接');
  const fetched = await invoke(['docs', '+fetch', '--doc', spec.sourceUrl, '--detail', 'with-ids']);
  const doc = fetched.document;
  if (!doc?.content || !doc.revision_id) throw new Error('日报文档响应不完整');
  const tables = [], generatedBindings = [];
  // Only sheets embedded in this explicitly approved report are followed. Base resources are skipped.
  const sections = doc.content.split(/(?=<h1\b)/).flatMap(section => {
    const date = section.match(/^<h1[^>]*>(?:\s*<[^>]+>)*\s*(\d+)月(\d+)日/);
    return date ? [{ section, reportDay: `${spec.year}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}` }] : [];
  }).sort((a,b) => b.reportDay.localeCompare(a.reportDay));
  const selected = from ? sections.filter(s => s.reportDay >= from && s.reportDay <= to) : sections.slice(0, 7);
  if (from && !selected.length) throw new Error('指定区间内未找到任何有效日报');
  if (!selected.length) throw new Error('日报未找到有效业务日期');
  for (const { section, reportDay } of selected) {
    for (const match of section.matchAll(/<sheet\b[^>]*>/g)) {
      const token = match[0].match(/token="([a-zA-Z0-9]+)"/)?.[1], sheetId = match[0].match(/sheet-id="([a-zA-Z0-9]+)"/)?.[1];
      if (!token || !sheetId || /MovYbZbxyaSNdssY1AacZ6WPnDe|LyHGbW1xUa03gZsdxSOcrJasnjg/.test(token)) continue;
      const raw = await tableRead(['--spreadsheet-token', token], sheetId, undefined, invoke);
      const header = raw.rows[0] || [];
      const role = header[0] === '时间节点' && String(header[1]).includes('FS') ? 'budget_plan' : header[0] === '达人层级' ? 'creator_snapshot' : header[0] === '项目归属' && header[1] === '维度' ? 'platform_snapshot' : null;
      if (!role) continue;
      const key = role + '-' + reportDay;
      const old = existingConfig.bindings.find(b => b.key === key);
      if (old && (old.role !== role || old.url !== spec.sourceUrl)) throw new Error('日报嵌套来源与现有绑定冲突，需管理员核对');
      tables.push({ key, role, url: spec.sourceUrl, reportDay, complete: true, sheetId, ...raw });
      if (!old) generatedBindings.push({ key, role, url: spec.sourceUrl });
    }
  }
  const checked = await invoke(['docs', '+fetch', '--doc', spec.sourceUrl, '--scope', 'outline', '--detail', 'with-ids']);
  if (checked.document.revision_id !== doc.revision_id) throw new Error('日报在读取期间变化，将自动重试');
  return { bundle: { tables, document: { key: spec.sourceKey, url: spec.sourceUrl, version: String(doc.revision_id), capturedAt: new Date().toISOString(), year: spec.year, content: doc.content } }, rows: tables.reduce((n, s) => n + s.rows.length, 0), generatedBindings, projectId: task.project_id };
}
