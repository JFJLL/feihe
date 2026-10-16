import { test, expect } from './evidence';
import { setup, selectDataset } from './helpers';
import type { Page } from '@playwright/test';

async function choose(page: Page, name: string, option: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function add(page: Page, title: string) {
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).first().click();
  await page.getByRole('button', { name: '高级：独立卡片', exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill(title);
}

test('旧模板改为自定义求和后显示30，保存刷新仍按新配置计算', async ({ page, request }) => {
  const { projectId } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).click();
  await choose(page, '指标计算方式', '数值求和 (Sum)');
  await choose(page, '目标计算字段', 'amount');
  const preview = page.getByText('🔍 全量指标实时试算预览：').locator('..');
  await expect(preview.locator('span').first()).toHaveText('30');
  await page.getByRole('button', { name: '保存并加入看板' }).click();
  await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  await page.reload();
  const cards = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
  expect(JSON.parse(cards[0].configJson)).toMatchObject({ mode: 'custom', metric: 'custom', aggregation: 'sum', field: 'amount' });
  await expect(page.getByText('30', { exact: true })).toBeVisible();
});

test('预览乱序忽略旧值，500错误清除成功预览并禁止加入', async ({ page, request }) => {
  const { projectId, datasetA } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '任务数据A');
  await page.route('**/api/metrics', async route => {
    const body = route.request().postDataJSON();
    if (body.card?.datasetId === datasetA.id && body.card.title === '慢试算') {
      const actual = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 800));
      await route.fulfill({ response: actual }).catch(() => {});
    } else await route.continue();
  });
  await add(page, '慢试算');
  await choose(page, '绑定数据集', '任务数据B');
  const preview = page.getByText('🔍 全量指标实时试算预览：').locator('..');
  await expect(preview.locator('span').first()).toHaveText('1');
  await page.waitForTimeout(1000);
  await expect(preview.locator('span').first()).toHaveText('1');
  await page.unroute('**/api/metrics');
  await page.route('**/api/metrics', route => route.request().postDataJSON().card ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"试算失败证据"}' }) : route.continue());
  await page.getByLabel('卡片标题', { exact: true }).fill('失败的新配置');
  await expect(page.getByRole('alert')).toContainText('试算失败证据');
  await expect(preview.locator('span')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存并加入看板' })).toBeDisabled();
  expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards[0].title).toBe('原始任务总数');
});

test('数据集迟到响应、搜索和金额显示名均使用当前内容和存储key', async ({ page, request }) => {
  const { projectId, datasetA } = await setup(request);
  expect((await request.post('/api/datasets', { data: { projectId, sourceId: 'b', name: '任务数据B', rows: [{ task: '最新B', amount: 100 }], columns: [{ key: 'task', name: '任务', type: 'text' }, { key: 'amount', name: '金额', type: 'number' }] } })).ok()).toBeTruthy();
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '任务数据B');
  await page.getByRole('button', { name: /数据明细/ }).click();
  await expect(page.getByRole('columnheader', { name: '金额', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '100', exact: true })).toBeVisible();
  await page.route('**/api/datasets?**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('id') === datasetA.id || url.searchParams.get('search') === '旧搜索') {
      const actual = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 700));
      await route.fulfill({ response: actual }).catch(() => {});
    } else await route.continue();
  });
  await selectDataset(page, '任务数据A');
  await selectDataset(page, '任务数据B');
  await page.getByPlaceholder('全量搜索记录关键字…').fill('旧搜索');
  await page.getByPlaceholder('全量搜索记录关键字…').fill('最新B');
  await expect(page.getByRole('cell', { name: '最新B', exact: true })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByRole('cell', { name: '最新B', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '100', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('任务数据B');
});

test('数据更新使当前页越界时自动校正重读，同时保留编辑草稿', async ({ page, request }) => {
  const { projectId } = await setup(request);
  const sourceId = projectId + '-page';
  const documentToken = 'PageDoc' + projectId;
  expect((await request.post((process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5187') + '/__fixture/page-sheet', { data: { documentToken, rowCount: 31 } })).ok()).toBeTruthy();
  expect((await request.post('/api/projects', { data: { action: 'save_source', projectId, id: sourceId, name: '分页业务', spreadsheet: 'https://fixture.feishu.cn/sheets/' + documentToken, sheetId: 'sheetA', kind: 'general', mappingJson: JSON.stringify([{ sourceField: '任务', targetField: 'task', type: 'text' }, { sourceField: '金额', targetField: 'amount', type: 'number' }]) } })).ok()).toBeTruthy();
  expect((await request.post('/api/feishu/sync', { data: { projectId, sourceId } })).ok()).toBeTruthy();
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '分页业务');
  await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('分页业务 (31 行)');
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill('分页刷新草稿');
  await page.getByRole('button', { name: '保存并加入看板' }).click();
  await page.getByRole('button', { name: /数据明细/ }).click();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByText('共 31 条记录 · 第 2 / 3 页')).toBeVisible();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByRole('cell', { name: '分页任务31', exact: true })).toBeVisible();
  // Change only the external vendor fixture, then use the real page sync button.
  expect((await request.post((process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5187') + '/__fixture/page-sheet', { data: { documentToken, rowCount: 1 } })).ok()).toBeTruthy();
  await page.getByRole('button', { name: '同步最新数据', exact: true }).click();
  await expect(page.getByText('共 1 条记录 · 第 1 / 1 页')).toBeVisible();
  await expect(page.getByRole('cell', { name: '更新后唯一任务', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '📊 看板视图', exact: true }).click();
  await expect(page.getByText('分页刷新草稿', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toBeVisible();
  expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards[0].title).toBe('原始任务总数');
});

test('保存中冻结快照且重复操作只提交一次真实请求', async ({ page, request }) => {
  const { projectId } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill('单次冻结快照');
  await page.getByRole('button', { name: '保存并加入看板' }).click();
  let submissions = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/dashboards', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    submissions++; await gate; await route.continue();
  });
  await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  await expect(page.getByRole('button', { name: '正在发布…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toBeDisabled();
  await expect(page.getByTitle('编辑卡片', { exact: true })).toHaveCount(0);
  expect(submissions).toBe(1);
  release();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  expect(submissions).toBe(1);
  const stored = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
  expect(stored[0].title).toBe('单次冻结快照');
});

test('评论质检与投放分析进入各自业务主体，数据导航URL和标签一致', async ({ page, request }) => {
  for (const templateId of ['comment_qc', 'ad_performance']) {
    const created = await request.post('/api/projects', { data: { action: 'create', id: `template-${templateId}-${Date.now()}`, name: templateId, templateId } });
    expect(created.ok()).toBeTruthy();
    const projectId = (await created.json()).id;
    await page.goto(`/projects/${projectId}`);
    if (templateId === 'ad_performance') {
      await expect(page.getByTestId('ad-performance-overview')).toBeVisible();
      await expect(page.getByRole('heading', { name: '广告消耗趋势' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '投放点击效率' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: '评论运营', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: '消费者反馈情感结构' })).toBeVisible();
      await page.getByRole('button', { name: '前往处置工作台查看与闭环评论 →' }).click();
      await expect(page.getByRole('heading', { name: /处置/ }).first()).toBeVisible();
    }
    await expect(page.getByText('决策层 · 今日指标与待办', { exact: true })).toHaveCount(0);
  }
  const { projectId } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).waitFor();
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/data$`));
  await expect(page.getByRole('heading', { name: '数据工作台', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '数据源', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('link', { name: '数据管理', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: '项目设置', exact: true })).not.toHaveAttribute('aria-current', 'page');
});
