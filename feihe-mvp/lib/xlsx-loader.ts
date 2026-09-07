export type XLSXType = NonNullable<Window['XLSX']>;

let xlsxLoadingPromise: Promise<XLSXType> | null = null;

export function loadXLSX(): Promise<XLSXType> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('XLSX 只能在客户端环境中加载'));
  }

  if (window.XLSX) {
    return Promise.resolve(window.XLSX);
  }

  if (xlsxLoadingPromise) {
    return xlsxLoadingPromise;
  }

  xlsxLoadingPromise = new Promise<XLSXType>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-xlsx-loader="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error('Excel 解析库加载完成但未导出 XLSX 对象'));
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Excel 解析库加载失败，请检查网络后重试'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = '/vendor/xlsx-0.20.3.full.min.js';
    script.async = true;
    script.dataset.xlsxLoader = 'true';

    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        xlsxLoadingPromise = null;
        reject(new Error('Excel 解析库加载完成但未导出 XLSX 对象'));
      }
    };

    script.onerror = () => {
      xlsxLoadingPromise = null;
      script.remove();
      reject(new Error('Excel 解析库加载失败，请检查网络后重试'));
    };

    document.head.appendChild(script);
  }).catch((err) => {
    xlsxLoadingPromise = null;
    throw err;
  });

  return xlsxLoadingPromise;
}
