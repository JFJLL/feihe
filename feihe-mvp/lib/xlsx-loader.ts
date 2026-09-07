export type XLSXType = NonNullable<Window['XLSX']>;

export const XLSX_LOAD_TIMEOUT_MS = 15_000;

let activeLoadingPromise: Promise<XLSXType> | null = null;
let currentTaskId = 0;

export function isValidXLSX(candidate: unknown): candidate is XLSXType {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Record<string, unknown>;
  const utils = obj.utils as Record<string, unknown> | undefined;
  if (!utils || typeof utils !== 'object') return false;
  return (
    typeof obj.read === 'function' &&
    typeof utils.sheet_to_json === 'function'
  );
}

export function loadXLSX(timeoutMs = XLSX_LOAD_TIMEOUT_MS): Promise<XLSXType> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('XLSX 只能在客户端环境中加载'));
  }

  if (isValidXLSX(window.XLSX)) {
    return Promise.resolve(window.XLSX);
  }

  if (activeLoadingPromise) {
    return activeLoadingPromise;
  }

  const oldScript = document.querySelector<HTMLScriptElement>('script[data-xlsx-loader="true"]');
  if (oldScript) {
    oldScript.remove();
  }

  const taskId = ++currentTaskId;

  activeLoadingPromise = new Promise<XLSXType>((resolve, reject) => {
    let settled = false;
    let scriptNode: HTMLScriptElement | null = null;

    const cleanup = () => {
      clearTimeout(timer);
      if (scriptNode) {
        scriptNode.onload = null;
        scriptNode.onerror = null;
      }
      if (currentTaskId === taskId) {
        activeLoadingPromise = null;
      }
    };

    const finishSuccess = (xlsx: XLSXType) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(xlsx);
    };

    const finishError = (message: string) => {
      if (settled) return;
      settled = true;
      if (scriptNode) {
        scriptNode.remove();
      }
      cleanup();
      reject(new Error(message));
    };

    const timer = setTimeout(() => {
      finishError('Excel 解析库加载超时，请检查网络后重试');
    }, timeoutMs);

    try {
      scriptNode = document.createElement('script');
      scriptNode.src = '/vendor/xlsx-0.20.3.full.min.js';
      scriptNode.async = true;
      scriptNode.dataset.xlsxLoader = 'true';

      scriptNode.onload = () => {
        if (isValidXLSX(window.XLSX)) {
          finishSuccess(window.XLSX);
        } else {
          finishError('Excel 解析库加载完成但未导出有效的 XLSX 对象');
        }
      };

      scriptNode.onerror = () => {
        finishError('Excel 解析库加载失败，请检查网络后重试');
      };

      document.head.appendChild(scriptNode);
    } catch (err) {
      finishError(err instanceof Error ? err.message : '创建脚本节点失败');
    }
  });

  return activeLoadingPromise;
}
