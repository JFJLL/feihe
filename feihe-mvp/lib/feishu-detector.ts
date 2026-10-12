import { envVar } from './runtime-env';

export interface FeishuLinkInfo {
  rawUrl: string;
  type: 'feishu_sheet' | 'feishu_bitable' | 'feishu_wiki' | 'unknown';
  wikiToken?: string;
  spreadsheetToken?: string;
  bitableToken?: string;
  sheetId?: string;
}

export function detectFeishuUrl(inputUrl: string): FeishuLinkInfo {
  const urlStr = String(inputUrl || '').trim();
  const info: FeishuLinkInfo = {
    rawUrl: urlStr,
    type: 'unknown',
  };

  if (!urlStr) return info;

  // Extract query sheet if present (e.g. ?sheet=4bTvDu)
  const sheetMatch = urlStr.match(/[?&]sheet=([a-zA-Z0-9_-]+)/);
  if (sheetMatch) {
    info.sheetId = sheetMatch[1];
  }

  // Check Wiki
  const wikiMatch = urlStr.match(/wiki\/([a-zA-Z0-9_-]+)/);
  if (wikiMatch) {
    info.type = 'feishu_wiki';
    info.wikiToken = wikiMatch[1];
    return info;
  }

  // Check Sheet
  const sheetTokenMatch = urlStr.match(/sheets\/([a-zA-Z0-9_-]+)/);
  if (sheetTokenMatch) {
    info.type = 'feishu_sheet';
    info.spreadsheetToken = sheetTokenMatch[1];
    return info;
  }

  // Check Bitable / Base
  const baseMatch = urlStr.match(/(?:base|bitable)\/([a-zA-Z0-9_-]+)/);
  if (baseMatch) {
    info.type = 'feishu_bitable';
    info.bitableToken = baseMatch[1];
    return info;
  }

  // Raw token fallback
  if (/^[a-zA-Z0-9_-]{20,32}$/.test(urlStr)) {
    info.type = 'feishu_sheet';
    info.spreadsheetToken = urlStr;
    return info;
  }

  return info;
}

export async function fetchFeishuAccessToken(): Promise<string> {
  const appId = envVar('FEISHU_APP_ID');
  const appSecret = envVar('FEISHU_APP_SECRET');
  if (!appId || !appSecret) {
    throw new Error('飞书应用凭证尚未配置 (FEISHU_APP_ID / FEISHU_APP_SECRET)');
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = (await response.json()) as { code?: number; msg?: string; tenant_access_token?: string };
  if (!response.ok || data.code || !data.tenant_access_token) {
    throw new Error(`获取飞书凭证失败: ${data.msg || '网络或凭证错误'}`);
  }
  return data.tenant_access_token;
}

export async function inspectFeishuSpreadsheet(spreadsheetToken: string, token: string): Promise<{
  sheets: Array<{ sheetId: string; title: string; rowCount: number; columnCount: number }>;
}> {
  const res = await fetch(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: {
      sheets?: Array<{
        sheet_id: string;
        title: string;
        grid_properties?: { row_count: number; column_count: number };
      }>;
    };
  };

  if (!res.ok || payload.code) {
    if (payload.code === 99991663 || payload.code === 99991668 || payload.code === 1254003) {
      throw new Error('应用没有该表格的读取权限。请在飞书文档右上角「···」-「添加文档应用」中授权当前应用。');
    }
    throw new Error(`飞书表格元数据读取失败: ${payload.msg || `HTTP ${res.status}`}`);
  }

  const sheets = (payload.data?.sheets || []).map((s) => ({
    sheetId: s.sheet_id,
    title: s.title,
    rowCount: s.grid_properties?.row_count || 0,
    columnCount: s.grid_properties?.column_count || 0,
  }));

  return { sheets };
}

export async function inspectFeishuBitable(bitableToken: string, token: string): Promise<{
  tables: Array<{ tableId: string; title: string }>;
}> {
  const res = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${bitableToken}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: {
      items?: Array<{
        table_id: string;
        name: string;
      }>;
    };
  };

  if (!res.ok || payload.code) {
    if (payload.code === 99991663 || payload.code === 99991668 || payload.code === 1254003) {
      throw new Error("应用没有该多维表格的读取权限。请在文档右上角「···」-「添加文档应用」中授权当前应用。");
    }
    throw new Error(`飞书多维表格数据表读取失败: ${payload.msg || `HTTP ${res.status}`}`);
  }

  const tables = (payload.data?.items || []).map((t) => ({
    tableId: t.table_id,
    title: t.name,
  }));

  return { tables };
}
