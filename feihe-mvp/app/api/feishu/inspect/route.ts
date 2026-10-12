import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { detectFeishuUrl, fetchFeishuAccessToken, inspectFeishuSpreadsheet, inspectFeishuBitable } from '@/lib/feishu-detector';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { url?: string; projectId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const urlStr = String(body.url || '').trim();
  if (!urlStr) return jsonError('请粘贴飞书文档链接');

  const detected = detectFeishuUrl(urlStr);
  if (detected.type === 'unknown') {
    return jsonError('无法识别该链接格式，请确认粘贴的是飞书电子表格、多维表格或知识库链接');
  }

  try {
    const token = await fetchFeishuAccessToken();
    let realSpreadsheetToken = detected.spreadsheetToken;

    // Resolve Wiki node if applicable
    if (detected.type === 'feishu_wiki' && detected.wikiToken) {
      const nodeRes = await fetch(`https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${detected.wikiToken}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nodeData = (await nodeRes.json()) as { code?: number; msg?: string; data?: { node?: { obj_type?: string; obj_token?: string } } };
      if (!nodeRes.ok || nodeData.code) {
        if (nodeData.code === 99991663 || nodeData.code === 99991668) {
          throw new Error('应用没有该知识库节点的读取权限，请在知识库页面授权当前应用');
        }
        throw new Error(nodeData.msg || '解析知识库节点失败');
      }

      const nodeObj = nodeData.data?.node;
      if (nodeObj?.obj_type === 'sheet') {
        realSpreadsheetToken = nodeObj.obj_token;
        detected.type = 'feishu_sheet';
        detected.spreadsheetToken = nodeObj.obj_token;
      } else if (nodeObj?.obj_type === 'bitable') {
        detected.type = 'feishu_bitable';
        detected.bitableToken = nodeObj.obj_token;
        const meta = await inspectFeishuBitable(nodeObj.obj_token!, token);
        const tablesAsSheets = meta.tables.map(t => ({ sheetId: t.tableId, title: t.title, rowCount: 0, columnCount: 0 }));
        return Response.json({
          ok: true,
          detected: {
            ...detected,
            title: '飞书多维表格 (Base)',
            sheets: tablesAsSheets,
            tables: meta.tables,
          },
        });
      }
    }

    if (detected.type === 'feishu_sheet' && realSpreadsheetToken) {
      const meta = await inspectFeishuSpreadsheet(realSpreadsheetToken, token);
      return Response.json({
        ok: true,
        detected: {
          ...detected,
          spreadsheetToken: realSpreadsheetToken,
          sheets: meta.sheets,
        },
      });
    }

    if (detected.type === 'feishu_bitable' && detected.bitableToken) {
      const meta = await inspectFeishuBitable(detected.bitableToken, token);
      const tablesAsSheets = meta.tables.map(t => ({ sheetId: t.tableId, title: t.title, rowCount: 0, columnCount: 0 }));
      return Response.json({
        ok: true,
        detected: {
          ...detected,
          title: '飞书多维表格 (Base)',
          sheets: tablesAsSheets,
          tables: meta.tables,
        },
      });
    }

    return Response.json({ ok: true, detected });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : '检测飞书链接失败', 400);
  }
}
