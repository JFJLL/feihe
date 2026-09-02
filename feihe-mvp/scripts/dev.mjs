import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const config = JSON.parse(await readFile(path.resolve(process.cwd(), '..', 'config.json'), 'utf8'));
const env = {
  ...process.env,
  KEYSTONE_API_KEY: process.env.KEYSTONE_API_KEY || config.keystone?.api_key || '',
  KEYSTONE_BASE_URL: process.env.KEYSTONE_BASE_URL || config.keystone?.base_url || 'https://keystonehk.ai/v1',
  KEYSTONE_MODEL: process.env.KEYSTONE_MODEL || config.keystone?.model || 'gpt-5.6-terra',
  KEYSTONE_IMAGE_MODEL: process.env.KEYSTONE_IMAGE_MODEL || config.keystone?.image_model || 'gpt-image-2',
  XHS_BASE_URL: config.xiaohongshu?.base_url || '',
  XHS_COMMENT_L1_PAGE_SIZE: String(config.xiaohongshu?.comment_l1_page_size || 20),
  XHS_COMMENT_L2_PAGE_SIZE: String(config.xiaohongshu?.comment_l2_page_size || 20),
  XHS_SEARCH_PAGE_SIZE: String(config.xiaohongshu?.search_page_size || 60),
  XHS_REQUEST_TIMEOUT_SECONDS: String(config.xiaohongshu?.request_timeout_seconds || 30),
  OSS_ACCESS_KEY_ID: config.oss?.access_key_id || '',
  OSS_ACCESS_KEY_SECRET: config.oss?.access_key_secret || '',
  OSS_ENDPOINT: config.oss?.endpoint || '',
  OSS_BUCKET: config.oss?.bucket || '',
  OSS_COOKIE_OBJECT: config.oss?.cookie_object || '',
  FEISHU_APP_ID: config.feishu?.app_id || '',
  FEISHU_APP_SECRET: config.feishu?.app_secret || '',
};

const viteBin = process.platform === 'win32'
  ? path.resolve('node_modules/vite/bin/vite.js')
  : path.resolve('node_modules/.bin/vite');
const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1'], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code || 0));
