# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: focused-red.spec.ts >> 补修反例：配置保存200后首次同步500，重试复用同一来源
- Location: tests\browser\focused-red.spec.ts:15:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "85d3317d-a13b-40eb-99cf-f1e262f5964b"
Received: "437e970c-5754-4a15-9ea5-74cf7727a7b2"
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - complementary "项目主要导航" [ref=e3]:
    - link "返回项目中心" [ref=e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=e10]:
      - text: 通用项目中台
      - generic [ref=e11]: PROJECT WORKSPACE
    - generic [ref=e12]:
      - generic [ref=e13]: 当前项目
      - combobox "切换项目" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 三项补修
      - paragraph [ref=e21]: 品牌未设置 · 三项补修 · 筹备中
    - navigation "项目模块" [ref=e22]:
      - link "01 项目总览" [ref=e23] [cursor=pointer]:
        - /url: /projects/focused-1791871629453
        - generic [ref=e24]: "01"
        - generic [ref=e25]: 项目总览
      - link "02 数据管理" [ref=e26] [cursor=pointer]:
        - /url: /projects/focused-1791871629453/settings?tab=data-sources
        - generic [ref=e27]: "02"
        - generic [ref=e28]: 数据管理
      - link "05 项目设置" [ref=e29] [cursor=pointer]:
        - /url: /projects/focused-1791871629453/settings
        - generic [ref=e30]: "05"
        - generic [ref=e31]: 项目设置
    - generic [ref=e32]:
      - text: 项目资料已连接
      - generic [ref=e34]: 协作用户 · 2026/10/13 14:07:09
  - main [ref=e35]:
    - generic [ref=e36]:
      - generic [ref=e38]:
        - generic [ref=e39]:
          - heading "项目设置" [level=1] [ref=e40]
          - generic [ref=e41]: 11 个识别词 · 0 条主线
        - paragraph [ref=e43]: 集中管理当前项目的低频配置、目标规则、数据源与数据地图。
      - tablist "模块切换" [ref=e44]:
        - tab "项目资料" [ref=e45] [cursor=pointer]
        - tab "成员与权限" [ref=e47] [cursor=pointer]
        - tab "数据源" [selected] [ref=e49] [cursor=pointer]
        - tab "工具集成" [ref=e51] [cursor=pointer]
        - tab "数据地图" [ref=e53] [cursor=pointer]
      - tabpanel "数据源" [ref=e55]:
        - generic [ref=e56]:
          - region "项目数据源同步概况" [ref=e57]:
            - article [ref=e58]:
              - generic [ref=e59]: 已配置数据源
              - generic [ref=e61]:
                - generic [ref=e62]: "2"
                - generic [ref=e63]: 个
              - generic [ref=e64]: 当前项目手动登记的数据源，不含内置工作表
            - article [ref=e65]:
              - generic [ref=e66]: 有同步记录
              - generic [ref=e68]:
                - generic [ref=e69]: "1"
                - generic [ref=e70]: 个
              - generic [ref=e71]: 最近同步 2026/10/13 14:07:10
            - article [ref=e72]:
              - generic [ref=e73]: 需处理的数据源
              - generic [ref=e75]:
                - generic [ref=e76]: "0"
                - generic [ref=e77]: 个
              - generic [ref=e78]: 按最近错误记录统计；详情见下方数据源列表
            - article [ref=e79]:
              - generic [ref=e80]: 最近读取行数合计
              - generic [ref=e82]:
                - generic [ref=e83]: "2"
                - generic [ref=e84]: 行
              - generic [ref=e85]: 各源最近一次读取量相加，未经跨表去重；无记录显示 —
          - article [ref=e87]:
            - generic [ref=e88]:
              - generic [ref=e89]:
                - generic [ref=e90]: CONNECTED SOURCES
                - heading "三项补修的数据源" [level=2] [ref=e91]
                - paragraph [ref=e92]: 支持飞书电子表格、多维表格与通用任务表接入；支持可视化字段映射与落库校验。
              - generic [ref=e93]:
                - generic [ref=e94]: 共 2 个配置
                - button "＋ 接入飞书数据源" [ref=e95] [cursor=pointer]:
                  - generic [ref=e96]: ＋
                  - text: 接入飞书数据源
            - generic [ref=e97]:
              - generic [ref=e98]:
                - generic [ref=e99]: 飞
                - generic [ref=e100]:
                  - generic [ref=e101]:
                    - strong [ref=e102]: 补修数据
                    - generic [ref=e103]: 通用数据集 ·
                    - generic [ref=e104]: 手动同步
                  - generic [ref=e105]:
                    - generic [ref=e106]:
                      - text: 工作表：
                      - code [ref=e107]: sheetA
                    - generic [ref=e108]:
                      - text: 范围：
                      - code [ref=e109]: 全表
                    - generic [ref=e110]:
                      - text: 最近读取：
                      - strong [ref=e111]: 2 行
                - generic [ref=e112]:
                  - generic [ref=e113]: 已连接
                  - generic [ref=e115]: 2026/10/13 14:07:10
                - generic [ref=e116]:
                  - button "✏ 编辑/映射" [ref=e117] [cursor=pointer]
                  - button "立即同步" [ref=e118] [cursor=pointer]
                  - button "移除" [ref=e119] [cursor=pointer]
              - generic [ref=e120]:
                - generic [ref=e121]: 飞
                - generic [ref=e122]:
                  - generic [ref=e123]:
                    - strong [ref=e124]: 补修数据
                    - generic [ref=e125]: 通用数据集 ·
                    - generic [ref=e126]: 手动同步
                  - generic [ref=e127]:
                    - generic [ref=e128]:
                      - text: 工作表：
                      - code [ref=e129]: sheetA
                    - generic [ref=e130]:
                      - text: 范围：
                      - code [ref=e131]: 全表
                    - generic [ref=e132]:
                      - text: 最近读取：
                      - strong [ref=e133]: —
                - generic [ref=e134]:
                  - generic [ref=e135]: 已连接
                  - generic [ref=e137]: 暂未同步
                - generic [ref=e138]:
                  - button "✏ 编辑/映射" [ref=e139] [cursor=pointer]
                  - button "立即同步" [ref=e140] [cursor=pointer]
                  - button "移除" [ref=e141] [cursor=pointer]
    - region "操作通知":
      - status [ref=e142]:
        - generic [ref=e143]: ✓
        - generic [ref=e144]: 链接解析成功
        - button "关闭通知" [ref=e145] [cursor=pointer]: ×
      - status [ref=e146]:
        - generic [ref=e147]: ✓
        - generic [ref=e148]: 数据源配置已保存
        - button "关闭通知" [ref=e149] [cursor=pointer]: ×
      - status [ref=e150]:
        - generic [ref=e151]: ℹ
        - generic [ref=e152]: 正在执行首次同步…
        - button "关闭通知" [ref=e153] [cursor=pointer]: ×
      - status [ref=e154]:
        - generic [ref=e155]: ✕
        - generic [ref=e156]: 首次同步失败反例
        - button "关闭通知" [ref=e157] [cursor=pointer]: ×
      - status [ref=e158]:
        - generic [ref=e159]: ✓
        - generic [ref=e160]: 数据源配置已保存
        - button "关闭通知" [ref=e161] [cursor=pointer]: ×
      - status [ref=e162]:
        - generic [ref=e163]: ℹ
        - generic [ref=e164]: 正在执行首次同步…
        - button "关闭通知" [ref=e165] [cursor=pointer]: ×
      - status [ref=e166]:
        - generic [ref=e167]: ✓
        - generic [ref=e168]: 首次同步完成！已成功入库 2 行数据
        - button "关闭通知" [ref=e169] [cursor=pointer]: ×
  - button "打开智能助手" [ref=e170] [cursor=pointer]:
    - generic [ref=e172]: 智
  - complementary [aria-hidden] [ref=e173]:
    - generic [ref=e174]:
      - generic [ref=e175]:
        - text: AI · 项目上下文已关联
        - heading [level=3] [ref=e176]: Hi，我是增长助手
      - generic [ref=e177]:
        - button [ref=e178] [cursor=pointer]: 🕘
        - button [ref=e179] [cursor=pointer]: ＋
        - button [ref=e180] [cursor=pointer]: ✕
    - generic [ref=e182]:
      - generic [ref=e183]: ✦
      - heading [level=4] [ref=e184]: Hi，我是增长助手
      - paragraph [ref=e185]: 这里是项目专属 AI 助手，已关联当前项目数据与接口。和首页输入框同一套生成逻辑，本轮对话内记得住上下文。
      - generic [ref=e186]:
        - generic [ref=e187]: 您可能想问
        - button [ref=e188] [cursor=pointer]: ⟳ 换一批
      - generic [ref=e189]:
        - button [ref=e190] [cursor=pointer]:
          - generic [ref=e191]: 生成近30天启萃经营复盘，结合聚光消耗、自然笔记互动及关键词样本
          - generic [ref=e192]: →
        - button [ref=e193] [cursor=pointer]:
          - generic [ref=e194]: 分析聚光投放消耗与灵犀母婴大盘机会Top30
          - generic [ref=e195]: →
        - button [ref=e196] [cursor=pointer]:
          - generic [ref=e197]: 灵犀母婴13细分市场供需与竞品品牌/SPU排行
          - generic [ref=e198]: →
        - button [ref=e199] [cursor=pointer]:
          - generic [ref=e200]: 排查近期负面风险评论与供应商核验情况
          - generic [ref=e201]: →
    - generic [ref=e202]:
      - textbox [ref=e203]:
        - /placeholder: 有什么问题尽管问我…（Enter 发送，Shift+Enter 换行）
      - button [disabled] [ref=e204]: ↑
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { focusedProject, focusedSource, firstSync, newFocusedCard, chooseFocused, focusedPreview } from './focused-helpers';
  3  | 
  4  | test('补修反例：百分字段普通平均0.5%与1.5%显示1.0%', async ({ page, request }) => {
  5  |   const projectId = await focusedProject(request);
  6  |   await focusedSource(page, projectId, 'FocusedPercentDoc');
  7  |   await firstSync(page);
  8  |   await newFocusedCard(page, projectId, '小百分比平均');
  9  |   await chooseFocused(page, '指标计算方式', '数值平均 (Average)');
  10 |   await chooseFocused(page, '目标计算字段', '均值百分比');
  11 |   await page.getByLabel('单位 (选填)', { exact: true }).fill('%');
  12 |   await expect(focusedPreview(page).locator('span').first()).toHaveText('1.0%');
  13 | });
  14 | 
  15 | test('补修反例：配置保存200后首次同步500，重试复用同一来源', async ({ page, request }, info) => {
  16 |   const projectId = await focusedProject(request);
  17 |   await focusedSource(page, projectId, 'FocusedRatioDoc');
  18 |   let injected = false;
  19 |   await page.route('**/api/feishu/sync', route => {
  20 |     if (route.request().method() === 'POST' && !injected) {
  21 |       injected = true;
  22 |       return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"首次同步失败反例"}' });
  23 |     }
  24 |     return route.continue();
  25 |   });
  26 |   const saved = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().postDataJSON()?.action === 'save_source');
  27 |   const failed = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  28 |   await page.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  29 |   const first = await saved;
  30 |   expect(first.status()).toBe(200);
  31 |   const originalId = (await first.json()).id;
  32 |   expect((await failed).status()).toBe(500);
  33 |   await page.screenshot({ path: info.outputPath('saved-but-sync-failed.png'), fullPage: true });
  34 |   const modal = page.getByRole('dialog');
  35 |   const retry = modal.getByRole('button', { name: '重试同步', exact: true });
  36 |   const success = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  37 |   if (await retry.count()) await retry.click();
  38 |   else await modal.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  39 |   const successful = await success;
  40 |   expect(successful.status()).toBe(200);
> 41 |   expect(successful.request().postDataJSON().sourceId).toBe(originalId);
     |                                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  42 |   const workspace = await (await request.get('/api/projects')).json();
  43 |   const sources = workspace.sources.filter((s: { projectId: string }) => s.projectId === projectId);
  44 |   expect(sources).toHaveLength(1);
  45 |   expect(sources[0].id).toBe(originalId);
  46 | });
  47 | 
  48 | test('补修反例：互补缺失数据默认无可计算比率和成对样本', async ({ page, request }) => {
  49 |   const projectId = await focusedProject(request);
  50 |   await focusedSource(page, projectId, 'FocusedRatioDoc');
  51 |   await firstSync(page);
  52 |   await newFocusedCard(page, projectId, '互补缺失转化率');
  53 |   await chooseFocused(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
  54 |   await chooseFocused(page, '分子字段', '成交');
  55 |   await chooseFocused(page, '分母字段', '咨询');
  56 |   await expect(focusedPreview(page).locator('span').first()).toHaveText('—');
  57 |   await expect(focusedPreview(page)).toContainText('成对有效');
  58 |   await expect(focusedPreview(page)).toContainText('0');
  59 | });
  60 | 
```