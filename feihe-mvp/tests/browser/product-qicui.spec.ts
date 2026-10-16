import { test, expect } from './evidence';
import { syncQicuiHistory, seedHistoricQicuiAction } from './qicui-journey';
import { readFile } from 'node:fs/promises';
import { DEFAULT_BUSINESS_COMPONENTS } from '../../lib/business-components';

test('启萃报告反例：四表真实同步后的专属内容与投放报告可以从页面生成保存', async ({ page, request }, info) => {
  const before = await syncQicuiHistory(page, request);
  await page.screenshot({ path: info.outputPath('qicui-business-before-report.png'), fullPage: true });
  await page.goto('/projects/qicui/reports');
  await expect(page.getByRole('heading', { name: '生成当前范围的报告', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('qicui-report-before-generate.png'), fullPage: true });
  await page.getByRole('button', { name: '生成并保存报告', exact: true }).click();
  const reads = page.getByRole('article', { name: '已同步内容阅读量报告结果', exact: true });
  await expect(reads).toContainText(Number(before.metrics.readCount).toLocaleString('zh-CN'));
  const actual = await (await request.get('/api/reports?projectId=qicui', { headers: { 'x-user-id': 'user-editor' } })).json();
  expect(actual.report.spec.business.snapshot.metrics.readCount).toBe(90000);
  expect(actual.report.spec.business.snapshot.feishu.daily.at(-1).actual_spend).toBe(400);
  expect(actual.report.spec.summary.join('')).not.toContain('当前已同步聚光投放与灵犀母婴大盘');
  await info.attach('专属业务报告真实响应', { body: JSON.stringify(actual, null, 2), contentType: 'application/json' });
});

for (const width of [1280, 390]) {
  test('启萃完整业务与报告 '+width+'px：既有规则、真实处置、周期、历史与只读导出一致', async ({ page, request }, info) => {
    await page.setViewportSize({width,height:900}); await syncQicuiHistory(page,request);
    const item=await seedHistoricQicuiAction(String(width));
    const editor={'x-user-id':'user-editor'};
    expect((await request.post('/api/projects',{headers:editor,data:{action:'add_member',projectId:'qicui',userId:'user-project-manager',role:'editor'}})).status()).toBe(200);
    expect((await request.post('/api/projects',{headers:editor,data:{action:'add_member',projectId:'qicui',userId:'user-viewer',role:'viewer'}})).status()).toBe(200);
    await page.goto('/projects/qicui/reports'); await page.getByRole('button',{name:'生成并保存报告',exact:true}).click();
    await expect(page.getByRole('article',{name:'已同步内容阅读量报告结果',exact:true})).toContainText('90,000');
    const old=await (await request.get('/api/reports?projectId=qicui',{headers:editor})).json();
    expect(old.report.spec.business.acceptance).toMatchObject({reportCount:200,baseCount:30,brandTopRate:0.4});
    const oldHandled=Number(old.report.spec.business.snapshot.metrics.actions.handled||0);
    await page.context().setExtraHTTPHeaders({'x-user-id':'user-project-manager'});
    await page.goto('/projects/qicui/comments?legacy=1&tab=actions');
    const row=page.getByRole('row').filter({hasText:item.content}); await expect(row).toBeVisible();
    await page.screenshot({path:info.outputPath('qicui-business-pending-action.png'),fullPage:true});
    const resolved=page.waitForResponse(response=>response.url().endsWith('/api/actions/workbench')&&response.request().method()==='POST');
    await row.getByRole('button',{name:'标记已回复',exact:true}).click(); expect((await resolved).status()).toBe(200);
    await page.locator('select:has(option[value="handled"])').selectOption('handled'); await expect(row).toContainText('已处理');
    await page.reload(); await expect(row).toContainText('已处理');
    const persisted=await (await request.get('/api/actions/workbench?projectId=qicui&source=key-comment&status=handled&query='+encodeURIComponent(item.content),{headers:{'x-user-id':'user-project-manager'}})).json();
    expect(persisted.items).toHaveLength(1); expect(persisted.items[0].status).toBe('handled');
    await page.screenshot({path:info.outputPath('qicui-business-resolved-action.png'),fullPage:true});
    await page.goto('/projects/qicui/reports');
    await page.getByLabel('项目开始日期',{exact:true}).fill('2026-09-30'); await page.getByLabel('项目结束日期',{exact:true}).fill('2026-09-30');
    const generated=page.waitForResponse(response=>response.url().endsWith('/api/reports')&&response.request().method()==='POST');
    await page.getByRole('button',{name:'生成并保存报告',exact:true}).click(); const generatedResponse=await generated; expect(generatedResponse.status()).toBe(200); const report=await generatedResponse.json();
    for(const metric of report.spec.metrics.filter((item: { result: { status: string } })=>item.result.status==='needs_configuration')) { expect(metric.result.value).toBeNull(); await expect(page.getByRole('article',{name:metric.title+'报告结果',exact:true})).toContainText('未计算'); }
    expect(report.spec.business.snapshot.metrics.readCount).toBe(70000); expect(report.spec.business.snapshot.metrics.noteCount).toBe(2);
    expect(report.spec.business.snapshot.feishu.daily).toHaveLength(1); expect(report.spec.business.snapshot.feishu.daily[0]).toMatchObject({actual_spend:400,plan_spend:500,feed_ctr:2,search_ctr:3});
    expect(report.spec.business.snapshot.metrics.actions.handled).toBe(oldHandled+1);
    await expect(page.getByRole('article',{name:'范围内实际投放消耗报告结果',exact:true})).toContainText('400');
    await page.getByText('投放计划与实际日报',{exact:true}).click(); const daily=page.getByRole('table',{name:'投放计划与实际日报',exact:true}); await expect(daily).toContainText('2.00%'); await expect(daily).toContainText('3.00%');
    await page.getByText('启萃既有评论验收规则',{exact:true}).click(); await expect(page.getByRole('table',{name:'启萃既有评论验收规则',exact:true})).toContainText('200');
    await page.screenshot({path:info.outputPath('qicui-special-report-published.png'),fullPage:true});
    await page.reload(); await expect(page.getByLabel('项目开始日期',{exact:true})).toHaveValue('2026-09-30');
    await page.getByRole('button',{name:'查看报告 '+old.report.id,exact:true}).click(); await expect(page.getByRole('article',{name:'已同步内容阅读量报告结果',exact:true})).toContainText('90,000');
    expect((await (await request.get('/api/reports?projectId=qicui&id='+old.report.id,{headers:editor})).json()).report.spec).toEqual(old.report.spec);
    await page.context().setExtraHTTPHeaders({'x-user-id':'user-viewer'}); await page.goto('/projects/qicui/comments?legacy=1&tab=actions&status=handled'); await expect(row).toContainText('已处理');
    await expect(page.getByRole('button',{name:/标记已回复|标记已处理|标记已删除|移除|生成本批次判定/})).toHaveCount(0);
    await page.goto('/projects/qicui/reports?id='+report.reportId); await expect(page.getByRole('button',{name:'生成并保存报告',exact:true})).toHaveCount(0);
    await expect(page.getByRole('article',{name:'已同步内容阅读量报告结果',exact:true})).toContainText('70,000');
    const downloading=page.waitForEvent('download'); await page.getByRole('link',{name:'导出当前报告 HTML',exact:true}).click(); const download=await downloading; await download.saveAs(info.outputPath('qicui-viewer-report.html'));
    const html=await readFile(info.outputPath('qicui-viewer-report.html'),'utf8'); expect(html).toContain('70,000'); expect(html).toContain('2.00%'); expect(html).toContain('启萃既有评论验收规则'); expect(html).not.toContain('BeBeBus');
    await info.attach('启萃已保存快照',{body:JSON.stringify(report,null,2),contentType:'application/json'}); await page.screenshot({path:info.outputPath('qicui-viewer-special-report.png'),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  });
  test('启萃报告失败恢复 '+width+'px：500、断网与真实409保留范围、旧快照并允许真实重试', async ({ page, request }, info) => {
    await page.setViewportSize({width,height:900}); await syncQicuiHistory(page,request); const headers={'x-user-id':'user-editor'};
    await page.goto('/projects/qicui/reports'); await page.getByRole('button',{name:'生成并保存报告',exact:true}).click(); await expect(page.getByRole('article',{name:'已同步内容阅读量报告结果',exact:true})).toContainText('90,000');
    await page.getByLabel('项目开始日期',{exact:true}).fill('2026-09-29'); await page.getByLabel('项目结束日期',{exact:true}).fill('2026-09-30');
    const before=await (await request.get('/api/reports?projectId=qicui',{headers})).json();
    for (const failure of ['500','network']) {
      await page.route('**/api/reports',route=>route.request().method()==='POST' ? failure==='500' ? route.fulfill({status:500,contentType:'application/json',body:'{"ok":false,"error":"受控报告保存失败"}'}) : route.abort('failed') : route.continue());
      await page.getByRole('button',{name:'生成并保存报告',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('当前范围和历史报告仍保留');
      await expect(page.getByLabel('项目开始日期',{exact:true})).toHaveValue('2026-09-29'); await expect(page.getByLabel('项目结束日期',{exact:true})).toHaveValue('2026-09-30');
      await expect(page.getByRole('article',{name:'已同步内容阅读量报告结果',exact:true})).toContainText('90,000');
      expect((await (await request.get('/api/reports?projectId=qicui',{headers})).json()).total).toBe(before.total);
      await page.getByRole('region',{name:'报告生成范围',exact:true}).screenshot({path:info.outputPath('qicui-report-'+failure+'-range-preserved.png')}); await page.unroute('**/api/reports');
    }
    const board=await (await request.get('/api/dashboards?projectId=qicui',{headers})).json();
    expect((await request.post('/api/dashboards',{headers,data:{projectId:'qicui',action:'set_components',version:board.dashboards[0].version,components:JSON.parse(board.dashboards[0].layoutJson).businessComponents||DEFAULT_BUSINESS_COMPONENTS}})).status()).toBe(200);
    const conflict=page.waitForResponse(response=>response.url().endsWith('/api/reports')&&response.request().method()==='POST'); await page.getByRole('button',{name:'生成并保存报告',exact:true}).click(); expect((await conflict).status()).toBe(409);
    await expect(page.getByRole('alert')).toContainText('当前范围和历史报告仍保留'); await expect(page.getByLabel('项目开始日期',{exact:true})).toHaveValue('2026-09-29');
    expect((await (await request.get('/api/reports?projectId=qicui',{headers})).json()).total).toBe(before.total); await page.getByRole('region',{name:'报告生成范围',exact:true}).screenshot({path:info.outputPath('qicui-report-409-range-preserved.png')});
    const content=page.getByRole('combobox',{name:'报告内容',exact:true}); await content.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible(); await page.screenshot({path:info.outputPath('qicui-report-content-selector.png')}); await page.keyboard.press('Escape'); await expect(content).toBeFocused();
    const retried=page.waitForResponse(response=>response.url().endsWith('/api/reports')&&response.request().method()==='POST'); await page.getByRole('button',{name:'生成并保存报告',exact:true}).focus(); await page.keyboard.press('Enter'); expect((await retried).status()).toBe(200);
    await expect(page.getByRole('alert')).toHaveCount(0); expect((await (await request.get('/api/reports?projectId=qicui',{headers})).json()).total).toBe(before.total+1);
    await page.reload(); await expect(page.getByLabel('项目开始日期',{exact:true})).toHaveValue('2026-09-29'); await expect(page.getByRole('article',{name:'范围内实际投放消耗报告结果',exact:true})).toContainText('700');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  });
}
