import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const SCREENSHOT_DIR = path.resolve('../docs/delivery-v1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function seedSecondProject() {
  console.log('通过 vite 加载 store 向独立库注入第二隔离项目验证数据...');
  const vite = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite/seed-browser',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    resolve: { alias: { '@': path.resolve('.') } }
  });

  const { db } = await vite.ssrLoadModule('/lib/db.ts');
  const store = await vite.ssrLoadModule('/lib/business-daily/store.ts');
  await store.ensureBusinessSchema();

  const now = new Date().toISOString();
  await db().prepare("INSERT OR IGNORE INTO projects(id,name,template_id,org_id,created_at,updated_at) VALUES('brand-b-project','二号新品牌项目','content_marketing','org-default',?,?)").bind(now, now).run();

  const config = {
    bindings: [
      { key: 'b_week', role: 'weekly', url: 'https://example.test/b_week' },
      { key: 'b_report', role: 'document', url: 'https://example.test/b_report' }
    ],
    alertThresholdPoints: 6,
    brands: ['二号品牌'],
    competitorWords: ['竞品A', '竞品B']
  };

  await store.configureBusiness('brand-b-project', config, 0);

  const headers = Array(59).fill(null);
  for (const [i, name] of [[1,'时间'],[13,'FS总预算'],[16,'小红星'],[28,'小红盟'],[40,'K金额'],[43,'F金额'],[44,'S金额'],[45,'KFSOPZ总金额'],[46,'P(评论)'],[47,'seo投资'],[48,'杂费-'],[49,'投流总金额'],[51,'KFSOPZ总结算金额']]) headers[i] = name;

  const bDailyRow = Array(59).fill(null);
  bDailyRow[1] = '2026-10-12';
  bDailyRow[13] = 400; // FS预算 400
  for (const i of [16,17,18,20,28,29,30,32]) bDailyRow[i] = 10;
  bDailyRow[40] = 60;  // K金额 60
  bDailyRow[43] = 120; // F金额 120
  bDailyRow[44] = 130; // S金额 130
  bDailyRow[49] = 250; // 投流 250
  bDailyRow[45] = 320; // 总投入 320
  bDailyRow[51] = 310; // 结算 310
  for (const start of [16,28]) {
    bDailyRow[start + 5] = 125;
    bDailyRow[start + 7] = 80;
    bDailyRow[start + 8] = 90;
    bDailyRow[start + 9] = 10;
    bDailyRow[start + 10] = 5;
    bDailyRow[start + 11] = 15;
  }

  const tableInput = {
    key: 'b_week',
    role: 'weekly',
    rows: [headers, Array(59).fill(null), bDailyRow],
    version: '1',
    capturedAt: now,
    url: 'https://example.test/b_week',
    complete: true,
    range: 'A1:BG10'
  };

  const docInput = {
    key: 'b_report',
    url: 'https://example.test/b_report',
    version: '1',
    capturedAt: now,
    year: 2026,
    content: '<h1>10月12日</h1><h2>今日待办</h2><p>二号定制品牌投放动作平稳推进。</p><h3>搜索侧日报</h3><p>聚焦高转化核心词。</p>'
  };

  await store.ingestBusinessBundle('brand-b-project', { tables: [tableInput], document: docInput });
  await vite.close();
  console.log('独立项目数据录入与入库完成！');
}

async function verifyBrowser() {
  console.log('启动 Playwright Chromium 访问 5246 端口第二项目真实页面...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const url = 'http://127.0.0.1:5246/projects/brand-b-project?tab=daily&day=2026-10-12';
  await page.goto(url, { waitUntil: 'networkidle' });

  const title = await page.title();
  console.log('页面标题:', title);

  const kpis = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.bd-kpis article')).map(el => ({
      label: el.querySelector('p')?.innerText,
      val: el.querySelector('strong')?.innerText
    }));
  });
  console.log('渲染的核心 KPI 列表:', kpis);

  const shotPath = path.join(SCREENSHOT_DIR, 'brand-b-project_rendered_view.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('已保存第二项目真实渲染截图:', shotPath);

  await browser.close();
}

async function main() {
  await seedSecondProject();
  await verifyBrowser();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});