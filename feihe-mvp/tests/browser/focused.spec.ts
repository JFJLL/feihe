import { test, expect } from './evidence';
import type { Page, APIRequestContext } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { focusedProject, focusedSource, firstSync, newFocusedCard, chooseFocused, focusedPreview } from './focused-helpers';

const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5187';
async function fixtureRows(request: APIRequestContext, documentToken: string, rows: unknown[][]) {
  expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken, rows: rows.map((row, i) => i === 0 ? [...row, 'status', 'budget', 'spent', 'owner'] : [...row, '已完成', 100, 10, '验收负责人']) } })).ok()).toBeTruthy();
}
async function storedDataset(request: APIRequestContext, projectId: string) {
  const list = (await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets;
  expect(list).toHaveLength(1);
  return (await (await request.get(`/api/datasets?projectId=${projectId}&id=${list[0].id}&all=true`)).json()).dataset;
}
async function publish(page: Page, projectId: string, request: APIRequestContext) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  return (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
}
async function openAnother(page: Page, title: string) {
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).first().click();
  await page.getByLabel('卡片标题', { exact: true }).fill(title);
}
async function average(page: Page, field: string, expected: string) {
  await chooseFocused(page, '指标计算方式', '数值平均 (Average)');
  await chooseFocused(page, '目标计算字段', field);
  await expect(focusedPreview(page).locator('span').first()).toHaveText(expected);
}
async function add(page: Page) {
  await page.getByRole('button', { name: '保存并加入看板', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function usable(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width + box!.x).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    const action = dialog.getByRole('button').last();
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
}
async function closeNotices(page: Page) {
  const notices = page.getByRole('button', { name: '关闭通知', exact: true });
  while (await notices.count()) await notices.first().click();
}

for (const width of [1280, 390]) {
  test(`历史百分口径确认 ${width}px：普通来源数值不被猜单位，明确百分点后保存刷新`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '历史单位确认');
    const token = 'FocusedLegacy-' + projectId;
    await fixtureRows(request, token, [['原百分数'], [0.5], [1.5]]);
    await focusedSource(page, projectId, token); await firstSync(page);
    const before = await storedDataset(request, projectId);
    expect(before.rows.map((r: Record<string, unknown>) => r['原百分数'])).toEqual([0.5, 1.5]);
    await newFocusedCard(page, projectId, '已确认的百分点');
    await average(page, '原百分数', '1');
    await chooseFocused(page, '显示格式', '百分比');
    await expect(page.getByRole('alert')).toContainText('请确认百分比数值口径');
    await expect(page.getByRole('button', { name: '保存并加入看板' })).toBeDisabled();
    await expect(focusedPreview(page)).not.toContainText('100.0%');
    await usable(page);
    await page.screenshot({ path: info.outputPath('legacy-unit-confirmation.png'), fullPage: true });
    await chooseFocused(page, '百分比数值口径', '百分点：0.5 = 0.5%');
    await expect(focusedPreview(page).locator('span').first()).toHaveText('1.0%');
    await add(page);
    const cards = await publish(page, projectId, request);
    expect(JSON.parse(cards.find((c: { title: string }) => c.title === '已确认的百分点').configJson).percentScale).toBe('percentage_points');
    await page.reload();
    await expect(page.getByRole('article', { name: '已确认的百分点' })).toContainText('1.0%');
    expect((await storedDataset(request, projectId)).rows).toEqual(before.rows);
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    await page.getByRole('article', { name: '已确认的百分点' }).getByTitle('编辑卡片').click();
    await expect(page.getByRole('combobox', { name: '百分比数值口径', exact: true })).toContainText('百分点');
  });
  test(`百分协议 ${width}px：六档文本和两种原生数值，预览发布刷新重编辑`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '百分协议验收');
    await test.step('页面接入并声明两种原生数值单位；映射与导入共用转换', async () => {
      const token = 'FocusedPercent-' + projectId;
      await fixtureRows(request, token, [['档位', '比例文本', '均值百分比', '直接比例', '直接百分点'], ['零值', '0%', '0.5%', 0.005, 0.5], ['半个百分点', '0.5%', '1.5%', 0.015, 1.5], ['一个百分点', '1%', '', '', ''], ['一点一个百分点', '1.1%', '', '', ''], ['百分之百', '100%', '', '', ''], ['百分之一百五十', '150%', '', '', '']]);
      await focusedSource(page, projectId, token);
      for (const field of ['直接比例', '直接百分点']) await chooseFocused(page, field + '数值单位', '百分比（存为比例小数）');
      await chooseFocused(page, '直接百分点来源百分比单位', '来源数值为百分点：0.5 = 0.5%');
      await expect(page.getByRole('table').last()).toContainText('0.005');
      await usable(page);
      await page.screenshot({ path: info.outputPath('percent-mapping.png'), fullPage: true });
      await firstSync(page);
      const stored = await storedDataset(request, projectId);
      expect(stored.rows.map((r: Record<string, unknown>) => r['比例文本'])).toEqual([0, 0.005, 0.01, 0.011, 1, 1.5]);
      expect(stored.rows.slice(0, 2).map((r: Record<string, unknown>) => [r['直接比例'], r['直接百分点']])).toEqual([[0.005, 0.005], [0.015, 0.015]]);
      for (const key of ['比例文本', '均值百分比', '直接比例', '直接百分点']) expect(stored.columns.find((c: { key: string }) => c.key === key)).toMatchObject({ type: 'number', numericUnit: 'percent', percentScale: 'fraction' });
    });
    await test.step('普通百分字段平均1.0%；卡片明确保存比例单位', async () => {
      await newFocusedCard(page, projectId, '普通百分平均');
      await average(page, '均值百分比', '1.0%');
      await expect(page.getByRole('combobox', { name: '百分比数值口径', exact: true })).toContainText('比例小数');
      await usable(page);
      await focusedPreview(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('small-percent-preview.png') });
      await add(page);
      for (const field of ['直接比例', '直接百分点']) {
        await openAnother(page, field + '平均'); await average(page, field, '1.0%'); await add(page);
      }
      await openAnother(page, '六档百分比分组');
      await average(page, '比例文本', '42.1%');
      await chooseFocused(page, '展示呈现形式', '细分对比卡 (按维度分组列表)');
      await chooseFocused(page, '细分维度', '档位');
      await add(page);
      const cards = await publish(page, projectId, request);
      for (const title of ['普通百分平均', '直接比例平均', '直接百分点平均', '六档百分比分组']) expect(JSON.parse(cards.find((c: { title: string }) => c.title === title).configJson)).toMatchObject({ format: 'percent', percentScale: 'fraction' });
    });
    await test.step('刷新读取真实发布配置，六档显示无阈值跳变，重新编辑口径不丢', async () => {
      await page.reload();
      for (const title of ['普通百分平均', '直接比例平均', '直接百分点平均']) await expect(page.getByRole('article', { name: title, exact: true })).toContainText('1.0%');
      const group = page.getByRole('article', { name: '六档百分比分组', exact: true });
      await group.getByRole('button', { name: '显示全部分组' }).click();
      const rows = group.getByTestId('metric-group');
      for (const [i, text] of ['0.0%', '0.5%', '1.0%', '1.1%', '100.0%', '150.0%'].entries()) await expect(rows.nth(i).locator('strong')).toContainText(text);
      await usable(page);
      await page.screenshot({ path: info.outputPath('small-percent-published.png'), fullPage: true });
      await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
      await page.getByRole('article', { name: '普通百分平均', exact: true }).getByTitle('编辑卡片', { exact: true }).click();
      await expect(page.getByRole('combobox', { name: '百分比数值口径', exact: true })).toContainText('比例小数');
      await expect(focusedPreview(page).locator('span').first()).toHaveText('1.0%');
      const format = page.getByRole('combobox', { name: '百分比数值口径', exact: true });
      await format.focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.screenshot({ path: info.outputPath('percent-scale-selector.png') });
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('article', { name: '普通百分平均', exact: true }).getByTitle('编辑卡片')).toBeFocused();
    });
  });

  for (const failure of ['500', '断网', '样本外必填']) {
    test(`首次同步 ${failure} ${width}px：配置真实保存后失败，关闭重开复用原ID`, async ({ page, request }, info) => {
      await page.setViewportSize({ width, height: 844 });
      const projectId = await focusedProject(request, '来源重试验收');
      const saves: string[] = [];
      page.on('request', r => { if (r.url().endsWith('/api/projects') && r.method() === 'POST' && r.postDataJSON()?.action === 'save_source') saves.push(r.postData()!); });
      await focusedSource(page, projectId, failure === '样本外必填' ? 'FocusedLateRequiredDoc' : 'FocusedRatioDoc');
      if (failure === '样本外必填') await page.getByRole('checkbox', { name: '金额必填', exact: true }).check();
      else {
        let first = true;
        await page.route('**/api/feishu/sync', route => {
          if (route.request().method() !== 'POST' || !first) return route.continue();
          first = false;
          return failure === '500' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '首次同步注入500' }) }) : route.abort('internetdisconnected');
        });
      }
      const saved = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().method() === 'POST' && r.request().postDataJSON()?.action === 'save_source');
      await page.getByRole('button', { name: '✓ 保存并首次同步' }).dblclick();
      const saveResponse = await saved;
      expect(saveResponse.status()).toBe(200);
      const sourceId = (await saveResponse.json()).id;
      await expect(page.getByTestId('source-save-status')).toContainText('配置已保存，同步未成功');
      await expect(page.getByTestId('source-save-status')).toContainText(sourceId);
      expect(saves).toHaveLength(1);
      const failureSources = (await (await request.get('/api/projects')).json()).sources.filter((s: { projectId: string }) => s.projectId === projectId);
      expect(failureSources.map((s: { id: string }) => s.id)).toEqual([sourceId]);
      await writeFile(info.outputPath('configuration-saved-failure-sources.json'), JSON.stringify({ projectId, saveStatus: saveResponse.status(), sourceId, sources: failureSources }, null, 2));
      expect((await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets).toEqual([]);
      if (failure === '样本外必填') await expect(page.getByTestId('source-save-status')).toContainText('必填');
      await usable(page);
      await page.screenshot({ path: info.outputPath('configuration-saved-sync-failed.png'), fullPage: true });
      await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
      await expect(page.getByText('共 1 个配置', { exact: true })).toBeVisible();
      await expect(page.getByText(/配置已保存，同步未成功：/)).toBeVisible();
      await closeNotices(page);
      await usable(page);
      await page.screenshot({ path: info.outputPath('failed-source-list.png'), fullPage: true });
      const hydrated = page.waitForResponse(r => r.url().includes('/api/feishu/sync?projectId=' + projectId));
      await page.reload(); await hydrated;
      await expect(page.getByText('共 1 个配置', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '✏ 编辑/映射' }).click();
      await expect(page.getByRole('textbox', { name: failure === '样本外必填' ? '金额目标字段' : '成交目标字段', exact: true })).toBeVisible();
      if (failure === '样本外必填') {
        await expect(page.getByRole('checkbox', { name: '金额必填', exact: true })).toBeChecked();
        await page.getByRole('checkbox', { name: '金额必填', exact: true }).uncheck();
      }
      const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
      await page.getByRole('button', { name: /保存映射并重试同步|^重试同步$/ }).click();
      const syncedResponse = await synced;
      expect(syncedResponse.status()).toBe(200);
      expect(syncedResponse.request().postDataJSON().sourceId).toBe(sourceId);
      expect(JSON.parse(saves.at(-1)!).id).toBe(sourceId);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const workspace = await (await request.get('/api/projects')).json();
      expect(workspace.sources.filter((s: { projectId: string }) => s.projectId === projectId).map((s: { id: string }) => s.id)).toEqual([sourceId]);
      await writeFile(info.outputPath('retry-success-sources.json'), JSON.stringify({ projectId, sourceId, sources: workspace.sources.filter((s: { projectId: string }) => s.projectId === projectId) }, null, 2));
      const stored = await storedDataset(request, projectId);
      expect(stored.sourceId).toBe(sourceId);
      expect(stored.rowCount).toBe(failure === '样本外必填' ? 12 : 2);
      await expect(page.getByText('同步成功', { exact: true })).toBeVisible();
      await closeNotices(page);
      await page.screenshot({ path: info.outputPath('original-id-retry-success.png'), fullPage: true });
      await page.goto(`/projects/${projectId}`);
      await page.getByRole('button', { name: /📋 数据明细/ }).click();
      await expect(page.getByRole('table')).toContainText(failure === '样本外必填' ? '任务12' : '互补');
      await usable(page);
    });
  }

  test(`比率样本 ${width}px：互补缺失、完整行、独立汇总及补零经真实同步发布`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '比率口径验收');
    const token = 'FocusedRatio-' + projectId;
    const holes = [['分组', '成交', '咨询'], ['互补', '10', ''], ['互补', '', '100']];
    await fixtureRows(request, token, holes);
    await focusedSource(page, projectId, token); await firstSync(page);
    await newFocusedCard(page, projectId, '成对转化率');
    await chooseFocused(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
    await chooseFocused(page, '分子字段', '成交'); await chooseFocused(page, '分母字段', '咨询');
    await chooseFocused(page, '细分维度', '分组');
    await expect(focusedPreview(page).locator('span').first()).toHaveText('—');
    await expect(focusedPreview(page)).toContainText('成对有效 0 行');
    await expect(focusedPreview(page)).toContainText('分子有效 1/2（50.0%）');
    await usable(page);
    await focusedPreview(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('complementary-missing-preview.png') });
    await add(page); await publish(page, projectId, request); await page.reload();
    await expect(page.getByRole('article', { name: '成对转化率' })).toContainText('成对有效 0 行');
    await page.screenshot({ path: info.outputPath('complementary-missing-published.png'), fullPage: true });
    await fixtureRows(request, token, [...holes, ['完整', '20', '100']]);
    const ready = page.waitForResponse(r => r.url().includes('/api/feishu/sync?projectId=' + projectId));
    await page.goto(`/projects/${projectId}/settings?tab=data-sources`); await ready;
    const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '立即同步', exact: true }).click(); expect((await synced).status()).toBe(200);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole('article', { name: '成对转化率' })).toContainText('20.0%');
    await expect(page.getByRole('article', { name: '成对转化率' })).toContainText('成对有效 1 行');
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    for (const [title, basis, policy, expected] of [['独立总量比', '独立汇总（分别求和）', '缺失不补零（忽略空值）', '15.0%'], ['明确补零比率', '成对有效行（默认）', '明确补零', '15.0%']]) {
      await openAnother(page, title);
      await chooseFocused(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
      await chooseFocused(page, '分子字段', '成交'); await chooseFocused(page, '分母字段', '咨询');
      await chooseFocused(page, '比率样本口径', basis); await chooseFocused(page, '缺失值规则', policy);
      await chooseFocused(page, '细分维度', '分组');
      await expect(focusedPreview(page).locator('span').first()).toHaveText(expected);
      await expect(focusedPreview(page)).toContainText('分子有效 2/3（66.7%）');
      await expect(focusedPreview(page)).toContainText('分母有效 2/3（66.7%）');
      await expect(focusedPreview(page)).toContainText('成对有效 1 行');
      await add(page);
    }
    const cards = await publish(page, projectId, request);
    expect(JSON.parse(cards.find((c: { title: string }) => c.title === '独立总量比').configJson)).toMatchObject({ ratioBasis: 'independent', missingPolicy: 'skip' });
    await page.reload();
    const independent = page.getByRole('article', { name: '独立总量比', exact: true });
    await expect(independent).toContainText('15.0%'); await expect(independent).toContainText('独立汇总');
    await expect(independent.getByTestId('metric-group').first()).toContainText('10.0%');
    const paired = page.getByRole('article', { name: '成对转化率', exact: true });
    await expect(paired.getByTestId('metric-group').first().locator('strong')).toContainText('—');
    await expect(paired.getByTestId('metric-group').first()).toContainText('成对有效 0 行');
    await expect(page.getByRole('article', { name: '明确补零比率' })).toContainText('明确补零，参与计算 3 行');
    await usable(page);
    await page.screenshot({ path: info.outputPath('paired-independent-zero-published.png'), fullPage: true });
    await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
    await independent.getByTitle('编辑卡片').click();
    await expect(page.getByRole('combobox', { name: '比率样本口径', exact: true })).toContainText('独立汇总');
    await expect(focusedPreview(page).locator('span').first()).toHaveText('15.0%');
    await page.getByRole('combobox', { name: '比率样本口径', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.screenshot({ path: info.outputPath('ratio-basis-selector.png') });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
