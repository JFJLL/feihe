# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-access.spec.ts >> 页面权限反例：原身份真实缓存后，无成员的新身份不能挂载项目私有页面
- Location: tests\browser\product-access.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '无权访问此项目', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '无权访问此项目', exact: true }) with timeout 10000ms
  - waiting for getByRole('heading', { name: '无权访问此项目', exact: true })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台 当前项目
  - combobox "切换项目":
    - text: 隔离访问项目1791924941364
    - img
  - paragraph: 品牌未设置 · 隔离访问项目1791924941364 · 筹备中
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/1791924941364
      - text: 01 项目总览
    - link "数据管理":
      - /url: /projects/1791924941364/data
      - text: 02 数据管理
    - link "指标":
      - /url: /projects/1791924941364/metrics
      - text: 03 指标
    - link "报告":
      - /url: /projects/1791924941364/reports
      - text: 04 报告
    - link "项目设置":
      - /url: /projects/1791924941364/settings
      - text: 05 项目设置
  - text: 项目资料已连接 业务编辑者(张晓) · 2026/10/14 04:55:45
- main:
  - heading "数据工作台" [level=1]
  - paragraph: 从原表接入，到可核对的项目数据。飞书记录仍在原表编辑。
  - button "刷新数据状态"
  - tablist "模块切换":
    - tab "数据源" [selected]
    - tab "数据集"
    - tab "同步记录"
  - alert:
    - text: ⚠️
    - heading "数据加载异常" [level=3]
    - paragraph: 您没有该项目的访问权限
    - button "重新加载"
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
> 15 |   await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
     |                                                                             ^ Error: expect(locator).toBeVisible() failed
  16 |   await expect(page.getByText(privateName, { exact: true })).toHaveCount(0);
  17 |   await expect(page.getByRole('navigation', { name: '项目模块', exact: true })).toHaveCount(0);
  18 | });
  19 | test('撤权反例：负责人交接并移除创建者后，报告、导出和页面都必须拒绝原创建者', async ({ page, request }, info) => {
  20 |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  21 |   const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId } }); expect(generated.status()).toBe(200); const reportId = (await generated.json()).reportId;
  22 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
  23 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, ownerId: 'user-project-manager' } })).status()).toBe(200);
  24 |   const manager = { 'x-user-id': 'user-project-manager' };
  25 |   expect((await request.post('/api/projects', { headers: manager, data: { action: 'remove_member', projectId, userId: 'user-editor' } })).status()).toBe(200);
  26 |   const denied = await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity });
  27 |   await info.attach('创建者撤权后的真实报告响应', { body: JSON.stringify({ status: denied.status(), body: await denied.json() }), contentType: 'application/json' });
  28 |   expect(denied.status()).toBe(403);
  29 |   expect((await request.get('/api/report-html?projectId=' + projectId + '&id=' + reportId, { headers: projectIdentity })).status()).toBe(403);
  30 |   await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  31 |   await page.screenshot({ path: info.outputPath('revoked-creator-denied.png') });
  32 | });
  33 | 
```