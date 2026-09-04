import { warmWorkerEnv, workerEnvSync } from './runtime-env';
void warmWorkerEnv();
export type StoredObject = { body: unknown; contentType: string; etag: string };
type Bucket = {
  put(key: string, data: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: unknown; httpMetadata?: { contentType?: string }; httpEtag?: string } | null>;
  delete(key: string): Promise<unknown>;
};
function bucket(): Bucket | null {
  const w = workerEnvSync() as { FILES?: Bucket };
  return w.FILES ?? null;
}
function extOf(key: string): string {
  const m = key.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'json') return 'application/json';
  return 'application/octet-stream';
}
async function nodeFs() {
  const [fs, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
  const root = path.join(process.cwd(), 'data', 'files');
  await fs.mkdir(root, { recursive: true });
  return { fs, path, root };
}
function safeKey(key: string): string {
  return key.replace(/\.\./g, '_').replace(/^\/+/, '');
}
export async function blobPut(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const b = bucket();
  if (b) {
    await b.put(key, data, { httpMetadata: { contentType } });
    return;
  }
  const { fs, path, root } = await nodeFs();
  const file = path.join(root, safeKey(key));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(data));
  await fs.writeFile(file + '.meta.json', JSON.stringify({ contentType }));
}
export async function blobGet(key: string): Promise<StoredObject | null> {
  const b = bucket();
  if (b) {
    const obj = await b.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.httpMetadata?.contentType || extOf(key), etag: obj.httpEtag || '' };
  }
  const { fs, path, root } = await nodeFs();
  const file = path.join(root, safeKey(key));
  try {
    const [buf, stat] = await Promise.all([fs.readFile(file), fs.stat(file)]);
    let contentType = extOf(key);
    try {
      const meta = JSON.parse(await fs.readFile(file + '.meta.json', 'utf-8')) as { contentType?: string };
      if (meta.contentType) contentType = meta.contentType;
    } catch { /* keep guessed type */ }
    return { body: buf, contentType, etag: stat.size + '-' + Math.round(stat.mtimeMs) };
  } catch {
    return null;
  }
}
export async function blobDelete(key: string): Promise<void> {
  const b = bucket();
  if (b) {
    await b.delete(key);
    return;
  }
  const { fs, path, root } = await nodeFs();
  const file = path.join(root, safeKey(key));
  await fs.rm(file, { force: true });
  await fs.rm(file + '.meta.json', { force: true });
}
