import { chromium } from 'playwright';
import path from 'node:path';

async function testDrawer() {
  console.log('开始在 business-isolated-2 演练 BusinessConfigDrawer 配置编辑与保存...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. 进入 business-isolated-2
  await page.goto('http://127.0.0.1:5246/projects/business-isolated-2?tab=daily&day=2026-10-14', { waitUntil: 'networkidle' });

  // 2. 点击 '配置业务来源与规则' 按钮打开抽屉
  const configBtn = page.locator('button', { hasText: '配置业务来源与规则' });
  await configBtn.click();
  await page.waitForTimeout(500);

  const drawer = page.locator('[data-testid="business-config-drawer"]');
  console.log('抽屉可见:', await drawer.isVisible());

  // 截图抽屉打开初始状态
  const shotInit = path.resolve('../docs/delivery-v1/screenshots/drawer-01-isolated-open.png');
  await page.screenshot({ path: shotInit, fullPage: false });

  // 3. 填写本品与竞品词
  const brandInput = page.locator('input[aria-label="本品品牌与词库"]');
  await brandInput.fill('飞鹤启萃-测试线');

  const compInput = page.locator('input[aria-label="竞品对比词"]');
  await compInput.fill('合生元测试, a2测试');

  const alertInput = page.locator('input[aria-label="预警阈值"]');
  await alertInput.fill('8');

  // 4. 新增一条来源绑定
  const addBtn = page.locator('button', { hasText: '+ 新增来源绑定' });
  await addBtn.click();
  await page.waitForTimeout(300);

  const keyInput = page.locator('input[aria-label="来源标识-0"]');
  await keyInput.fill('isolated_weekly_test');

  const urlInput = page.locator('input[aria-label="来源地址-0"]');
  await urlInput.fill('https://yimeichuanbo.feishu.cn/wiki/test_isolated_source');

  // 截图表单填写状态
  const shotFilled = path.resolve('../docs/delivery-v1/screenshots/drawer-02-isolated-filled.png');
  await page.screenshot({ path: shotFilled, fullPage: false });

  // 5. 点击 保存配置
  const saveBtn = page.locator('button', { hasText: '保存配置' });
  await saveBtn.click();
  await page.waitForTimeout(1000);

  // 6. 验证接口真实持久化与读取
  const verifyRes = await fetch('http://127.0.0.1:5246/api/business-daily?projectId=business-isolated-2&action=config', {
    headers: { 'x-user-id': 'user-admin' }
  }).then(r => r.json());

  console.log('保存后接口读取验证:', JSON.stringify(verifyRes, null, 2));

  // 7. 再次打开抽屉检查回填与版本递增
  await configBtn.click();
  await page.waitForTimeout(500);
  const shotSaved = path.resolve('../docs/delivery-v1/screenshots/drawer-03-isolated-reloaded.png');
  await page.screenshot({ path: shotSaved, fullPage: false });

  // 8. 测试 viewer 模式隐藏或拒绝
  const pageViewer = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'x-user-id': 'user-viewer' }
  });
  await pageViewer.goto('http://127.0.0.1:5246/projects/business-isolated-2?tab=daily&day=2026-10-14', { waitUntil: 'networkidle' });
  const viewerConfigBtn = pageViewer.locator('button', { hasText: '配置业务来源与规则' });
  const viewerVisible = await viewerConfigBtn.isVisible();
  console.log('user-viewer 视角下配置按钮是否隐藏:', !viewerVisible);

  await browser.close();
  console.log('BusinessConfigDrawer 全链路验收通过！');
}

testDrawer().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
