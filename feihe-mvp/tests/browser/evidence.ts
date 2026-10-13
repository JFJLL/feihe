import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export const test = base.extend<{ evidence: void }>({
  evidence: [async ({ page, request }, use, info) => {
    const requests: unknown[] = [];
    const projectIds = new Set<string>();
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const body = response.request().postData();
        const id = new URL(response.url()).searchParams.get('projectId');
        if (id) projectIds.add(id);
        try { const data = JSON.parse(body || '{}'); if (data.projectId) projectIds.add(data.projectId); } catch {}
        requests.push({ url: response.url(), method: response.request().method(), status: response.status(), body });
      }
    });
    await use();
    const requestsPath = info.outputPath('key-requests.json');
    await writeFile(requestsPath, JSON.stringify(requests, null, 2));
    await info.attach('关键请求', { path: requestsPath, contentType: 'application/json' });
    const persistence: unknown[] = [];
    for (const projectId of projectIds) {
      const query = '?projectId=' + encodeURIComponent(projectId);
      const project = await (await request.get('/api/projects' + query)).json();
      const dashboard = await (await request.get('/api/dashboards' + query)).json();
      const datasets = await (await request.get('/api/datasets' + query)).json();
      const details = [];
      for (const dataset of datasets.datasets || []) details.push(await (await request.get('/api/datasets' + query + '&id=' + encodeURIComponent(dataset.id) + '&all=true')).json());
      persistence.push({ projectId, project: project.project, readiness: project.readiness, dashboard, datasets: details });
    }
    const persistencePath = info.outputPath('persistence.json');
    await writeFile(persistencePath, JSON.stringify(persistence, null, 2));
    await info.attach('实际持久化快照', { path: persistencePath, contentType: 'application/json' });
    if (!page.isClosed()) {
      const screenshotPath = info.outputPath('final-page.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await info.attach('最终页面', { path: screenshotPath, contentType: 'image/png' });
    }
  }, { auto: true }],
});
export { expect };
