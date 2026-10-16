import { test, expect } from './evidence';
import { connectProjectTable, publishRecommendedBoard, projectIdentity, consultationRows } from './product-journey';

test('页面权限反例：原身份真实缓存后，无成员的新身份不能挂载项目私有页面', async ({ page, request }, info) => {
  const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
  await publishRecommendedBoard(page);
  const privateName = '隔离访问项目' + projectId;
  expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, name: privateName } })).status()).toBe(200);
  await page.reload(); await expect(page.getByRole('heading', { name: privateName, exact: true })).toBeVisible();
  await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes('project-data:')));
  await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' });
  expect((await request.get('/api/datasets?projectId=' + projectId, { headers: { 'x-user-id': 'user-viewer' } })).status()).toBe(403);
  await page.goto('/projects/' + projectId + '/data');
  await page.screenshot({ path: info.outputPath('cached-project-unauthorized-entry.png'), fullPage: true });
  await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  await expect(page.getByText(privateName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '项目模块', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('feihe:')))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('agent-sessions:')))).toEqual([]);
});
for (const width of [1280, 390]) {
  test(`身份缓存隔离 ${width}px：页面仍打开时切换已授权身份，旧会话失效后重新读取只读结果`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
    expect((await request.post('/api/reports', { headers: projectIdentity, data: { projectId } })).status()).toBe(200);
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'viewer' } })).status()).toBe(200);
    await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300');
    await page.waitForFunction(() => sessionStorage.getItem('feihe:cache-identity') === 'org-default:user-editor' && Object.keys(sessionStorage).some(key => key.includes('project-data:')));
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-project-manager' }); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: '需要公司身份验证', exact: true })).toBeVisible(); await expect(page.getByRole('article')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('feihe:')))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('agent-sessions:')))).toEqual([]);
    await page.screenshot({ path: info.outputPath('changed-identity-private-state-cleared.png') });
    await page.reload(); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
    await page.waitForFunction(() => sessionStorage.getItem('feihe:cache-identity') === 'org-default:user-project-manager');
    expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.includes(encodeURIComponent('org-default:user-editor'))))).toBeFalsy();
    await page.screenshot({ path: info.outputPath('confirmed-new-identity-read-only.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`返回使用权限 ${width}px：普通成员看报告→只读降权→已发布结果→撤权→恢复授权`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
    expect((await request.post('/api/reports', { headers: projectIdentity, data: { projectId } })).status()).toBe(200);
    const member = { 'x-user-id': 'user-project-manager' };
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'editor' } })).status()).toBe(200);
    await page.context().setExtraHTTPHeaders(member); await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toBeVisible();
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update_member_role', projectId, userId: 'user-project-manager', role: 'viewer' } })).status()).toBe(200);
    const checked = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().method() === 'GET'); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); expect((await checked).status()).toBe(200);
    await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await page.screenshot({ path: info.outputPath('live-role-now-viewer.png'), fullPage: true });
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'remove_member', projectId, userId: 'user-project-manager' } })).status()).toBe(200); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible(); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('live-role-revoked.png') });
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'viewer' } })).status()).toBe(200); await page.reload(); await expect(page.getByRole('article', { name: '咨询人数合计报告结果', exact: true })).toContainText('300'); await expect(page.getByRole('button', { name: '生成并保存报告', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
  test(`成员管理 ${width}px：负责人保护、真实角色选择器与撤销访问，当前身份来自公司记录`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows);
    expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
    await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-project-manager' }); await page.goto('/projects/' + projectId + '/settings?tab=members');
    const owner = page.getByRole('row').filter({ hasText: '业务编辑者(张晓)' }); await expect(owner.getByRole('combobox')).toBeDisabled(); await expect(owner.getByRole('button', { name: '移除', exact: true })).toBeDisabled(); await expect(owner).toContainText('当前负责人');
    const managerIdentity = (await (await request.get('/api/projects?projectId=' + projectId, { headers: { 'x-user-id': 'user-project-manager' } })).json()).currentUser;
    await expect(page.getByText('当前操作身份：')).toContainText(managerIdentity.displayName); await page.screenshot({ path: info.outputPath('owner-protected-member-controls.png'), fullPage: true });
    await page.context().setExtraHTTPHeaders(projectIdentity); await page.reload();
    const managerRole = page.getByRole('combobox', { name: managerIdentity.displayName + '项目角色', exact: true }); await managerRole.focus(); await managerRole.press('ArrowDown');
    await expect(page.getByRole('option', { name: '只读观察员 仅查看看板', exact: true })).toBeVisible(); await page.screenshot({ path: info.outputPath('opened-member-role-selector.png'), fullPage: true });
    await managerRole.press('End'); await managerRole.press('Enter');
    await expect(managerRole).toContainText('只读观察员'); const detail = await (await request.get('/api/projects?projectId=' + projectId, { headers: projectIdentity })).json(); expect(detail.members.find((m: { userId: string }) => m.userId === 'user-project-manager').role).toBe('viewer');
    await page.screenshot({ path: info.outputPath('member-role-confirmed-viewer.png'), fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}
test('撤权反例：负责人交接并移除创建者后，报告、导出和页面都必须拒绝原创建者', async ({ page, request }, info) => {
  const { projectId } = await connectProjectTable(page, request, 'general_workbench', consultationRows); await publishRecommendedBoard(page);
  const generated = await request.post('/api/reports', { headers: projectIdentity, data: { projectId } }); expect(generated.status()).toBe(200); const reportId = (await generated.json()).reportId;
  expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'add_member', projectId, userId: 'user-project-manager', role: 'project_admin' } })).status()).toBe(200);
  expect((await request.post('/api/projects', { headers: projectIdentity, data: { action: 'update', projectId, ownerId: 'user-project-manager' } })).status()).toBe(200);
  const manager = { 'x-user-id': 'user-project-manager' };
  expect((await request.post('/api/projects', { headers: manager, data: { action: 'remove_member', projectId, userId: 'user-editor' } })).status()).toBe(200);
  const denied = await request.get('/api/reports?projectId=' + projectId, { headers: projectIdentity });
  await info.attach('创建者撤权后的真实报告响应', { body: JSON.stringify({ status: denied.status(), body: await denied.json() }), contentType: 'application/json' });
  expect(denied.status()).toBe(403);
  expect((await request.get('/api/report-html?projectId=' + projectId + '&id=' + reportId, { headers: projectIdentity })).status()).toBe(403);
  await page.goto('/projects/' + projectId + '/reports'); await expect(page.getByRole('heading', { name: '无权访问此项目', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('revoked-creator-denied.png') });
});
