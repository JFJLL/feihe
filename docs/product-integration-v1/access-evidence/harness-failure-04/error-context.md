# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-access.spec.ts >> 成员管理 390px：负责人保护、真实角色选择器与撤销访问，当前身份来自公司记录
- Location: tests\browser\product-access.spec.ts:35:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('option', { name: '只读观察员', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - dialog "Runtime Error" [ref=f2e3]:
    - banner [ref=f2e4]:
      - generic [ref=f2e5]: Runtime Error
      - generic [ref=f2e7]:
        - button "Copy Error Info" [ref=f2e8] [cursor=pointer]
        - button "Dismiss" [ref=f2e13] [cursor=pointer]: ×
    - generic [ref=f2e14]:
      - heading "useProject must be used within a ProjectProvider" [level=2] [ref=f2e15]
      - generic [ref=f2e16]:
        - generic [ref=f2e17]:
          - generic [ref=f2e18]: http://127.0.0.1:5216/components/project-shell/ProjectContext.tsx:246:9 @ useProject
          - button "Open http://127.0.0.1:5216/components/project-shell/ProjectContext.tsx:246:9 in editor" [ref=f2e19] [cursor=pointer]: ↗
        - generic [ref=f2e20]:
          - generic [ref=f2e21]: 244 |
          - generic [ref=f2e24]:
            - generic [ref=f2e25]: 245 |
            - generic [ref=f2e26]: "export function useProject() {"
          - generic [ref=f2e27]:
            - generic [ref=f2e28]: ">246 |"
            - generic [ref=f2e29]: const ctx = useContext(ProjectContext);
          - generic [ref=f2e30]:
            - generic [ref=f2e31]: "|"
            - generic [ref=f2e32]: ^
          - generic [ref=f2e33]:
            - generic [ref=f2e34]: 247 |
            - generic [ref=f2e35]: "if (!ctx) {"
          - generic [ref=f2e36]:
            - generic [ref=f2e37]: 248 |
            - generic [ref=f2e38]: throw new Error('useProject must be used within a ProjectProvider');
          - generic [ref=f2e39]:
            - generic [ref=f2e40]: 249 |
            - generic [ref=f2e41]: "}"
      - generic [ref=f2e42]:
        - generic [ref=f2e43]:
          - paragraph [ref=f2e44]:
            - text: Call Stack
            - generic [ref=f2e45]: "10"
          - button "Show 8 ignore-listed frame(s)" [ref=f2e46] [cursor=pointer]:
            - text: Show 8 ignore-listed frame(s)
            - generic [aria-hidden] [ref=f2e47]: ↕
        - list [ref=f2e48]:
          - listitem [ref=f2e49]:
            - button "Open http://127.0.0.1:5216/components/project-shell/ProjectContext.tsx:246:9 in editor" [ref=f2e50] [cursor=pointer]:
              - generic [ref=f2e51]: useProject
              - generic [ref=f2e52]: http://127.0.0.1:5216/components/project-shell/ProjectContext.tsx:246:9
          - listitem [ref=f2e53]:
            - button "Open http://127.0.0.1:5216/components/project-shell/ProjectShell.tsx:44:7 in editor" [ref=f2e54] [cursor=pointer]:
              - generic [ref=f2e55]: ProjectShellContent
              - generic [ref=f2e56]: http://127.0.0.1:5216/components/project-shell/ProjectShell.tsx:44:7
      - group [ref=f2e57]:
        - generic "Component stack" [ref=f2e58] [cursor=pointer]
  - generic [ref=f2e60]:
    - heading "This page couldn’t load" [level=1] [ref=f2e63]
    - paragraph [ref=f2e64]: Reload to try again, or go back.
    - generic [ref=f2e65]:
      - button "Reload" [ref=f2e67] [cursor=pointer]
      - button "Back" [ref=f2e68] [cursor=pointer]
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
  41 |     const managerIdentity = (await (await request.get('/api/projects?projectId=' + projectId, { headers: { 'x-user-id': 'user-project-manager' } })).json()).currentUser;
  42 |     await expect(page.getByText('当前操作身份：')).toContainText(managerIdentity.displayName); await page.screenshot({ path: info.outputPath('owner-protected-member-controls.png'), fullPage: true });
  43 |     await page.context().setExtraHTTPHeaders(projectIdentity); await page.reload();
> 44 |     const managerRole = page.getByRole('combobox', { name: managerIdentity.displayName + '项目角色', exact: true }); await managerRole.focus(); await managerRole.press('ArrowDown'); await page.getByRole('option', { name: '只读观察员', exact: true }).click();
     |                                                                                                                                                                                                                                                  ^ Error: locator.click: Test timeout of 60000ms exceeded.
  45 |     await expect(managerRole).toContainText('只读观察员'); const detail = await (await request.get('/api/projects?projectId=' + projectId, { headers: projectIdentity })).json(); expect(detail.members.find((m: { userId: string }) => m.userId === 'user-project-manager').role).toBe('viewer');
  46 |     await page.screenshot({ path: info.outputPath('member-role-confirmed-viewer.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  47 |   });
  48 | }
  49 | test('撤权反例：负责人交接并移除创建者后，报告、导出和页面都必须拒绝原创建者', async ({ page, request }, info) => {
  50 |   const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  51 |   const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId } }); expect(generated.status()).toBe(200); const reportId = (await generated.json()).reportId;
  52 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
  53 |   expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, ownerId: 'user-project-manager' } })).status()).toBe(200);
  54 |   const manager = { 'x-user-id': 'user-project-manager' };
  55 |   expect((await request.post('/api/projects', { headers: manager, data: { action: 'remove_member', projectId, userId: 'user-editor' } })).status()).toBe(200);
  56 |   const denied = await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity });
  57 |   await info.attach('创建者撤权后的真实报告响应', { body: JSON.stringify({ status: denied.status(), body: await denied.json() }), contentType: 'application/json' });
  58 |   expect(denied.status()).toBe(403);
  59 |   expect((await request.get('/api/report-html?projectId=' + projectId + '&id=' + reportId, { headers: projectIdentity })).status()).toBe(403);
  60 |   await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  61 |   await page.screenshot({ path: info.outputPath('revoked-creator-denied.png') });
  62 | });
  63 | 
```