# 独立质量复核报告（第一批与第三批）

- **复核执行时间**：2026-10-14
- **目标工作区**：`D:/download/pic-vec/feihe-delivery-v1/feihe-mvp`
- **复核范围**：第一批（分日看板可视化与投流占位）、第三批（整篇笔记评论运营、语义误判修复与人工复核闭环）
- **复核原则**：源码只读、测试隔离探针放置于 `.verification/ignored.verification/`、针对真实业务阻塞与核心断言实事求是。

---

## 一、核心阻塞与真实风险清单 (P0 / 真实缺陷)

### 1. 【产品运行阻塞】`app/api/comment-ops/route.ts` 存在语法错误（SyntaxError），导致在线 API 崩溃 (HTTP 500)
- **文件与行号**：`feihe-mvp/app/api/comment-ops/route.ts:7-12`
- **代码现场**：
  ```ts
  export async function GET(request:Request){
    const p=new URL(request.url).searchParams,access=await requireProjectAccess(request,p.get('projectId'));
    if(!access.ok)return jsonError(access.error!,access.status);
    try{
      const projectId=access.context!.projectId;
      if (p.get('action') === 'settings') {
        return Response.json({ ok: true, settings: await getCommentSettings(projectId), canWrite: access.context!.canWrite });
      }
      return Response.json({ ok: true, settings: await getCommentSettings(projectId), canWrite: access.context!.canWrite });
    } // <-- 此处直接闭合了 try 块，缺少 catch/finally，且第 12 行又出现多余的 return Response.json(...) 和后面的 catch
    return Response.json({ok:true,...(p.get('noteId') ? await commentNoteDetail(...) : await readCommentQueue(...))});
  }catch(e){return jsonError(...);}
  ```
- **实际影响**：
  - 任何针对 `/api/comment-ops` 的 GET 请求（包括前端 `CommentsWorkspace` 加载巡查队列、设置抽屉加载配置）均在 Vite SSR / Next.js 解析阶段报错：`Transform failed with 2 errors: [PARSE_ERROR] Missing catch or finally clause; Unexpected token`。
  - 本地真实运行时，访问 `http://127.0.0.1:5246/api/comment-ops?projectId=qicui&action=settings` 直接抛出 HTTP 500 页面崩溃。
  - 回归测试脚本 `node scripts/test-comment-ops.mjs` 也直接在此处编译中断（退出码 1），报告中所称的“10 pass / 0 fail”与当前实际源码状态矛盾。
- **期望结果**：修正 `GET` 函数内部的语法闭合结构，确保 `action === 'settings'` 与常规列表/详情分支正确共存并由统一的 `catch` 捕获异常。

---

### 2. 【语义误判高置信度放行漏洞】否定句与转述未识别，导致高风险评论未经人工复核自动放行
- **文件与行号**：`feihe-mvp/lib/comment-ops/analyze.ts:18-29, 44-59`
- **最小复现探针**：`.verification/ignored.verification/probe-context.mjs`
- **实测结果**：
  - **用例 A**：`'有人说启萃胀气，我家没有'`
    - **实际输出**：`sentiment: "negative"`, `confidence: 0.85`, `needsReview: false`
    - **问题定位**：
      1. `text.matchAll(/胀气/g)` 判定存在症状词；
      2. 前缀否定检查仅取“胀气”前 3 个字符（`[^，,。；;！？?\n]{0,3}$`），而句中否定词“没有”位于后半句（`'，我家没有'`），未能命中前缀否定；
      3. 引述判断中虽然有“有人说”，但其未包含在转述正则中（`quoted` 正则为 `/别人说|朋友说|网友说|听说|据说|引用/`，遗漏了“有人说”）；
      4. 最终导致：**本品明确被用户否定存在胀气的正面/中立反馈，被判为高置信度（0.85）负向（negative），且 `needsReview: false` 直接绕过人工复核！**
  - **用例 B**：`'医生让停了启萃，后面便便才正常'`
    - **实际输出**：`sentiment: "neutral"`, `confidence: 0.85`, `needsReview: false`
    - **问题定位**：包含严重不良反应排查指引（“医生让停了启萃”），但由于正向正则中包含了“便便正常”，被当成独立谓词而忽略了“停了……后面才正常”的时间与因果转折，被评为中性并以 0.85 高置信度放行，未触发复核。
- **业务危害**：人工复核闭环在核心口径上被高置信度绕过，业务方无法在巡查队列中优先看到此类需介入研判的高风险与转折评论。

---

## 二、验收证据真实性与测试断言虚报核查 (证据审计)

### 1. 真实浏览器执行核查
- **核查结论**：确认已执行 Chromium 真实浏览器（Playwright 会话并在 5246 端口运行），页面元素（139 个折叠区、SVG 刻度、明细翻页、日期选择器）均为动态生成，**不是**静态合成或伪造截图。
- **截图真实状态**：
  - `interactive-04-confirmed-snapshot.png` 与 `interactive-05-refreshed-state.png` 真实记录了选择“已确认历史日报”时的产品状态：因 10-14 尚未点击“确认并保存”，系统正确展示了“数据加载异常 · 该日尚无已确认日报”的 Alert 状态，未编造虚假已确认数据。

### 2. 测试报告断言虚报核查
- **虚报点 A（409 来源指纹测试）**：
  - `phase1.md` 声称“展开关键词消耗排行，触发 409 来源指纹校验”。
  - **核实情况**：实际代码及脚本 `run-interactive-browser-evidence.mjs` 中，该交互传递了 `fingerprint: view.fingerprint`，服务端比对一致返回 **HTTP 200** 成功拉取第 1 页明细。系统在正常流程下不会返回 409，报告表述混淆了“携带 fingerprint 参数防并发”与“实际触发了 409 冲突拦截”。
- **虚报点 B（第三批自动化测试通过状态）**：
  - `phase3.md` 声称“node ./scripts/test-comment-ops.mjs 全部通过（10 pass, 0 fail）”。
  - **核实情况**：直接执行该脚本报错崩溃（见问题 1 语法错误），该套件当前不可运行。

---

## 三、权限与项目隔离复核确认

1. **项目级配置隔离 (通过)**：
   - 探针验证 `business_comment_settings` 针对不同项目独立持久化（`qicui` 与自定义项目互不污染），品牌与阈值独立生效。
2. **只读权限隔离 (通过)**：
   - `viewer` 角色提交评论纠正、巡查记录及项目配置均被 `requireProjectAccess` 精准拦截（返回 HTTP 403）。
3. **并发更新防覆盖 (通过)**：
   - 依赖乐观锁 `version` 与 `analysisId`，旧版本提交均能正确返回 HTTP 409。
4. **外部凭据不足状态说明**：
   - 本项目小红书 Cookie 与采集接口未配置时，系统保持“尚未采集”且失败状态不归零，无全网越权或跨项目串号行为。

---

## 四、执行建议与改动清单

| 优先级 | 影响模块 | 问题位置 | 推荐处理方案 |
| :--- | :--- | :--- | :--- |
| **P0 阻塞** | 评论巡查 API | `feihe-mvp/app/api/comment-ops/route.ts:7-12` | 修复 `GET` 函数的花括号与 try-catch 结构，恢复 API 与回归套件 |
| **P1 风险** | 语义分析模型 | `feihe-mvp/lib/comment-ops/analyze.ts:18-60` | 扩充引述词（增加“有人说/大家说”）；增加“停用/停了”因果转折；对转折否定句拉低置信度（强制 `needsReview: true`） |
| **P2 文档** | 交付验收报告 | `docs/delivery-v1/phase1.md`、`phase3.md` | 纠正“已触发409”与“10 pass”的失实措辞，如实记录当前状态 |

---

## 五、阻塞问题接管修复与最终验证闭环（2026-10-14 追更）

### 1. 修复落地与验证记录
1. **`app/api/comment-ops/route.ts` 路由结构重构**：
   - 展开并理顺嵌套逻辑，以清晰多行代码替代 minified 嵌套，确保 `settings` 查询、`noteId` 详情查询及队列分页读取各分支逻辑明确且完整包裹在 `try ... catch` 之中。
   - 修复后经实测，`GET /api/comment-ops?projectId=qicui&action=settings` 成功返回 HTTP 200，无 500 报错。
2. **`lib/comment-ops/analyze.ts` 语境语义分析与边界补全**：
   - 升级版本为 `conversation-context-v3-clarification`。
   - 补充 `hasQuotationWords`（支持“有人说”、“大家说”等引述）。
   - 识别当前用户在转述后的反驳与澄清（如：`有人说启萃胀气，我家没有`），不作为负向体验，保守降为 `uncertain` 并标记 `needsReview: true`。
   - 增加停用本品后变化的因果审阅（如：`医生让停了启萃，后面便便才正常` / `停了启萃之后就改善了`），不草率断言医学因果，保守判定为 `uncertain` 并标记 `needsReview: true`。
   - 增加主评论多品牌下回复的省略指代处理（主评论多品牌时省略回复 `confidence <= 0.5` 并触发复核）。
   - 完好保留确切肯定改善用例（如：`宝宝以前胀气，换启萃好了` 正确判定为 `positive` 且 `needsReview: false`）。
3. **自动化套件最终执行**：
   - 运行 `node scripts/test-comment-ops.mjs`，包含原 10 项核心测试及新增复杂语境边界测试，结果为：**11 pass / 0 fail**。
   - 运行 `npx tsc --noEmit`，TypeScript 静态类型检查 100% 通过无错误。
   - 隔离探针运行 `test-api-lifecycle.mjs`，在独立内存库中全链路跑通：`GET settings (200)` -> `POST save_settings (200)` -> `Viewer 权限拒绝 (403)` -> `未经复核判合格拦截 (400)` -> `人工纠正 (200)` -> `复核合格 (200)` -> `旧版本并发提交拦截 (409)`。
4. **本地真实 Chromium 浏览器验证（5246 端口保持运行，未重启）**：
   - 在浏览器中成功展开“巡查与品牌配置”抽屉并成功读取项目配置，页面渲染正常无报错（写操作已严格限定在测试项目/隔离DB中验证）。
   - 成功进入整篇笔记详情页，页面干净无白屏、无 500。
   - 产出最新证据截图：
     - `docs/delivery-v1/screenshots/remediation-01-settings-drawer-open.png`
     - `docs/delivery-v1/screenshots/remediation-02-note-detail-clean.png`

### 2. 外部采集缺口明确结论
- 已检查的代码与接口仅验证了任务笔记及 `commentCount` 汇总读取能力，未发现或未验证实际引用的逐字评论读取接口。
- 自然评论抓取依赖独立账号 Cookie 与 provider baseURL 配置，当前由于缺少该项凭据保持未采集状态。未将 `commentCount` 冒充已抓取文本，未将聚光 Cookie 或供应商话术混用冒充自然评论。


---

## 六、Solar 官方数据实测入库与终验确认

1. **全链路真实贯通**：从蒲公英 Solar 官方接口拉取、经过持久化 Job 调度、入库 `business_comment_captures`、生成 `business_comment_analyses` 分析记录、以及前端队列与笔记详情页呈现全部打通。
2. **口径分离保障**：
   - 33 保持为主评论上报数，86 为实际抓取入库数（28 主评 + 58 回复）。
   - 抓取未齐备标注 `partial`，杜绝未经复核默认合格。
3. **凭据安全与账号绑定**：
   - 显式绑定 `customerClientId: 165321943462987`，严禁轮询或无序 fallback。
4. **代码已完全冻结**：所有回归套件（11 pass / 0 fail）与真实 Playwright 交互截图全部归档完毕。
