import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const cli = process.env.FEIHE_LARK_CLI || 'lark-cli';

function letterToCol(letters) {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col;
}

function colToLetter(col) {
  let temp, letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter;
}

function parseAndValidateRange(range, sheet) {
  if (!range) return null;
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`读取范围格式无效: "${range}"`);

  const startColStr = match[1];
  const startRow = Number(match[2]);
  const endColStr = match[3];
  const endRow = Number(match[4]);

  const startCol = letterToCol(startColStr);
  const endCol = letterToCol(endColStr);

  if (startRow < 1 || endRow < 1 || startRow > endRow) {
    throw new Error(`读取范围行号无效或倒置: 行 ${startRow} 到 ${endRow}`);
  }
  if (startCol < 1 || endCol < 1 || startCol > endCol) {
    throw new Error(`读取范围列号倒置: 列 ${startColStr} 到 ${endColStr}`);
  }
  if (sheet.row_count && endRow > sheet.row_count) {
    throw new Error(`读取范围超出工作表总行数: 截止行 ${endRow} > 工作表行数 ${sheet.row_count}`);
  }
  if (sheet.column_count && endCol > sheet.column_count) {
    throw new Error(`读取范围超出工作表总列数: 截止列 ${endColStr}(${endCol}) > 工作表列数 ${sheet.column_count}`);
  }

  return { startColStr, startRow, endColStr, endRow, startCol, endCol };
}

async function call(args) {
  // Invoke the installed JS entry directly on Windows; no shell interpolation or .cmd quoting.
  const entry = process.env.FEIHE_LARK_CLI_JS || (process.platform === 'win32' ? path.join(process.env.APPDATA, 'npm/node_modules/@larksuite/cli/scripts/run.js') : null);
  const result = await exec(entry ? process.execPath : cli, [...(entry ? [entry] : []), ...args, '--as', 'user'], {
    cwd: os.tmpdir(),
    timeout: 120000,
    maxBuffer: 24 * 1024 * 1024,
    windowsHide: true,
  });
  const envelope = JSON.parse(result.stdout);
  if (!envelope.ok) throw new Error('飞书只读请求失败');
  return envelope.data;
}
async function tableRead(locator, sheetId, range, invoke) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const before = await invoke(['sheets', '+workbook-info', ...locator]);
    const sheet = before.sheets.find(s => s.sheet_id === sheetId);
    if (!sheet) throw new Error('工作表ID不属于当前已绑定来源');

    const totalRows = sheet.row_count || 0;
    const totalCols = sheet.column_count || 1;
    const endColLetter = colToLetter(totalCols);

    let startRow = 1, endRow = totalRows, startColStr = 'A', endColStr = endColLetter, startCol = 1, endCol = totalCols;
    if (range) {
      const parsed = parseAndValidateRange(range, sheet);
      startColStr = parsed.startColStr;
      startRow = parsed.startRow;
      endColStr = parsed.endColStr;
      endRow = parsed.endRow;
      startCol = parsed.startCol;
      endCol = parsed.endCol;
    }

    const requestedRows = totalRows > 0 ? (endRow - startRow + 1) : 0;
    const pageSize = 1000;
    const isLarge = totalRows > pageSize && requestedRows > pageSize;

    if (!isLarge) {
      const tempFilename = `vendor-${crypto.randomUUID()}.json`;
      const tempFile = path.join(os.tmpdir(), tempFilename);
      try {
        const receipt = await invoke(['sheets', '+table-get', ...locator, '--sheet-id', sheetId, '--no-header', ...(range ? ['--range', range] : []), '--output-path', './' + tempFilename]);
        if (!receipt.complete || receipt.has_more || receipt.truncated) throw new Error('飞书读取截断；保留上次成功数据');
        const result = JSON.parse(await fs.readFile(tempFile, 'utf8'));
        if (result.complete === false || result.has_more || result.truncated) throw new Error('飞书响应未完成');
        const after = await invoke(['sheets', '+workbook-info', ...locator]);
        const afterSheet = after.sheets?.find(s => s.sheet_id === sheetId);
        const revChanged = before.revision !== after.revision;
        const dimChanged = afterSheet && ((sheet.row_count && sheet.row_count !== afterSheet.row_count) || (sheet.column_count && sheet.column_count !== afterSheet.column_count));
        if (revChanged || dimChanged) {
          if (attempt < maxRetries) continue;
          throw new Error('来源在读取过程中发生变化（版本或行列数变动），已达最大重试次数');
        }
        const value = result.sheets[0];
        if (!value || result.sheets.length !== 1 || !Array.isArray(value.data) || value.has_more || value.truncated) throw new Error('表格响应不完整');
        const bounds = value.range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (bounds && value.data.length !== Number(bounds[4]) - Number(bounds[2]) + 1) throw new Error('实际源行范围不完整');
        const version = after.revision ? String(after.revision) : 'unversioned-sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex');
        return { rows: value.data, range: value.range, version, capturedAt: new Date().toISOString() };
      } finally {
        await fs.unlink(tempFile).catch(err => {
          if (err.code !== 'ENOENT') throw err;
        });
      }
    } else {
      const allRows = [];
      const expectedCols = endCol - startCol + 1;
      for (let r = startRow; r <= endRow; r += pageSize) {
        const chunkEnd = Math.min(r + pageSize - 1, endRow);
        const chunkRange = `${startColStr}${r}:${endColStr}${chunkEnd}`;
        const tempFilename = `vendor-paged-${crypto.randomUUID()}.json`;
        const tempFile = path.join(os.tmpdir(), tempFilename);
        try {
          const receipt = await invoke(['sheets', '+table-get', ...locator, '--sheet-id', sheetId, '--no-header', '--range', chunkRange, '--output-path', './' + tempFilename]);
          if (!receipt.complete || receipt.has_more || receipt.truncated) throw new Error('飞书读取截断；保留上次成功数据');
          const result = JSON.parse(await fs.readFile(tempFile, 'utf8'));
          if (result.complete === false || result.has_more || result.truncated) throw new Error('飞书响应未完成');
          if (!result.sheets || result.sheets.length !== 1) {
            throw new Error(`表格响应工作表数量异常: 收到 ${result.sheets?.length ?? 0}`);
          }
          const value = result.sheets[0];
          if (!value || !Array.isArray(value.data) || value.has_more || value.truncated) throw new Error('表格响应不完整');
          if (value.range !== chunkRange) {
            throw new Error(`表格分片范围不匹配: 预期 ${chunkRange}，收到 ${value.range}`);
          }
          const expectedCount = chunkEnd - r + 1;
          if (value.data.length !== expectedCount) {
            throw new Error(`实际源行范围不完整: 预期 ${expectedCount} 行，收到 ${value.data.length} 行`);
          }
          for (let idx = 0; idx < value.data.length; idx++) {
            const row = value.data[idx];
            if (!Array.isArray(row)) {
              throw new Error(`表格第 ${r + idx} 行数据结构无效: 预期数组`);
            }
            if (row.length !== expectedCols) {
              throw new Error(`表格第 ${r + idx} 行列数不匹配: 预期 ${expectedCols} 列，收到 ${row.length} 列`);
            }
          }
          allRows.push(...value.data);
        } finally {
          await fs.unlink(tempFile).catch(err => {
            if (err.code !== 'ENOENT') throw err;
          });
        }
      }

      const after = await invoke(['sheets', '+workbook-info', ...locator]);
      const afterSheet = after.sheets?.find(s => s.sheet_id === sheetId);
      const revChanged = before.revision !== after.revision;
      const dimChanged = afterSheet && ((sheet.row_count && sheet.row_count !== afterSheet.row_count) || (sheet.column_count && sheet.column_count !== afterSheet.column_count));
      if (revChanged || dimChanged) {
        if (attempt < maxRetries) continue;
        throw new Error('来源在读取过程中发生变化（版本或行列数变动），已达最大重试次数');
      }

      const effectiveRange = `${startColStr}${startRow}:${endColStr}${endRow}`;
      const version = after.revision ? String(after.revision) : 'unversioned-sha256:' + createHash('sha256').update(JSON.stringify(allRows)).digest('hex');
      return { rows: allRows, range: effectiveRange, version, capturedAt: new Date().toISOString() };
    }
  }
}
export async function readBusinessSource(spec, task, existingConfig, window = null, invoke = call) {
  const from = window?.window_from, to = window?.window_to;
  if (spec.type === 'feishu_table') {
    const raw = await tableRead(['--url', spec.sourceUrl], spec.sheetId, spec.range, invoke);
    // Undated cumulative tables cannot substantiate a requested daily backfill.
    if (from && (spec.role !== 'weekly' || !spec.periodFrom || !spec.periodTo || from < spec.periodFrom || to > spec.periodTo)) throw new Error('指定补跑日期不在该来源已配置的日粒度区间');
    return { bundle: { tables: [{ key: spec.sourceKey, role: spec.role, url: spec.sourceUrl, sheetId: spec.sheetId, reportDay: spec.reportDay, periodFrom: spec.periodFrom, periodTo: spec.periodTo, scopeLabel: spec.scopeLabel, complete: true, ...raw }] }, rows: raw.rows.length };
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
