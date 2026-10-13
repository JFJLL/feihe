import { parseProjectDate } from './date-values';
import { parseNumericValue, percentagePointsToFraction, type PercentScale } from './numeric-values';

export interface FieldMappingRule {
  sourceField: string;
  targetField: string;
  type?: 'text' | 'number' | 'date' | 'boolean';
  numericUnit?: 'number' | 'percent';
  sourcePercentScale?: PercentScale;
  isKey?: boolean;
  isDate?: boolean;
  required?: boolean;
  dateFormat?: 'auto' | 'YYYY-MM-DD' | 'YYYY-MM' | 'ISO';
  nullPolicy?: 'null' | 'zero' | 'empty' | 'skip';
}
export interface MappingContext {
  projectId: string;
  documentToken: string;
  sheetId: string;
  fields: Array<{ key: string; type: string; id?: string }>;
}
export function mappingContextMatches(a: MappingContext | null | undefined, b: MappingContext) {
  return Boolean(a && a.projectId === b.projectId && a.documentToken === b.documentToken && a.sheetId === b.sheetId && JSON.stringify(a.fields) === JSON.stringify(b.fields));
}
export class FieldMappingError extends Error {
  constructor(public errors: string[]) { super(errors.join('；')); this.name = 'FieldMappingError'; }
}

export function transformMappedRows(rows: Array<Record<string, unknown>>, rules: FieldMappingRule[]) {
  const errors: string[] = [];
  if (!Array.isArray(rules) || rules.some(r => !r || typeof r.sourceField !== 'string' || typeof r.targetField !== 'string')) return { rows: [], errors: ['映射规则必须包含合法来源字段和目标字段名'] };
  const targets = new Set<string>(), sources = new Set<string>();
  for (const rule of rules) {
    if (!rule.sourceField || !rule.targetField.trim()) errors.push('来源字段和目标字段名不能为空');
    if (targets.has(rule.targetField.trim())) errors.push(`目标字段重名：${rule.targetField}`);
    if (sources.has(rule.sourceField)) errors.push(`来源字段重复映射：${rule.sourceField}`);
    targets.add(rule.targetField.trim()); sources.add(rule.sourceField);
    const type = rule.isDate ? 'date' : (rule.type || 'text');
    if (!['text', 'number', 'date', 'boolean'].includes(type)) errors.push('不支持的数据类型：' + type);
    if (rule.numericUnit && !['number', 'percent'].includes(rule.numericUnit)) errors.push('不支持的数值单位');
    if (rule.numericUnit === 'percent' && type !== 'number') errors.push('百分比字段必须为数值类型');
    if (rule.sourcePercentScale && !['fraction', 'percentage_points'].includes(rule.sourcePercentScale)) errors.push('不支持的来源百分比单位');
    if (rule.numericUnit === 'percent' && !rule.sourcePercentScale) errors.push(`字段 ${rule.targetField} 请确认来源数值的百分比单位`);
    if (rule.sourcePercentScale && rule.numericUnit !== 'percent') errors.push('来源百分比单位只适用于百分比字段');
    if (rule.dateFormat && !['auto', 'YYYY-MM-DD', 'YYYY-MM', 'ISO'].includes(rule.dateFormat)) errors.push('不支持的日期格式');
    if (rule.nullPolicy && !['null', 'zero', 'empty', 'skip'].includes(rule.nullPolicy)) errors.push('不支持的空值规则');
    if (rule.nullPolicy === 'skip') errors.push('暂不支持跳过数据行，请选择保留空值');
    if (rule.nullPolicy === 'zero' && type !== 'number') errors.push(`字段 ${rule.targetField} 仅数值类型可补零`);
    if (rule.nullPolicy === 'empty' && type !== 'text') errors.push(`字段 ${rule.targetField} 仅文本类型可填空串`);
    if (rule.sourceField !== rule.targetField && !sources.has(rule.targetField) && rows.some(row => Object.hasOwn(row, rule.targetField)) && !rules.some(r => r.sourceField === rule.targetField)) errors.push(`目标字段重名：${rule.targetField} 与保留字段冲突`);
  }
  const seenKeys = new Set<string>();
  const keyRules = rules.filter(r => r.isKey);
  const output = rows.map((row, index) => {
    const out: Record<string, unknown> = {};
    for (const rule of rules) {
      const target = rule.targetField.trim(), raw = row[rule.sourceField];
      const type = rule.isDate ? 'date' : (rule.type || 'text');
      const error = (message: string) => errors.push(`第 ${index + 1} 行「${target}」${message}`);
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        if (rule.required || rule.isKey) error('必填，不能留空');
        out[target] = rule.nullPolicy === 'zero' ? 0 : rule.nullPolicy === 'empty' ? '' : null;
        continue;
      }
      if (type === 'number') {
        const n = parseNumericValue(raw);
        if (n === null) { error('包含非法数值'); out[target] = null; }
        else if (typeof raw === 'string' && /%$/.test(raw.trim()) && rule.numericUnit !== 'percent') { error('含百分比文本，请明确选择百分比单位后同步（历史值不会自动改写）'); out[target] = null; }
        else out[target] = rule.numericUnit === 'percent' && rule.sourcePercentScale === 'percentage_points' && !(typeof raw === 'string' && /%$/.test(raw.trim())) ? percentagePointsToFraction(n) : n;
      } else if (type === 'boolean') {
        const value = String(raw).trim();
        if (/^(true|是|1|yes)$/i.test(value)) out[target] = true;
        else if (/^(false|否|0|no)$/i.test(value)) out[target] = false;
        else { error('包含未知布尔文本'); out[target] = null; }
      } else if (type === 'date') {
        const value = String(raw).trim();
        const format = rule.dateFormat || 'auto';
        const validFormat = format === 'auto' || (format === 'YYYY-MM-DD' && /^\d{4}-\d{2}-\d{2}$/.test(value)) || (format === 'YYYY-MM' && /^\d{4}-\d{2}$/.test(value)) || (format === 'ISO' && /^\d{4}-\d{2}-\d{2}T/.test(value));
        if (!validFormat || parseProjectDate(raw) === null) { error('包含非法日期或不匹配的日期格式'); out[target] = null; }
        else out[target] = typeof raw === 'number' ? new Date(raw).toISOString()
          : value.replace(/^(\d{4})[/.](\d{2})[/.](\d{2})/, '$1-$2-$3').replace(/^(\d{4})[/.](\d{2})$/, '$1-$2');
      } else out[target] = String(raw).trim();
    }
    for (const [key, value] of Object.entries(row)) {
      if (!sources.has(key) && !targets.has(key)) out[key] = value;
    }
    if (keyRules.length) {
      const key = JSON.stringify(keyRules.map(r => out[r.targetField.trim()]));
      if (seenKeys.has(key)) errors.push(`第 ${index + 1} 行主键重复（${keyRules.map(r => r.targetField).join(' + ')}）`);
      seenKeys.add(key);
    }
    return rules.length ? out : { ...row };
  });
  return { rows: output, errors: [...new Set(errors)] };
}

export function applyFieldMapping(rows: Array<Record<string, unknown>>, rules: FieldMappingRule[]) {
  const result = transformMappedRows(rows, rules || []);
  if (result.errors.length) throw new FieldMappingError(result.errors);
  return result.rows;
}
