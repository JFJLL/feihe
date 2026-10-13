# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-access.spec.ts >> 成员管理 1280px：负责人保护、真实角色选择器与撤销访问，当前身份来自公司记录
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
- generic [ref=f2e2]:
  - complementary "项目主要导航" [ref=f2e3]:
    - link "返回项目中心" [ref=f2e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=f2e5]: 项目工作台
    - generic [ref=f2e11]:
      - generic [ref=f2e12]: 当前项目
      - combobox "切换项目" [ref=f2e15] [cursor=pointer]:
        - generic [ref=f2e16]: 独立部门报告1791926436763
      - paragraph [ref=f2e20]: 品牌未设置 · 独立部门报告1791926436763 · 筹备中
    - navigation "项目模块" [ref=f2e21]:
      - link "项目总览" [ref=f2e22] [cursor=pointer]:
        - /url: /projects/1791926436763
        - generic [ref=f2e23]: "01"
      - link "数据管理" [ref=f2e25] [cursor=pointer]:
        - /url: /projects/1791926436763/data
        - generic [ref=f2e26]: "02"
      - link "指标" [ref=f2e28] [cursor=pointer]:
        - /url: /projects/1791926436763/metrics
        - generic [ref=f2e29]: "03"
      - link "报告" [ref=f2e31] [cursor=pointer]:
        - /url: /projects/1791926436763/reports
        - generic [ref=f2e32]: "04"
      - link "项目设置" [ref=f2e34] [cursor=pointer]:
        - /url: /projects/1791926436763/settings
        - generic [ref=f2e35]: "05"
    - generic [ref=f2e37]:
      - text: 项目资料已连接
      - generic [ref=f2e39]: 业务编辑者(张晓) · 2026/10/14 05:20:36
  - main [ref=f2e40]:
    - generic [ref=f2e41]:
      - generic [ref=f2e43]:
        - generic [ref=f2e44]:
          - heading "项目设置" [level=1] [ref=f2e45]
          - generic [ref=f2e46]: 11 个识别词 · 0 条主线
        - paragraph [ref=f2e48]: 集中管理当前项目的低频配置、目标规则、数据源与数据地图。
      - tablist "模块切换" [ref=f2e49]:
        - tab "项目资料" [ref=f2e50] [cursor=pointer]
        - tab "成员与权限" [selected] [ref=f2e52] [cursor=pointer]
        - tab "数据源" [ref=f2e54] [cursor=pointer]
        - tab "工具集成" [ref=f2e56] [cursor=pointer]
        - tab "数据地图" [ref=f2e58] [cursor=pointer]
      - tabpanel "成员与权限" [ref=f2e60]:
        - generic [ref=f2e61]:
          - region "项目成员概况" [ref=f2e62]:
            - article [ref=f2e63]:
              - generic [ref=f2e64]: 成员总数
              - generic [ref=f2e66]:
                - generic [ref=f2e67]: "2"
                - generic [ref=f2e68]: 人
              - generic [ref=f2e69]: 已加入当前项目的协同成员
            - article [ref=f2e70]:
              - generic [ref=f2e71]: 项目管理员
              - generic [ref=f2e73]:
                - generic [ref=f2e74]: "2"
                - generic [ref=f2e75]: 人
              - generic [ref=f2e76]: 具备数据接入、指标发布与授权权限
            - article [ref=f2e77]:
              - generic [ref=f2e78]: 业务编辑者
              - generic [ref=f2e80]:
                - generic [ref=f2e81]: "0"
                - generic [ref=f2e82]: 人
              - generic [ref=f2e83]: 具备业务数据编辑与同步权限
            - article [ref=f2e84]:
              - generic [ref=f2e85]: 只读观察员
              - generic [ref=f2e87]:
                - generic [ref=f2e88]: "0"
                - generic [ref=f2e89]: 人
              - generic [ref=f2e90]: 仅具备看板查看与报告导出权限
          - generic [ref=f2e92]:
            - generic [ref=f2e93]:
              - text: 当前操作身份：
              - strong [ref=f2e94]: 业务编辑者(张晓)
            - generic [ref=f2e95]: 具备成员管理权限
          - article [ref=f2e96]:
            - generic [ref=f2e97]:
              - generic [ref=f2e98]:
                - generic [ref=f2e99]: MEMBER ACCESS MATRIX
                - heading "项目成员与权限列表" [level=3] [ref=f2e100]
                - paragraph [ref=f2e101]: 不同成员按角色隔离飞书应用凭证、写操作与删除权限。
              - button "＋ 添加已有成员" [ref=f2e102] [cursor=pointer]:
                - generic [ref=f2e103]: ＋
                - text: 添加已有成员
            - table [ref=f2e105]:
              - rowgroup [ref=f2e106]:
                - row [ref=f2e107]:
                  - columnheader "成员姓名" [ref=f2e108]
                  - columnheader "系统账号 / 邮箱" [ref=f2e109]
                  - columnheader "项目角色" [ref=f2e110]
                  - columnheader "权限范围" [ref=f2e111]
                  - columnheader "操作" [ref=f2e112]
              - rowgroup [ref=f2e113]:
                - row [ref=f2e114]:
                  - cell "业务编辑者(张晓)(您)" [ref=f2e115]
                  - cell [ref=f2e116]:
                    - code [ref=f2e117]: editor@company.local
                  - cell [ref=f2e118]:
                    - generic [ref=f2e119]: 项目管理员
                    - paragraph [ref=f2e121]: 当前负责人；角色调整需先交接项目资料。
                  - cell "完整数据接入、指标配置、看板发布与成员管理" [ref=f2e122]
                  - cell [ref=f2e123]
                - row [ref=f2e124]:
                  - cell "项目主管(李强)" [ref=f2e125]
                  - cell [ref=f2e126]:
                    - code [ref=f2e127]: pm@company.local
                  - cell [ref=f2e128]:
                    - generic [ref=f2e129]:
                      - combobox "项目主管(李强)项目角色" [expanded] [active] [ref=f2e130] [cursor=pointer]:
                        - generic [ref=f2e131]: 项目管理员
                      - listbox [ref=f2e135]:
                        - option "项目管理员 全部权限" [selected] [ref=f2e136] [cursor=pointer]:
                          - generic [ref=f2e137]:
                            - text: 项目管理员
                            - generic [ref=f2e139]: 全部权限
                        - option "业务编辑者 可同步与编辑" [ref=f2e142] [cursor=pointer]:
                          - generic [ref=f2e143]:
                            - text: 业务编辑者
                            - generic [ref=f2e145]: 可同步与编辑
                        - option "只读观察员 仅查看看板" [ref=f2e146] [cursor=pointer]:
                          - generic [ref=f2e147]:
                            - text: 只读观察员
                            - generic [ref=f2e149]: 仅查看看板
                  - cell "完整数据接入、指标配置、看板发布与成员管理" [ref=f2e150]
                  - cell [ref=f2e151]:
                    - button "移除" [ref=f2e152] [cursor=pointer]
  - button "打开智能助手" [ref=f2e153] [cursor=pointer]:
    - generic [ref=f2e155]: 智
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