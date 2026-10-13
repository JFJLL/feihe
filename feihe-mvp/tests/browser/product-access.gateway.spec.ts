import { test, expect } from './evidence';
import type { APIRequestContext } from '@playwright/test';
import { gatewayIdentity as signed } from './gateway-identity';
async function create(request: APIRequestContext, name: string) {
  const identity = await signed('user-editor');
  const response = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: name + Date.now(), templateId: 'general_workbench' } });
  expect(response.status()).toBe(200); return { projectId: (await response.json()).id, identity };
}
test('公司身份边界：无身份、伪造管理员头和任意Bearer不能进入已有缓存的页面或API', async ({ page, request }, info) => {
  const { projectId, identity } = await create(request, '网关私有项目');
  await page.context().setExtraHTTPHeaders(identity); await page.goto('/projects/' + projectId); await expect(page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true })).toBeVisible();
  const forgedHeaders: Array<Record<string, string>> = [{}, { 'x-user-id': 'user-admin' }, { authorization: 'Bearer arbitrary-value', 'x-user-id': 'user-admin' }];
  for (const forged of forgedHeaders) {
    expect((await request.get('/api/projects', { headers: forged })).status()).toBe(401);
    await page.context().setExtraHTTPHeaders(forged); await page.goto('/projects/' + projectId); await expect(page.getByRole('heading', { name: '需要公司身份验证', exact: true })).toBeVisible(); await expect(page.getByRole('navigation', { name: '项目模块', exact: true })).toHaveCount(0);
  }
  await page.goto('/'); await expect(page.getByRole('heading', { name: '需要公司身份验证', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: '＋ 新建项目', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('gateway-forged-identity-denied.png') });
});
test('公司身份边界：真实签名取登记身份，普通成员/查看者/管理员分别执行授权页面和写权限', async ({ page, request }, info) => {
  const { projectId, identity } = await create(request, '签名公司身份');
  const other = await signed('user-project-manager'); expect((await request.get('/api/projects?projectId=' + projectId, { headers: other })).status()).toBe(403);
  const viewer = await signed('user-viewer'); expect((await request.post('/api/projects', { headers: identity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
  await page.context().setExtraHTTPHeaders({ ...viewer, 'x-user-id': 'user-admin' }); await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('heading', { name: '项目报告', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
  expect((await request.post('/api/agent', { headers: viewer, data: { projectId, prompt: '生成报告' } })).status()).toBe(403); expect((await request.post('/api/feishu/sync', { headers: viewer, data: { projectId, all: true } })).status()).toBe(403);
  const admin = await signed('user-admin'); expect((await request.get('/api/projects?projectId=' + projectId, { headers: admin })).status()).toBe(200);
  await page.screenshot({ path: info.outputPath('gateway-signed-viewer-read-only.png'), fullPage: true });
});
test('公司身份边界：过期、篡改签名及未登记账号均拒绝，测试身份不会在此服务生效', async ({ page, request }, info) => {
  const expired = await signed('user-editor', String(Date.now() - 600000)), unknown = await signed('not-registered-company-account'), tampered = { ...await signed('user-editor'), 'x-feihe-auth-signature': '0'.repeat(64) };
  for (const identity of [expired, unknown, tampered, { 'x-user-id': 'user-admin' }]) expect((await request.get('/api/projects', { headers: identity })).status()).toBe(401);
  await page.context().setExtraHTTPHeaders(unknown); await page.goto('/'); await expect(page.getByRole('heading', { name: '需要公司身份验证', exact: true })).toBeVisible(); await page.screenshot({ path: info.outputPath('gateway-unknown-account-denied.png') });
});
