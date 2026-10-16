import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const SCREENSHOT_DIR = path.resolve('../docs/delivery-v1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function seedSecondProjectWithRichData() {
  console.log('1. 通过 Vite 加载 store 向独立库录入包含专有品牌、预算与自定义核心词的完整 fixture...');
  const vite = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite/seed-rich-second',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    resolve: { alias: { '@': path.resolve('.') } }
  });

  const { db } = await vite.ssrLoadModule('/lib/db.ts');
  const store = await vite.ssrLoadModule('/lib/business-daily/store.ts');
  await store.ensureBusinessSchema();

  const now = '2026-10-14T10:00:00Z';
  await db().prepare("INSERT OR IGNORE INTO projects(id,name,template_id,org_id,created_at,updated_at) VALUES('brand-b-project','二号新品牌项目','content_marketing','org-default',?,?)").bind(now, now).run();

  // 1.1 专有配置（完全自定义品牌、独立阈值、独立绑定）
  const config = {
    bindings: [
      { key: 'b_week', role: 'weekly', url: 'https://example.test/b_week' },
      { key: 'b_plan', role: 'budget_plan', url: 'https://example.test/b_plan' },
      { key: 'b_kw', role: 'keywords', url: 'https://example.test/b_kw' },
      { key: 'b_kw_notes', role: 'keyword_notes', url: 'https://example.test/b_kw_notes' },
      { key: 'b_report', role: 'document', url: 'https://example.test/b_report' }
    ],
    alertThresholdPoints: 8,
    brands: ['二号有机'],
    competitorWords: ['竞品A', '竞品B']
  };

  // 通过配置函数写入
  const current = await db().prepare('SELECT version FROM business_project_config WHERE project_id=?').bind('brand-b-project').first();
  await store.configureBusiness('brand-b-project', config, current?.version || 0);

  // 1.2 周趋势底表（消耗 450, 结算 520, K金额 80）
  const headers = Array(59).fill(null);
  for (const [i, name] of [[1,'时间'],[13,'FS总预算'],[16,'小红星'],[28,'小红盟'],[40,'K金额'],[43,'F金额'],[44,'S金额'],[45,'KFSOPZ总金额'],[46,'P(评论)'],[47,'seo投资'],[48,'杂费-'],[49,'投流总金额'],[51,'KFSOPZ总结算金额']]) headers[i] = name;

  const bDailyRow = Array(59).fill(null);
  bDailyRow[1] = '2026-10-12';
  bDailyRow[13] = 500;
  for (const i of [16,17,18,20,28,29,30,32]) bDailyRow[i] = 20;
  bDailyRow[40] = 80;  // K金额 80
  bDailyRow[43] = 220; // F金额 220
  bDailyRow[44] = 230; // S金额 230
  bDailyRow[49] = 450; // 投流 450
  bDailyRow[45] = 580; // 总投入 580
  bDailyRow[51] = 520; // 结算 520
  for (const start of [16,28]) {
    bDailyRow[start + 5] = 225;
    bDailyRow[start + 7] = 120;
    bDailyRow[start + 8] = 130;
    bDailyRow[start + 9] = 15;
    bDailyRow[start + 10] = 8;
    bDailyRow[start + 11] = 25;
  }

  const tableWeekly = {
    key: 'b_week',
    role: 'weekly',
    rows: [headers, Array(59).fill(null), bDailyRow],
    version: '1',
    capturedAt: now,
    url: 'https://example.test/b_week',
    complete: true,
    range: 'A1:BG10'
  };

  // 1.3 专有预算排期底表（FS合计 600）
  const planRows = [
    ['日期', 'FS合计', 'F红星', 'F红盟', '信息流', 'S红星', 'S红盟', '搜索'],
    ['2026-10-12', 600, 150, 150, 300, 150, 150, 300]
  ];
  const tablePlan = {
    key: 'b_plan',
    role: 'budget_plan',
    rows: planRows,
    version: '1',
    capturedAt: now,
    url: 'https://example.test/b_plan',
    complete: true,
    range: 'A1:H5'
  };

  // 1.4 自定义核心关键词表（有机A2蛋白、水解轻羽）
  const kwTable = {
    key: 'b_kw',
    role: 'keywords',
    rows: [
      ['市场出价', '搜索指数', '关键词', '消费占比', '消耗/元', 'CP星盟UV', 'CTR', 'CPC'],
      ['2.5', '3500', '有机A2蛋白', '55.0%', '5500.00', '14.20', '9.5%', '1.50'],
      ['1.8', '1800', '水解轻羽', '35.0%', '3500.00', '16.80', '7.2%', '2.10']
    ],
    version: '1',
    capturedAt: now,
    url: 'https://example.test/b_kw',
    complete: true,
    range: 'A1:H10'
  };

  // 1.5 自定义占位词高消耗笔记
  const kwNotesTable = {
    key: 'b_kw_notes',
    role: 'keyword_notes',
    rows: [
      ['关键词', '笔记ID', '原文入口', '消耗/元', '点击', 'CTR', '回搜率', '回搜量', '回搜成本'],
      ['', '', '', '', '', '', '', '', ''],
      ['有机A2蛋白', '111122223333444455556666', 'https://example.test/note_organic', '3200.00', '800', '12.0%', '6.5%', '52', '61.50']
    ],
    version: '1',
    capturedAt: now,
    url: 'https://example.test/b_kw_notes',
    complete: true,
    range: 'A1:I10'
  };

  // 1.6 日报正文文档（含搜索侧日报与核心词提及）
  const docInput = {
    key: 'b_report',
    url: 'https://example.test/b_report',
    version: '1',
    capturedAt: now,
    year: 2026,
    content: '<h1>10月12日</h1><h2>今日待办</h2><p>二号定制品牌投放动作平稳推进。</p><h3>搜索侧日报</h3><p>【有机A2蛋白】soc 28.5%，soc1 费用占比 55.0%</p>今日动作：\n持续放量高转化词'
  };

  await store.ingestBusinessBundle('brand-b-project', {
    tables: [tableWeekly, tablePlan, kwTable, kwNotesTable],
    document: docInput
  });

  await vite.close();
  console.log('2. 独立第二项目丰富数据入库完成！');
}

async function verifyBrowserInteraction() {
  console.log('3. 启动 Playwright Chromium 会话访问 5246 端口第二项目真实页面...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const url = 'http://127.0.0.1:5246/projects/brand-b-project?tab=daily&day=2026-10-12';
  await page.goto(url, { waitUntil: 'networkidle' });

  // 验证页面渲染
  const kpis = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.bd-kpis article')).map(el => ({
      label: el.querySelector('p')?.innerText,
      val: el.querySelector('strong')?.innerText
    }));
  });
  console.log('页面渲染的核心 KPI 列表:', kpis);

  // 验证专属核心词卡片渲染
  const wordCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.bv-word-cards article')).map(el => ({
      title: el.querySelector('h4')?.innerText,
      metrics: Array.from(el.querySelectorAll('.bv-word-grid > div')).map(d => d.innerText.replace(/\n/g, ' '))
    }));
  });
  console.log('页面渲染的核心词卡片:', wordCards);

  // 验证排行榜渲染
  const topKeywords = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.bv-rank-bars > div')).map(el => ({
      word: el.querySelector('span')?.innerText,
      val: el.querySelector('strong')?.innerText
    }));
  });
  console.log('页面渲染的高消耗排行榜:', topKeywords);

  const shotPath = path.join(SCREENSHOT_DIR, 'brand-b-project_full_pipeline_view.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('4. 已保存第二项目全链路真实渲染完整截图:', shotPath);

  await browser.close();
}

async function main() {
  await seedSecondProjectWithRichData();
  await verifyBrowserInteraction();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});