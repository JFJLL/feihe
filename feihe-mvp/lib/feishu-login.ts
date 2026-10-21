import { createHmac, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';

export interface FeishuAuthApp {
  key: string;
  name: string;
  appId: string;
  appSecret: string;
  tenantKeys: string[];
}

export interface FeishuPublicApp {
  key: string;
  name: string;
}

export interface FeishuAuthConfig {
  enabled: boolean;
  baseUrl: string;
  apps: FeishuAuthApp[];
  sessionSecret: string;
}

export interface FeishuSessionUser {
  openId: string;
  unionId?: string;
  name: string;
  avatarUrl?: string;
  tenantKey: string;
  enterpriseKey: string;
  enterpriseName: string;
  loginAt: number;
}

const DEFAULT_CANONICAL_ORIGIN = 'https://xhs.red-magic.cn';
const MIN_SECRET_LENGTH = 32;
export const MAX_ISSUED_NONCES = 10_000;
const issuedNonces = new Map<string, number>();

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

export const FEISHU_SESSION_COOKIE = 'feishu_session';
export const FEISHU_STATE_COOKIE = 'feishu_oauth_state';

export function pruneIssuedNonces(now = Date.now()): void {
  for (const [nonce, expiresAt] of issuedNonces.entries()) {
    if (expiresAt <= now) {
      issuedNonces.delete(nonce);
    }
  }
}

export function resetIssuedNoncesForTesting(): void {
  issuedNonces.clear();
}

export function getIssuedNoncesCountForTesting(): number {
  return issuedNonces.size;
}

export function registerIssuedNonce(nonce: string, now = Date.now()): { success: boolean; error?: string } {
  if (!nonce || typeof nonce !== 'string') {
    return { success: false, error: '无效的 nonce 参数' };
  }
  pruneIssuedNonces(now);
  if (issuedNonces.size >= MAX_ISSUED_NONCES) {
    return { success: false, error: '系统登录并发量达上限，请稍候重试' };
  }
  issuedNonces.set(nonce, now + STATE_TTL_SECONDS * 1000);
  return { success: true };
}

export function consumeIssuedNonce(nonce: string, now = Date.now()): { success: boolean; error?: string } {
  if (!nonce || typeof nonce !== 'string') {
    return { success: false, error: '无效的 nonce 参数' };
  }
  pruneIssuedNonces(now);
  const expiresAt = issuedNonces.get(nonce);
  if (!expiresAt) {
    return { success: false, error: '未知或已失效的授权状态（服务重启或状态未注册），请重新发起登录' };
  }
  issuedNonces.delete(nonce);
  if (expiresAt <= now) {
    return { success: false, error: '授权状态已过期，请重新发起登录' };
  }
  return { success: true };
}

export const consumeOAuthNonce = consumeIssuedNonce;
export const pruneConsumedNonces = pruneIssuedNonces;
export const resetConsumedNoncesForTesting = resetIssuedNoncesForTesting;

function splitTenantKeys(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(val)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeAppKey(key: string, fallback: string): string {
  const raw = (key || fallback || 'default').trim().toLowerCase();
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
  return cleaned || 'default';
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return cryptoTimingSafeEqual(bufA, bufB);
}

export function parseFeishuAuthConfig(env: Record<string, string | undefined> = process.env): FeishuAuthConfig {
  let explicitEnabled: boolean | null = null;
  let baseUrl = '';
  const apps: FeishuAuthApp[] = [];

  // 1. Try parsing JSON config (matches ct-magic FEISHU_CONFIG_JSON)
  const jsonRaw = env.FEISHU_CONFIG_JSON || env.FEISHU_AUTH_CONFIG || '';
  if (jsonRaw.trim()) {
    try {
      const parsed = JSON.parse(jsonRaw.trim()) as Record<string, unknown>;
      const feishu = (parsed.feishu && typeof parsed.feishu === 'object')
        ? (parsed.feishu as Record<string, unknown>)
        : parsed;

      if (feishu.enabled !== undefined) {
        explicitEnabled = Boolean(feishu.enabled);
      }
      if (typeof feishu.baseUrl === 'string' && feishu.baseUrl.trim()) {
        baseUrl = feishu.baseUrl.trim().replace(/\/+$/, '');
      }

      const rawApps = Array.isArray(feishu.apps) ? feishu.apps : null;
      if (rawApps) {
        for (let i = 0; i < rawApps.length; i++) {
          const item = rawApps[i] as Record<string, unknown>;
          if (!item || typeof item !== 'object') continue;
          const appId = String(item.appId || item.app_id || '').trim();
          const appSecret = String(item.appSecret || item.app_secret || '').trim();
          const rawKey = String(item.key || item.id || '').trim();
          const key = safeAppKey(rawKey, appId || `app-${i + 1}`);
          const name = String(item.name || item.label || key).trim() || key;
          const tenantKeys = splitTenantKeys(item.tenantKeys || item.tenant_keys || item.tenantKey || item.tenant_key);
          if (appId) {
            apps.push({ key, name, appId, appSecret, tenantKeys });
          }
        }
      }
    } catch {
      // JSON parse error ignored, fall back to individual vars
    }
  }

  // 2. Try parsing indexed individual environment variables for up to 3 enterprises
  for (let i = 1; i <= 3; i++) {
    const appId = (env[`FEISHU_APP_${i}_ID`] || env[`FEISHU_APP_${i}_APP_ID`] || '').trim();
    const appSecret = (env[`FEISHU_APP_${i}_SECRET`] || env[`FEISHU_APP_${i}_APP_SECRET`] || '').trim();
    if (appId) {
      const rawKey = (env[`FEISHU_APP_${i}_KEY`] || `enterprise-${i}`).trim();
      const key = safeAppKey(rawKey, `app-${i}`);
      const name = (env[`FEISHU_APP_${i}_NAME`] || `企业${i}`).trim();
      const tenantKeys = splitTenantKeys(env[`FEISHU_APP_${i}_TENANT_KEYS`] || env[`FEISHU_APP_${i}_TENANT_KEY`] || '');
      if (!apps.some((a) => a.key === key)) {
        apps.push({ key, name, appId, appSecret, tenantKeys });
      }
    }
  }

  // 3. Fallback to legacy single app if no apps loaded yet
  if (apps.length === 0) {
    const legacyAppId = (env.FEISHU_APP_ID || '').trim();
    const legacyAppSecret = (env.FEISHU_APP_SECRET || '').trim();
    if (legacyAppId) {
      const tenantKeys = splitTenantKeys(env.FEISHU_TENANT_KEYS || env.FEISHU_TENANT_KEY || '');
      const name = (env.FEISHU_APP_NAME || '飞书企业登录').trim();
      apps.push({
        key: 'default',
        name,
        appId: legacyAppId,
        appSecret: legacyAppSecret,
        tenantKeys,
      });
    }
  }

  // 4. Resolve enabled flag
  if (env.FEISHU_AUTH_ENABLED !== undefined) {
    const val = env.FEISHU_AUTH_ENABLED.trim().toLowerCase();
    explicitEnabled = val === 'true' || val === '1' || val === 'yes' || val === 'on';
  } else if (explicitEnabled === null && apps.length > 0) {
    explicitEnabled = true;
  }

  // 5. Base URL resolution
  if (!baseUrl) {
    baseUrl = (env.FEISHU_BASE_URL || env.SITE_ORIGIN || env.APP_BASE_URL || DEFAULT_CANONICAL_ORIGIN).trim().replace(/\/+$/, '');
  }

  // 6. Session secret (strictly isolated, NO borrowing gateway secret, NO insecure public fallback)
  const sessionSecret = (env.FEISHU_SESSION_SECRET || env.CT_SECRET_KEY || '').trim();

  // Fail-closed security rule:
  // If session secret is missing or too short, disable auth completely.
  // If explicitEnabled is false, keep it false.
  let enabled = explicitEnabled === true;
  if (!sessionSecret || sessionSecret.length < MIN_SECRET_LENGTH) {
    enabled = false;
  }
  if (apps.length === 0) {
    enabled = false;
  }

  // Deduplicate app keys
  const dedupedApps: FeishuAuthApp[] = [];
  const seenKeys = new Set<string>();
  for (const app of apps) {
    let finalKey = app.key;
    let counter = 2;
    while (seenKeys.has(finalKey)) {
      finalKey = `${app.key}-${counter++}`;
    }
    seenKeys.add(finalKey);
    dedupedApps.push({ ...app, key: finalKey });
  }

  return {
    enabled,
    baseUrl,
    apps: dedupedApps,
    sessionSecret,
  };
}

export function getPublicFeishuConfig(config: FeishuAuthConfig): {
  enabled: boolean;
  baseUrl: string;
  apps: FeishuPublicApp[];
} {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    apps: config.apps.map((app) => ({
      key: app.key,
      name: app.name,
    })),
  };
}

export function findAuthApp(config: FeishuAuthConfig, key?: string | null): FeishuAuthApp | null {
  if (!config.apps.length) return null;
  if (!key) return config.apps[0];
  const found = config.apps.find((a) => a.key === key.trim().toLowerCase());
  return found || null;
}

export function sanitizeReturnUrl(returnUrl: string | null | undefined, baseUrl: string): string {
  if (!returnUrl) return '/';
  const trimmed = returnUrl.trim();
  if (/^\/(?!\/|\\)[a-zA-Z0-9_\-.~%/?#&=]*$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const target = new URL(trimmed, baseUrl);
    const base = new URL(baseUrl);
    if (target.origin === base.origin) {
      return target.pathname + target.search + target.hash;
    }
  } catch {}
  return '/';
}

export function createFeishuOAuthState(appKey: string, returnUrl: string, secret: string): string {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');
  registerIssuedNonce(nonce, timestamp);
  const returnUrlB64 = b64urlEncode(Buffer.from(returnUrl || '/', 'utf8'));
  const payload = `${appKey}:${timestamp}:${nonce}:${returnUrlB64}`;
  const signature = hmacSha256(payload, secret);
  return `${payload}:${signature}`;
}

export function generateFeishuOAuthState(
  appKey: string,
  returnUrl: string,
  secret: string
): { success: boolean; state?: string; nonce?: string; error?: string } {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');
  const registration = registerIssuedNonce(nonce, timestamp);
  if (!registration.success) {
    return { success: false, error: registration.error || '登录并发量达上限' };
  }
  const returnUrlB64 = b64urlEncode(Buffer.from(returnUrl || '/', 'utf8'));
  const payload = `${appKey}:${timestamp}:${nonce}:${returnUrlB64}`;
  const signature = hmacSha256(payload, secret);
  return { success: true, state: `${payload}:${signature}`, nonce };
}

export function verifyFeishuOAuthState(
  state: string,
  secret: string
): { valid: boolean; appKey?: string; returnUrl?: string; nonce?: string; error?: string } {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: '缺少 state 校验参数' };
  }
  const parts = state.split(':');
  if (parts.length !== 5) {
    return { valid: false, error: 'state 格式非法' };
  }
  const [appKey, timestampStr, nonce, returnUrlB64, signature] = parts;
  const payload = `${appKey}:${timestampStr}:${nonce}:${returnUrlB64}`;
  const expectedSignature = hmacSha256(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'state 签名校验失败' };
  }
  const timestamp = Number(timestampStr);
  if (Number.isNaN(timestamp) || Date.now() - timestamp > STATE_TTL_SECONDS * 1000 || timestamp > Date.now() + 60_000) {
    return { valid: false, error: 'state 已过期，请重新登录' };
  }
  let returnUrl = '/';
  try {
    returnUrl = b64urlDecode(returnUrlB64).toString('utf8');
  } catch {
    returnUrl = '/';
  }
  return { valid: true, appKey, returnUrl, nonce };
}

function safeDecodeCookieComponent(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

export function createFeishuSessionToken(user: FeishuSessionUser, secret: string): string {
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(user), 'utf8'));
  const signature = hmacSha256(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifyFeishuSessionToken(token: string, secret: string): FeishuSessionUser | null {
  if (!token || typeof token !== 'string') return null;
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;
  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expectedSignature = hmacSha256(payloadB64, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }
  try {
    const raw = b64urlDecode(payloadB64).toString('utf8');
    const user = JSON.parse(raw) as FeishuSessionUser;
    if (
      !user ||
      !user.openId ||
      !user.tenantKey ||
      !user.enterpriseKey ||
      !user.enterpriseName ||
      typeof user.loginAt !== 'number'
    ) {
      return null;
    }
    // Reject future timestamps (more than 60s skew)
    if (user.loginAt > Date.now() + 60_000) {
      return null;
    }
    if (Date.now() - user.loginAt > SESSION_TTL_SECONDS * 1000) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      out[key] = safeDecodeCookieComponent(val);
    }
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
  } = {}
): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function isAllowedOrigin(originHeader: string | null, refererHeader: string | null, baseUrl: string): boolean {
  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(baseUrl).origin.toLowerCase());
  } catch {}
  allowedOrigins.add('https://xhs.red-magic.cn');

  // In local development / non-production only, allow specific localhost ports
  const isProd = process.env.NODE_ENV === 'production' || baseUrl.startsWith('https://xhs.red-magic.cn');
  if (!isProd) {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://localhost:5013');
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:5173');
    allowedOrigins.add('http://127.0.0.1:5013');
    allowedOrigins.add('http://127.0.0.1:18087');
  }

  if (originHeader) {
    try {
      return allowedOrigins.has(new URL(originHeader).origin.toLowerCase());
    } catch {
      return false;
    }
  }
  if (refererHeader) {
    try {
      return allowedOrigins.has(new URL(refererHeader).origin.toLowerCase());
    } catch {
      return false;
    }
  }
  return false;
}
