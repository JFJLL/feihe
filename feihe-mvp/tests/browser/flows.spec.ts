import { test, expect } from './evidence';
import type { Page, APIRequestContext } from '@playwright/test';
import { setup, selectDataset } from './helpers';

async function choose(page: Page, name: string, option: string | RegExp) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}
async function emptyProject(request: APIRequestContext) {
  const response = await request.post('/api/projects', { data: { action: 'create', id: `flow-${Date.now()}`, name: '浏览器空项目', templateId: 'general_workbench' } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).id as string;
}
async function openSource(page: Page, projectId: string) {
  const mounted = page.waitForResponse(r => r.url().includes('/api/feishu/sync?projectId=' + projectId));
  await page.goto(`/projects/${projectId}/settings?tab=data-sources`);
  await mounted;
  await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function inspect(page: Page, url = 'https://fixture.feishu.cn/sheets/FixtureDoc') {
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill(url);
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  await expect(page.getByRole('combobox', { name: '目标工作表' })).toContainText('结构A');
}
async function editTitle(page: Page, title: string) {
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill(title);
  await page.getByRole('button', { name: '保存并加入看板' }).click();
}

test('映射规则在页面阻止空必填、重复主键、非法日期和未知布尔，修正后真实落库', async ({ page, request }, info) => {
  const projectId = await emptyProject(request);
  await openSource(page, projectId);
  await inspect(page);
  await choose(page, '目标工作表', /结构B/);
  const save = page.getByRole('button', { name: '✓ 保存并首次同步' });
  async function invalid(name: string, text: string) {
    await expect(page.getByRole('alert')).toContainText(text);
    await expect(save).toBeDisabled();
    expect((await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets).toEqual([]);
    await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  await page.getByRole('checkbox', { name: '金额必填', exact: true }).check();
  await invalid('空必填阻止保存', '必填，不能留空');
  await page.getByRole('checkbox', { name: '金额必填', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: '分组主键', exact: true }).check();
  await invalid('重复主键阻止保存', '主键重复');
  await page.getByRole('checkbox', { name: '分组主键', exact: true }).uncheck();
  await choose(page, '分组数据类型', '日期 (date)');
  await invalid('非法日期阻止保存', '非法日期');
  await choose(page, '分组数据类型', '布尔 (boolean)');
  await invalid('未知布尔阻止保存', '未知布尔文本');
  await choose(page, '分组数据类型', '数值 (number)');
  await invalid('非法数值阻止保存', '非法数值');
  await choose(page, '分组数据类型', '文本 (text)');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(save).toBeEnabled();
  const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  await save.click();
  expect((await synced).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const ds = (await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets[0];
  const stored = (await (await request.get(`/api/datasets?projectId=${projectId}&id=${ds.id}&all=true`)).json()).dataset;
  expect(stored.rows[1]).toMatchObject({ 金额: null, 分组: '同组', 已确认: false });
  await info.attach('实际存储', { body: JSON.stringify(stored, null, 2), contentType: 'application/json' });
});

test('A 空项目接入、换表、映射校验、真实同步和重编辑', async ({ page, request }) => {
  const projectId = await emptyProject(request);
  await test.step('空项目进入数据源并检测文档', async () => {
    await openSource(page, projectId);
    await inspect(page);
    await expect(page.getByRole('textbox', { name: '任务目标字段' })).toHaveValue('任务');
  });
  await test.step('同文档切换结构B清除A映射', async () => {
    await choose(page, '目标工作表', /结构B/);
    await expect(page.getByRole('textbox', { name: '编号目标字段' })).toHaveValue('编号');
    await expect(page.getByRole('textbox', { name: '任务目标字段' })).toHaveCount(0);
    await page.getByRole('textbox', { name: '金额目标字段' }).fill('amount');
    await page.getByRole('textbox', { name: '编号目标字段' }).fill('amount');
    await expect(page.getByRole('alert')).toContainText('目标字段重名');
    await expect(page.getByRole('button', { name: '✓ 保存并首次同步' })).toBeDisabled();
    await page.getByRole('textbox', { name: '编号目标字段' }).fill('id');
    await page.getByRole('checkbox', { name: '编号主键', exact: true }).check();
    await expect(page.getByRole('table').last()).toContainText('true');
  });
  await test.step('同步通过真实转换与SQLite写入，核对存储类型和值', async () => {
    const done = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '✓ 保存并首次同步' }).click();
    expect((await done).status()).toBe(200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const ds = (await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets[0];
    const stored = (await (await request.get(`/api/datasets?projectId=${projectId}&id=${ds.id}&all=true`)).json()).dataset;
    expect(stored.rows[0]).toMatchObject({ id: 1, amount: 10, 已确认: true });
    expect(stored.rows[1].amount).toBeNull();
    expect(stored.rows[1].已确认).toBe(false);
    expect(stored.columns.find((c: { key: string }) => c.key === 'amount').type).toBe('number');
    await page.getByRole('button', { name: '✏ 编辑/映射' }).click();
    await expect(page.getByRole('textbox', { name: '金额目标字段' })).toHaveValue('amount');
  });
});

test('来源慢请求：换链接、关闭与重编辑使旧结果失效', async ({ page, request }) => {
  const projectId = await emptyProject(request);
  await openSource(page, projectId);
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/SlowDoc');
  const started = page.waitForRequest(r => r.url().endsWith('/api/feishu/inspect'));
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  await started;
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/NewDoc');
  // Editing the URL alone must invalidate the request; no second detection yet.
  await page.waitForTimeout(1600);
  await expect(page.getByRole('textbox', { name: '任务目标字段' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '目标工作表' })).toHaveCount(0);
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  await expect(page.getByRole('combobox', { name: '目标工作表' })).toContainText('结构A');
  await expect(page.getByRole('textbox', { name: '飞书表格链接', exact: true })).toHaveValue('https://fixture.feishu.cn/sheets/NewDoc');
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  await expect(page.getByRole('textbox', { name: '飞书表格链接', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: '任务目标字段' })).toHaveCount(0);
  // Wait until the original upstream delay has elapsed; only the old request is simulated.
  await page.waitForTimeout(2600);
  await expect(page.getByRole('textbox', { name: '任务目标字段' })).toHaveCount(0);
});

test('B 新建计数、平均、分组、比率卡，预览发布刷新保持正确', async ({ page, request }) => {
  const { projectId, datasetA } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '任务数据A');
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  for (const [title, aggregation] of [['三条记录', '记录计数 (Count)'], ['有效平均', '数值平均 (Average)'], ['分组平均', '数值平均 (Average)'], ['金额比例', '比率转化 (分子 / 分母 加权比率)']]) {
    await test.step(`新建${title}并读取预览`, async () => {
      await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).first().click();
      await page.getByLabel('卡片标题', { exact: true }).fill(title);
      await choose(page, '指标计算方式', aggregation);
      if (title.includes('平均')) await choose(page, '目标计算字段', 'amount');
      if (title === '分组平均') {
        await choose(page, '展示呈现形式', '细分对比卡 (按维度分组列表)');
        await choose(page, '细分维度', 'group');
      }
      if (title === '金额比例') { await choose(page, '分子字段', 'amount'); await choose(page, '分母字段', 'amount'); }
      const preview = page.getByText('🔍 全量指标实时试算预览：').locator('..');
      await expect(preview).toContainText('[计算完成]');
      await expect(preview.locator('span').first()).toHaveText(title === '三条记录' ? '3' : title === '金额比例' ? '100.0%' : '15');
      await page.getByRole('button', { name: '保存并加入看板' }).click();
    });
  }
  await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  await page.reload();
  const cards = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
  expect(cards).toHaveLength(5);
  expect(cards.every((c: { id: string }) => c.id)).toBeTruthy();
  expect(JSON.parse(cards.find((c: { title: string }) => c.title === '三条记录').configJson).datasetId).toBe(datasetA.id);
  await expect(page.getByText('分组平均', { exact: true })).toBeVisible();
  await expect(page.getByText('10(1)', { exact: true })).toBeVisible();
});

for (const failure of ['500', '断网']) {
  test(`C 保存并切换${failure}保留草稿，重试成功后才切换`, async ({ page, request }, info) => {
    const { projectId } = await setup(request);
    await page.goto(`/projects/${projectId}`);
    await selectDataset(page, '任务数据A');
    await editTitle(page, `${failure}草稿`);
    await page.route('**/api/dashboards', route => {
      if (route.request().method() !== 'POST') return route.continue();
      return failure === '500' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"测试服务器保存失败"}' }) : route.abort('internetdisconnected');
    });
    await selectDataset(page, '任务数据B');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存修改', exact: true })).toBeEnabled();
    await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('任务数据A');
    const stored = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
    expect(stored[0].title).toBe('原始任务总数');
    await page.screenshot({ path: info.outputPath('failed-save-dialog.png') });
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await expect(page.getByText(`${failure}草稿`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('failed-save-preserved.png') });
    await page.unroute('**/api/dashboards');
    await selectDataset(page, '任务数据B');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('任务数据B');
    await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
    const confirmed = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
    expect(confirmed[0].title).toBe(`${failure}草稿`);
  });
}

test('取消编辑恢复原稿，删光保存刷新仍为空', async ({ page, request }) => {
  const { projectId } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await editTitle(page, '应该取消的修改');
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(page.getByText('原始任务总数', { exact: true })).toBeVisible();
  await expect(page.getByText('应该取消的修改', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('删除卡片', { exact: true }).click();
  await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  await page.reload();
  await expect(page.getByText('当前看板未添加任何指标卡片', { exact: true })).toBeVisible();
  expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards).toEqual([]);
});

test('D 日期范围经编辑试算发布GET刷新重新打开完整保存', async ({ page, request }) => {
  const { projectId } = await setup(request);
  const response = await request.post('/api/datasets', { data: { projectId, sourceId: 'date', name: '日期数据', rows: [
    { date: '2026-10-01T12:00:00+08:00' }, { date: '2026-10-02T00:00:00+08:00' }, { task: '没有日期' },
  ] }});
  expect(response.ok()).toBeTruthy();
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill('10月1日记录');
  await choose(page, '绑定数据集', '日期数据');
  await choose(page, '日期字段', 'date');
  await page.getByLabel('开始日期', { exact: true }).fill('2026-10-01');
  await page.getByLabel('结束日期', { exact: true }).fill('2026-10-01');
  const preview = page.getByText('🔍 全量指标实时试算预览：').locator('..');
  await expect(preview).toContainText('[计算完成]');
  await expect(preview.locator('span').first()).toHaveText('1');
  await page.getByRole('button', { name: '保存并加入看板' }).click();
  await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  const cards = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
  expect(JSON.parse(cards.find((c: { title: string }) => c.title === '10月1日记录').configJson)).toMatchObject({ from: '2026-10-01', to: '2026-10-01', dateField: 'date' });
  await page.reload();
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).last().click();
  await expect(page.getByLabel('开始日期', { exact: true })).toHaveValue('2026-10-01');
  await expect(page.getByLabel('结束日期', { exact: true })).toHaveValue('2026-10-01');
  await expect(page.getByRole('combobox', { name: '日期字段', exact: true })).toContainText('date');
});
