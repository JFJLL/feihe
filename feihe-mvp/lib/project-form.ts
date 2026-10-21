export const PROJECT_COLORS = [
  { value: '#2563eb', label: '蓝色' }, { value: '#059669', label: '绿色' },
  { value: '#4f46e5', label: '靛蓝' }, { value: '#d97706', label: '琥珀色' },
  { value: '#e11d48', label: '玫瑰色' }, { value: '#7c3aed', label: '紫色' },
  { value: '#0891b2', label: '青色' }, { value: '#475569', label: '石板灰' },
];
export const PROJECT_STATUSES = ['筹备中', '进行中', '已结束'];
export const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const LOGO_KEY_REGEX = /^(?:projects\/[a-zA-Z0-9_-]+\/logo|uploads\/logos\/[a-zA-Z0-9_-]+)\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|gif)$/;

export function parseLogoKey(logoUrl: string): string | null {
  const raw = String(logoUrl || '').trim();
  if (!raw) return null;
  // Must be a canonical local relative path; reject absolute URLs, protocol-relative (//), backslashes, and hash
  if (!raw.startsWith('/api/projects/logo?')) return null;
  if (raw.includes('#') || raw.includes('\\') || raw.startsWith('//')) return null;

  try {
    const parsed = new URL(raw, 'http://localhost');
    if (parsed.pathname !== '/api/projects/logo') return null;
    const params = parsed.searchParams;
    const paramNames = Array.from(params.keys());
    if (paramNames.length !== 1 || paramNames[0] !== 'key') return null;
    const keyValues = params.getAll('key');
    if (keyValues.length !== 1) return null;
    const key = keyValues[0];
    if (!key) return null;
    return LOGO_KEY_REGEX.test(key) ? key : null;
  } catch {
    return null;
  }
}

export function isValidLogoUrl(logoUrl: string): boolean {
  const raw = String(logoUrl || '').trim();
  if (!raw) return true;
  return parseLogoKey(raw) !== null;
}

export function validateLogoFile(file: { size?: number; type?: string; name?: string }): { valid: boolean; error?: string } {
  if (file.size !== undefined && file.size > MAX_LOGO_SIZE) {
    return { valid: false, error: 'Logo 图片不能超过 2MB' };
  }
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (type === 'image/svg+xml' || name.endsWith('.svg')) {
    return { valid: false, error: '不支持 SVG 脚本格式，请上传 PNG、JPEG、WebP 或 GIF 格式图片' };
  }
  if (type && !ALLOWED_LOGO_TYPES.includes(type as (typeof ALLOWED_LOGO_TYPES)[number])) {
    return { valid: false, error: '仅支持 PNG、JPEG、WebP 或 GIF 格式的图片' };
  }
  return { valid: true };
}

export function detectLogoBufferType(buffer: Uint8Array | ArrayBuffer): { valid: boolean; contentType?: string; error?: string } {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 8 || bytes.length > MAX_LOGO_SIZE) {
    return { valid: false, error: 'Logo 图片大小必须在 8 字节至 2MB 之间' };
  }

  // Disallow SVG script tags, xml, or html in both prefix and suffix without Node Buffer dependency
  const decodeLatin1 = (slice: Uint8Array): string => {
    let out = '';
    const len = slice.length;
    for (let i = 0; i < len; i++) out += String.fromCharCode(slice[i]);
    return out.toLowerCase();
  };
  const prefixStr = decodeLatin1(bytes.subarray(0, Math.min(bytes.length, 1024)));
  const suffixStr = decodeLatin1(bytes.subarray(Math.max(0, bytes.length - 512)));
  const textSample = prefixStr + ' ' + suffixStr;
  if (
    textSample.includes('<svg') ||
    textSample.includes('<?xml') ||
    textSample.includes('<script') ||
    textSample.includes('<!doctype') ||
    textSample.includes('<html') ||
    textSample.includes('javascript:') ||
    textSample.includes('onload=') ||
    textSample.includes('onerror=')
  ) {
    return { valid: false, error: '不支持 SVG 格式或包含脚本的内容' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { valid: true, contentType: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, contentType: 'image/jpeg' };
  }
  // GIF: 47 49 46 38 ('GIF8')
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { valid: true, contentType: 'image/gif' };
  }
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { valid: true, contentType: 'image/webp' };
  }

  return { valid: false, error: '文件不是受支持的 PNG、JPEG、WebP 或 GIF 格式' };
}

export function automaticProjectColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length].value;
}
export interface ProjectDraft {
  id?: string; name: string; departmentId: string; ownerId: string; clientId: string;
  description: string; templateId: string; status: string; color: string;
  brand: string; spu: string; category: string; logoUrl?: string;
}
export function projectDraftErrors(draft: ProjectDraft) {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('请填写项目名称');
  if (draft.name.trim().length > 100) errors.push('项目名称不能超过100字');
  if (draft.brand && draft.brand.trim().length > 50) errors.push('品牌名称不能超过50字');
  if (draft.spu && draft.spu.trim().length > 50) errors.push('产品/SPU不能超过50字');
  if (draft.logoUrl && draft.logoUrl.trim() && !isValidLogoUrl(draft.logoUrl.trim())) {
    errors.push('项目 Logo 必须为系统上传的本地图片路径或留空');
  }
  if (!draft.departmentId) errors.push('请选择负责部门');
  if (!draft.ownerId) errors.push('请选择负责人');
  if (!PROJECT_STATUSES.includes(draft.status)) errors.push('请选择有效的业务状态');
  if (draft.color && !/^#[a-f0-9]{6}$/i.test(draft.color)) errors.push('项目识别色格式不正确');
  return errors;
}
