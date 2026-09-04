// 运行环境兼容层：workerd（dev / Cloudflare）优先用绑定变量，普通 Node 直接用进程环境变量。
// 本文件绝不静态引入 cloudflare:workers，保证纯 Node 启动不崩。
let workerSnapshot: Record<string, unknown> | null = null;
let warming: Promise<Record<string, unknown>> | null = null;
export function warmWorkerEnv(): Promise<Record<string, unknown>> {
  if (!warming) {
    warming = (async () => {
      try {
        const mod = (await import('cloudflare:workers')) as unknown as { env?: Record<string, unknown> };
        workerSnapshot = { ...(mod.env ?? {}) };
      } catch {
        workerSnapshot = {};
      }
      return workerSnapshot;
    })();
  }
  return warming;
}
void warmWorkerEnv();
export function workerEnvSync(): Record<string, unknown> {
  return workerSnapshot ?? {};
}
export function envVar(name: string, fallback = ''): string {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  const fromWorker = workerSnapshot?.[name];
  if (fromWorker !== undefined && fromWorker !== null && String(fromWorker) !== '') return String(fromWorker);
  return fallback;
}
export function runtimeVars(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const w = workerSnapshot ?? {};
  for (const k of Object.keys(w)) {
    const v = w[k];
    if (typeof v === 'string') out[k] = v;
  }
  if (typeof process !== 'undefined') {
    for (const k of Object.keys(process.env)) out[k] = process.env[k];
  }
  return out;
}
