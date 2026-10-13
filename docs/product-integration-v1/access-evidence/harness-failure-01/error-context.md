# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-access.spec.ts >> 成员管理 1280px：负责人保护、真实角色选择器与撤销访问，当前身份来自公司记录
- Location: tests\browser\product-access.spec.ts:35:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByText('当前操作身份：')
Expected substring: "项目负责人(李四)"
Received string:    "当前操作身份：项目主管(李强)"
Timeout: 10000ms

Call log:
  - Expect "toContainText" getByText('当前操作身份：') with timeout 10000ms
  - waiting for getByText('当前操作身份：')
    23 × locator resolved to <span>…</span>
       - unexpected value "当前操作身份：项目主管(李强)"

```

```yaml
- text: 当前操作身份：
- strong: 项目主管(李强)
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows } from './product-journey';
  3  | 
  4  | test('页面权限反例：原身份真实缓存后，无成员的新身份不能挂载项目私有页面', async ({ page, request }, info) => {
  5  |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  6  |   await publishRecommendedBoard(page);
  7  |   const privateName = '隔离访问项目' + projectId;
  8  |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, name: privateName } })).status()).toBe(200);
  9  |   await page.reload(); await expect(page.getByRole('heading', { name: privateName, exact: true })).toBeVisible();
  10 |   await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes('project-data:')));
  11 |   await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' });
  12 |   expect((await request.get('/api/datasets?projectId=' + projectId, { headers: { 'x-user-id': 'user-viewer' } })).status()).toBe(403);
  13 |   await page.goto('/projects/' + projectId + '/data');
  14 |   await page.screenshot({ path: info.outputPath('cached-project-unauthorized-entry.png'), fullPage: true });
  15 |   await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  16 |   await expect(page.getByText(privateName, { exact: true })).toHaveCount(0);
  17 |   await expect(page.getByRole('navigation', { name: '项目模块', exact: true })).toHaveCount(0);
  18 | });
  19 | for (const width of [1280, 390]) {
  20 |   test(`返回使用权限 ${width}px：普通成员看报告→只读降权→已发布结果→撤权→恢复授权`, async ({ page, request }, info) => {
  21 |     await page.setViewportSize({ width, height: 900 });
  22 |     const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  23 |     expect((await request.post('/api/reports', { headers: projectIdentity, data: { projectId } })).status()).toBe(200);
  24 |     const member = { 'x-user-id': 'user-project-manager' };
  25 |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'editor' } })).status()).toBe(200);
  26 |     await page.context().setExtraHTTPHeaders(member); await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toBeVisible();
  27 |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update_member_role', projectId, userId: 'user-project-manager', role: 'viewer' } })).status()).toBe(200);
  28 |     const checked = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().method() === 'GET'); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); expect((await checked).status()).toBe(200);
  29 |     await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await page.screenshot({ path: info.outputPath('live-role-now-viewer.png'), fullPage: true });
  30 |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'remove_member', projectId, userId: 'user-project-manager' } })).status()).toBe(200); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  31 |     await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible(); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('live-role-revoked.png') });
  32 |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'viewer' } })).status()).toBe(200); await page.reload(); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
  33 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  34 |   });
  35 |   test(`成员管理 ${width}px：负责人保护、真实角色选择器与撤销访问，当前身份来自公司记录`, async ({ page, request }, info) => {
  36 |     await page.setViewportSize({ width, height: 900 });
  37 |     const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  38 |     expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
  39 |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-project-manager' }); await page.goto('/projects/' + projectId + '/settings?tab=members');
  40 |     const owner = page.getByRole('row').filter({ hasText: '业务编辑者(张晓)' }); await expect(owner.getByRole('combobox')).toBeDisabled(); await expect(owner.getByRole('button', { name: '移除', exact: true })).toBeDisabled(); await expect(owner).toContainText('当前负责人');
> 41 |     await expect(page.getByText('当前操作身份：')).toContainText('项目负责人(李四)'); await page.screenshot({ path: info.outputPath('owner-protected-member-controls.png'), fullPage: true });
     |                                             ^ Error: expect(locator).toContainText(expected) failed
  42 |     await page.context().setExtraHTTPHeaders(projectIdentity); await page.reload();
  43 |     const managerRole = page.getByRole('combobox', { name: '项目负责人(李四)项目角色', exact: true }); await managerRole.focus(); await managerRole.press('ArrowDown'); await page.getByRole('option', { name: '只读观察员', exact: true }).click();
  44 |     await expect(managerRole).toContainText('只读观察员'); const detail = await (await request.get('/api/projects?projectId=' + projectId, { headers: projectIdentity })).json(); expect(detail.members.find((m: { userId: string }) => m.userId === 'user-project-manager').role).toBe('viewer');
  45 |     await page.screenshot({ path: info.outputPath('member-role-confirmed-viewer.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  46 |   });
  47 | }
  48 | test('撤权反例：负责人交接并移除创建者后，报告、导出和页面都必须拒绝原创建者', async ({ page, request }, info) => {
  49 |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  50 |   const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId } }); expect(generated.status()).toBe(200); const reportId = (await generated.json()).reportId;
  51 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
  52 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, ownerId: 'user-project-manager' } })).status()).toBe(200);
  53 |   const manager = { 'x-user-id': 'user-project-manager' };
  54 |   expect((await request.post('/api/projects', { headers: manager, data: { action: 'remove_member', projectId, userId: 'user-editor' } })).status()).toBe(200);
  55 |   const denied = await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity });
  56 |   await info.attach('创建者撤权后的真实报告响应', { body: JSON.stringify({ status: denied.status(), body: await denied.json() }), contentType: 'application/json' });
  57 |   expect(denied.status()).toBe(403);
  58 |   expect((await request.get('/api/report-html?projectId=' + projectId + '&id=' + reportId, { headers: projectIdentity })).status()).toBe(403);
  59 |   await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  60 |   await page.screenshot({ path: info.outputPath('revoked-creator-denied.png') });
  61 | });
  62 | 
```