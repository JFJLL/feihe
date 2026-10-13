# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: focused-red.spec.ts >> 补修反例：配置保存200后首次同步500，重试复用同一来源
- Location: tests\browser\focused-red.spec.ts:15:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - complementary "项目主要导航" [ref=e3]:
    - link "返回项目中心" [ref=e4] [cursor=pointer]:
      - /url: /
      - text: ← 项目中心
    - generic [ref=e5]: 项目工作台
    - generic [ref=e11]:
      - generic [ref=e12]: 当前项目
      - combobox "切换项目" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: 三项补修
      - paragraph [ref=e20]: 品牌未设置 · 三项补修 · 筹备中
    - navigation "项目模块" [ref=e21]:
      - link "项目总览" [ref=e22] [cursor=pointer]:
        - /url: /projects/focused-1791910638108
        - generic [ref=e23]: "01"
      - link "数据管理" [ref=e25] [cursor=pointer]:
        - /url: /projects/focused-1791910638108/data
        - generic [ref=e26]: "02"
      - link "指标" [ref=e28] [cursor=pointer]:
        - /url: /projects/focused-1791910638108/metrics
        - generic [ref=e29]: "03"
      - link "项目设置" [ref=e31] [cursor=pointer]:
        - /url: /projects/focused-1791910638108/settings
        - generic [ref=e32]: "05"
    - generic [ref=e34]:
      - text: 项目资料已连接
      - generic [ref=e36]: 平台管理员 · 2026/10/14 00:57:18
  - main [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e40]:
        - generic [ref=e41]:
          - heading "项目设置" [level=1] [ref=e42]
          - generic [ref=e43]: 11 个识别词 · 0 条主线
        - paragraph [ref=e45]: 集中管理当前项目的低频配置、目标规则、数据源与数据地图。
      - tablist "模块切换" [ref=e46]:
        - tab "项目资料" [ref=e47] [cursor=pointer]
        - tab "成员与权限" [ref=e49] [cursor=pointer]
        - tab "数据源" [selected] [ref=e51] [cursor=pointer]
        - tab "工具集成" [ref=e53] [cursor=pointer]
        - tab "数据地图" [ref=e55] [cursor=pointer]
      - tabpanel "数据源" [ref=e57]:
        - generic [ref=e58]:
          - region "项目数据源同步概况" [ref=e59]:
            - article [ref=e60]:
              - generic [ref=e61]: 已配置数据源
              - generic [ref=e63]:
                - generic [ref=e64]: "1"
                - generic [ref=e65]: 个
              - generic [ref=e66]: 当前项目手动登记的数据源，不含内置工作表
            - article [ref=e67]:
              - generic [ref=e68]: 有同步记录
              - generic [ref=e70]:
                - generic [ref=e71]: "0"
                - generic [ref=e72]: 个
              - generic [ref=e73]: 尚无同步记录
            - article [ref=e74]:
              - generic [ref=e75]: 需处理的数据源
              - generic [ref=e77]:
                - generic [ref=e78]: "1"
                - generic [ref=e79]: 个
              - generic [ref=e80]: 按最近错误记录统计；详情见下方数据源列表
            - article [ref=e81]:
              - generic [ref=e82]: 最近读取行数合计
              - generic [ref=e84]:
                - generic [ref=e85]: —
                - generic [ref=e86]: 行
              - generic [ref=e87]: 各源最近一次读取量相加，未经跨表去重；无记录显示 —
          - article [ref=e89]:
            - generic [ref=e90]:
              - generic [ref=e91]:
                - generic [ref=e92]: CONNECTED SOURCES
                - heading "三项补修的数据源" [level=2] [ref=e93]
                - paragraph [ref=e94]: 支持飞书电子表格、多维表格与通用任务表接入；支持可视化字段映射与落库校验。
              - generic [ref=e95]: 共 1 个配置
            - dialog [ref=e97]:
              - generic [ref=e98]:
                - generic [ref=e99]:
                  - heading "配置字段映射：补修数据" [level=3] [ref=e100]
                  - button "关闭弹窗" [ref=e101] [cursor=pointer]: ✕
                - generic [ref=e102]:
                  - status [ref=e103]: 配置已保存，同步未成功：首次同步失败反例。可重试同步或修改映射后重试。 来源 ID：e897d96f-1eb2-4b93-927b-a76400a5ccea
                  - group [ref=e104]:
                    - generic [ref=e105]:
                      - generic [ref=e106]:
                        - text: 数据源名称
                        - textbox "数据源名称" [ref=e107]:
                          - /placeholder: 如：华北区门店咨询与签约表
                          - text: 补修数据
                      - generic [ref=e108]:
                        - generic [ref=e109]: 数据用途
                        - combobox "请选择" [ref=e111] [cursor=pointer]:
                          - generic [ref=e112]: 通用表格数据集（任务、活动、预算、转化）
                      - generic [ref=e115]:
                        - generic [ref=e116]: 同步策略
                        - combobox "请选择" [ref=e118] [cursor=pointer]:
                          - generic [ref=e119]: 手动同步 (已就绪)
                      - generic [ref=e123]:
                        - text: 飞书表格链接（支持电子表格、多维表格与 Wiki 节点）
                        - generic [ref=e124]:
                          - textbox "飞书表格链接" [ref=e125]:
                            - /placeholder: https://yimeichuanbo.feishu.cn/wiki/... 或 sheets/... 或 base/...
                            - text: https://fixture.feishu.cn/sheets/FocusedRatioDoc
                          - button "智能检测工作表 ↗" [ref=e126] [cursor=pointer]
                      - generic [ref=e127]:
                        - generic [ref=e128]: 目标工作表 (Sheet / Table ID)
                        - combobox "目标工作表" [ref=e130] [cursor=pointer]:
                          - generic [ref=e131]: 补修数据 (sheetA)
                      - generic [ref=e134]:
                        - text: 读取范围 (普通电子表格适用)
                        - textbox "读取范围 (普通电子表格适用)" [ref=e135]:
                          - /placeholder: 留空为全表；填入范围将明确限制读取
                    - paragraph [ref=e136]: 读取范围留空表示完整工作表；指定范围时只同步该范围。
                    - generic [ref=e137]:
                      - generic [ref=e138]:
                        - generic [ref=e139]:
                          - heading "⚙ 可视化字段映射配置" [level=4] [ref=e140]
                          - paragraph [ref=e141]: 定义来源字段对应项目数据集的目标字段名、数据类型、主键及空值处理。已自动解析 3 个字段。
                        - generic [ref=e142]:
                          - button "映射后预览" [ref=e143] [cursor=pointer]
                          - button "原始快照" [ref=e144] [cursor=pointer]
                      - paragraph [ref=e145]: 多个主键字段组成联合主键；空主键、重复主键和非法值会拒绝整次导入。必填检查先于补值，未映射字段保留。
                      - table [ref=e147]:
                        - rowgroup [ref=e148]:
                          - row [ref=e149]:
                            - columnheader "来源原字段" [ref=e150]
                            - columnheader "目标项目字段名" [ref=e151]
                            - columnheader "目标数据类型" [ref=e152]
                            - columnheader "业务主键" [ref=e153]
                            - columnheader "日期字段" [ref=e154]
                            - columnheader "必填" [ref=e155]
                            - columnheader "空值处理" [ref=e156]
                        - rowgroup [ref=e157]:
                          - row [ref=e158]:
                            - cell "分组" [ref=e159]
                            - cell [ref=e160]:
                              - textbox "分组目标字段" [ref=e161]: 分组
                            - cell [ref=e162]:
                              - combobox "分组数据类型" [ref=e164] [cursor=pointer]:
                                - generic [ref=e165]: 文本 (text)
                            - cell [ref=e168]:
                              - checkbox "分组主键" [ref=e169]
                            - cell [ref=e170]:
                              - checkbox "分组日期字段" [ref=e171]
                            - cell [ref=e172]:
                              - checkbox "分组必填" [ref=e173]
                            - cell [ref=e174]:
                              - combobox "分组空值处理" [ref=e176] [cursor=pointer]:
                                - generic [ref=e177]: 保留为空 (null)
                          - row [ref=e180]:
                            - cell "成交" [ref=e181]
                            - cell [ref=e182]:
                              - textbox "成交目标字段" [ref=e183]: 成交
                            - cell [ref=e184]:
                              - combobox "成交数据类型" [ref=e186] [cursor=pointer]:
                                - generic [ref=e187]: 数值 (number)
                              - combobox "成交数值单位" [ref=e191] [cursor=pointer]:
                                - generic [ref=e192]: 普通数值
                            - cell [ref=e195]:
                              - checkbox "成交主键" [ref=e196]
                            - cell [ref=e197]:
                              - checkbox "成交日期字段" [ref=e198]
                            - cell [ref=e199]:
                              - checkbox "成交必填" [ref=e200]
                            - cell [ref=e201]:
                              - combobox "成交空值处理" [ref=e203] [cursor=pointer]:
                                - generic [ref=e204]: 保留为空 (null)
                          - row [ref=e207]:
                            - cell "咨询" [ref=e208]
                            - cell [ref=e209]:
                              - textbox "咨询目标字段" [ref=e210]: 咨询
                            - cell [ref=e211]:
                              - combobox "咨询数据类型" [ref=e213] [cursor=pointer]:
                                - generic [ref=e214]: 数值 (number)
                              - combobox "咨询数值单位" [ref=e218] [cursor=pointer]:
                                - generic [ref=e219]: 普通数值
                            - cell [ref=e222]:
                              - checkbox "咨询主键" [ref=e223]
                            - cell [ref=e224]:
                              - checkbox "咨询日期字段" [ref=e225]
                            - cell [ref=e226]:
                              - checkbox "咨询必填" [ref=e227]
                            - cell [ref=e228]:
                              - combobox "咨询空值处理" [ref=e230] [cursor=pointer]:
                                - generic [ref=e231]: 保留为空 (null)
                      - generic [ref=e234]:
                        - generic [ref=e235]: 🔍 映射转换后数据预览（前 5 行）：
                        - table [ref=e237]:
                          - rowgroup [ref=e238]:
                            - row [ref=e239]:
                              - columnheader "分组" [ref=e240]
                              - columnheader "成交" [ref=e241]
                              - columnheader "咨询" [ref=e242]
                          - rowgroup [ref=e243]:
                            - row [ref=e244]:
                              - cell "互补" [ref=e245]
                              - cell "10" [ref=e246]
                              - cell "—" [ref=e247]
                            - row [ref=e248]:
                              - cell "互补" [ref=e249]
                              - cell "—" [ref=e250]
                              - cell "100" [ref=e251]
                - generic [ref=e253]:
                  - button "取消" [ref=e254] [cursor=pointer]
                  - button "仅保存配置" [ref=e255] [cursor=pointer]
                  - button "重试同步" [ref=e256] [cursor=pointer]
            - generic [ref=e258]:
              - generic [ref=e259]: 飞
              - generic [ref=e260]:
                - generic [ref=e261]:
                  - strong [ref=e262]: 补修数据
                  - generic [ref=e263]: 通用数据集 ·
                  - generic [ref=e264]: 手动同步
                - generic [ref=e265]:
                  - generic [ref=e266]:
                    - text: 工作表：
                    - code [ref=e267]: sheetA
                  - generic [ref=e268]:
                    - text: 范围：
                    - code [ref=e269]: 全表
                  - generic [ref=e270]:
                    - text: 最近读取：
                    - strong [ref=e271]: —
                - generic [ref=e272]: ⚠ 配置已保存，同步未成功：首次同步失败反例
              - generic [ref=e273]:
                - generic [ref=e274]: 同步失败
                - generic [ref=e276]: 暂未同步
              - generic [ref=e277]:
                - button "✏ 编辑/映射" [ref=e278] [cursor=pointer]
                - button "立即同步" [ref=e279] [cursor=pointer]
                - button "移除" [ref=e280] [cursor=pointer]
  - button "打开智能助手" [ref=e281] [cursor=pointer]:
    - generic [ref=e283]: 智
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
> 36 |   const success = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
     |                        ^ Error: page.waitForResponse: Test timeout of 60000ms exceeded.
  37 |   if (await retry.count()) await retry.click();
  38 |   else await modal.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  39 |   const successful = await success;
  40 |   expect(successful.status()).toBe(200);
  41 |   expect(successful.request().postDataJSON().sourceId).toBe(originalId);
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