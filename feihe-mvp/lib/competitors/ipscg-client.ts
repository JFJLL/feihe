import http from 'node:http';
import type { RawIpscgApiResponse, RawIpscgRecord } from './types';

export const IPSCG_API_HOST = '117.78.5.18';
export const IPSCG_API_PORT = 8080;
export const IPSCG_API_PATH = '/ips-api/yimei/selectKeywordResults';

export interface IpscgFetchParams {
  taskId: string;
  keyword: string;
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  windowType?: 'pubTime' | 'insertTime' | 'all';
  signal?: AbortSignal;
}

// 串行单并发队列与限速保证
let lastRequestTime = 0;
let queueTail = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function fetchIpscgKeywordPage(
  params: IpscgFetchParams,
  rateLimitMs = 1200
): Promise<{ count: number; list: RawIpscgRecord[]; durationMs: number }> {
  // 强制串行入队
  const task = async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < rateLimitMs) {
      await sleep(rateLimitMs - elapsed);
    }
    const start = Date.now();
    lastRequestTime = Date.now();

    const queryObj: Record<string, string> = {
      format: 'json',
      pageSize: String(params.pageSize || 20),
      page: String(params.page || 1),
      taskId: params.taskId,
      keywords: params.keyword,
    };

    // 时间窗口支持：区分发布时间与采集时间（使用上游已实测的拼写）
    if (params.from && params.to) {
      const fromStr = params.from.includes(':') ? params.from : (params.from + ' 00:00:00');
      const toStr = params.to.includes(':') ? params.to : (params.to + ' 23:59:59');
      if (params.windowType === 'pubTime') {
        queryObj.beginTime = fromStr;
        queryObj.endTime = toStr;
      } else if (params.windowType === 'insertTime') {
        queryObj.insertbBeginTime = fromStr;
        queryObj.insertEndTime = toStr;
      }
    }

    const searchParams = new URLSearchParams(queryObj).toString();
    const fullPath = IPSCG_API_PATH + '?' + searchParams;

    return new Promise<{ count: number; list: RawIpscgRecord[]; durationMs: number }>((resolve, reject) => {
      const req = http.request({
        hostname: IPSCG_API_HOST,
        port: IPSCG_API_PORT,
        path: fullPath,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FeiheCompetitorSyncWorker/1.0',
        },
        timeout: 15000,
      }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('上游接口响应异常 HTTP ' + res.statusCode));
        }
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw) as RawIpscgApiResponse;
            const count = typeof parsed.count === 'number' ? parsed.count : parseInt(String(parsed.count || 0), 10);
            const list = Array.isArray(parsed.yimeiCommonAppList) ? parsed.yimeiCommonAppList : [];
            resolve({
              count: Number.isFinite(count) ? count : 0,
              list,
              durationMs: Date.now() - start,
            });
          } catch (err) {
            reject(new Error('上游返回数据非标准 JSON: ' + (err instanceof Error ? err.message : String(err))));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('上游接口请求超时 (15s)'));
      });

      req.on('error', (err) => {
        reject(new Error('上游网络请求失败: ' + err.message));
      });

      if (params.signal) {
        params.signal.addEventListener('abort', () => {
          req.destroy();
          reject(new Error('请求被中止'));
        });
      }

      req.end();
    });
  };

  const next = queueTail.then(task, task);
  queueTail = next.then(() => {}, () => {});
  return next;
}
