import { expect, type APIRequestContext, type Page } from '@playwright/test';
export async function setup(request: APIRequestContext) {
  const created = await request.post('/api/projects', { data: {
    action: 'create', id: `repro-${Date.now()}`, name: '定向返修测试', templateId: 'general_workbench',
  }});
  expect(created.ok()).toBeTruthy();
  const p = await created.json();
  const projectId = p.id || p.project?.id;
  expect(projectId).toBeTruthy();
  const rows = [{ task: '任务1', amount: 10, group: '同组' }, { task: '任务2', amount: null, group: '同组' }, { task: '任务3', amount: 20, group: '另一组' }];
  const a = await request.post('/api/datasets', { data: { projectId, sourceId: 'a', name: '任务数据A', rows } });
  expect(a.ok()).toBeTruthy();
  const datasetA = (await a.json()).dataset;
  const b = await request.post('/api/datasets', { data: { projectId, sourceId: 'b', name: '任务数据B', rows: [{ task: '其他', amount: 100 }] } });
  expect(b.ok()).toBeTruthy();
  const datasetB = (await b.json()).dataset;
  const saved = await request.post('/api/dashboards', { data: { projectId, cards: [{
    title: '原始任务总数', type: 'metric_card', config: { metric: 'task_total', datasetId: datasetA.id },
  }] }});
  expect(saved.ok()).toBeTruthy();
  return { projectId, datasetA, datasetB, dashboard: await saved.json() };
}

export async function selectDataset(page: Page, name: string) {
  await page.getByRole('combobox', { name: '当前业务数据集', exact: true }).click();
  await page.getByRole('option', { name: new RegExp(name) }).click();
}
