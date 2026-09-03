'use client';

import { useState } from 'react';
import type { MapData, Plan, Spec, Row } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { api, shown, cnTime } from '../../../lib/hooks/use-project-data';

export function AgentStudio({
  projectId,
  map,
  reload,
  toast,
}: {
  projectId: string;
  map: MapData;
  reload: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [prompt, setPrompt] = useState(
    '生成 2026年8月1日-2026年8月31日的启萃项目经营、发布进度、评论口碑与舆情看板，按决策、分析、行动三层展开。'
  );
  const [plan, setPlan] = useState<Plan | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [reportTab, setReportTab] = useState('decision');
  const [busy, setBusy] = useState('');

  const connected =
    map.sources.filter((x) => String(x.status).includes('连接') || String(x.status).includes('正常')).length +
    map.integrations.filter((x) => String(x.status).includes('正常')).length;

  async function generate() {
    setBusy('agent');
    try {
      const result = await api<{ plan: Plan; spec: Spec; engine: string }>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ projectId, prompt, assetIds: assets }),
      });
      setPlan(result.plan);
      setSpec(result.spec);
      toast('报告已生成 · ' + result.engine, 'success');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '生成失败', 'error');
    } finally {
      setBusy('');
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy('upload');
    try {
      let summary: Row = { name: file.name, type: file.type };
      const sheetReader = (window as unknown as { XLSX?: { read: (data: ArrayBuffer) => { SheetNames: string[] } } }).XLSX;
      if (/\.xlsx?$|\.csv$/i.test(file.name) && sheetReader) {
        const book = sheetReader.read(await file.arrayBuffer());
        summary = { sheetNames: book.SheetNames, firstSheet: book.SheetNames[0] };
      }
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      form.append('summary', JSON.stringify(summary));
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      const result = (await response.json()) as { ok?: boolean; id?: string; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || '上传失败');
      setAssets((x) => (result.id ? [...x, result.id] : x));
      toast(file.name + ' 已加入本次任务', 'success');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : '上传失败', 'error');
    } finally {
      setBusy('');
    }
  }

  async function openReport(id: string) {
    try {
      const result = await api<{ report: Row }>(
        '/api/agent?projectId=' + encodeURIComponent(projectId) + '&type=report&id=' + encodeURIComponent(id)
      );
      setSpec(JSON.parse(String(result.report.reportSpecJson || '{}')) as Spec);
      setPlan(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(e instanceof Error ? e.message : '报告读取失败', 'error');
    }
  }

  return (
    <div className="intel-stack">
      <section className="agent-status">
        <div>
          <small>AGENT CONTROL ROOM</small>
          <h2>用一句话调度数据，生成完整经营看板</h2>
          <p>Agent 先理解时间、指标和维度，再从数据地图选择最小必要接口，统一口径后编译为受控 HTML 报告。</p>
        </div>
        <dl>
          <div>
            <dt>已连接数据能力</dt>
            <dd>{connected}</dd>
          </div>
          <div>
            <dt>标准指标</dt>
            <dd>{map.metrics.length}</dd>
          </div>
          <div>
            <dt>历史报告</dt>
            <dd>{map.reports.length}</dd>
          </div>
          <div>
            <dt>Keystone</dt>
            <dd className={map.keystone.textModels.length ? 'ok' : 'warn'}>
              {map.keystone.status}
            </dd>
          </div>
        </dl>
      </section>

      <section className="agent-grid">
        <article className="agent-compose">
          <div className="intel-card-head">
            <div>
              <small>NEW ANALYSIS</small>
              <h2>描述你要看的数据</h2>
            </div>
            <span>{prompt.length}/1200</span>
          </div>
          <textarea
            maxLength={1200}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：生成8月启萃各聚光账户的消耗、发布、种草和评论舆情看板，和7月环比…"
          />
          <div className="prompt-chips">
            {[
              '生成8月启萃经营看板，分析聚光投放消耗与灵犀母婴大盘机会Top30',
              '灵犀母婴13细分市场供需与竞品品牌/SPU排行',
              '近30天评论舆情与处置看板',
              '8月各账户消耗与发布进度',
            ].map((x) => (
              <button key={x} onClick={() => setPrompt(x)}>
                {x}
              </button>
            ))}
          </div>
          <div className="asset-zone">
            <label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <b>＋ 添加表格或图片</b>
              <span>
                {assets.length
                  ? '本次已选 ' + assets.length + ' 个附件'
                  : '支持 XLSX / CSV / PNG / JPG，单个≤25MB'}
              </span>
            </label>
            <button
              className="agent-run"
              disabled={busy !== '' || !prompt.trim()}
              onClick={generate}
            >
              {busy === 'agent' ? '正在规划并生成…' : '生成完整看板 →'}
            </button>
          </div>
          <div className="agent-safety">
            <span>01 理解需求</span>
            <i /> <span>02 选择数据</span>
            <i /> <span>03 校验口径</span>
            <i /> <span>04 编译报告</span>
          </div>
        </article>

        <article className="agent-plan">
          <div className="intel-card-head">
            <div>
              <small>QUERY PLAN</small>
              <h2>数据调用计划</h2>
            </div>
            <b>{plan ? '已生成' : '等待任务'}</b>
          </div>
          {plan ? (
            <>
              <div className="plan-meta">
                <span>
                  <small>任务</small>
                  {plan.intent}
                </span>
                <span>
                  <small>时间</small>
                  {plan.period.start}
                  <br />
                  {plan.period.end}
                </span>
                <span>
                  <small>维度</small>
                  {plan.requestedDimensions.join(' · ')}
                </span>
              </div>
              <ol>
                {plan.steps.map((s, i) => (
                  <li key={s.name}>
                    <i>{i + 1}</i>
                    <div>
                      <strong>{s.name}</strong>
                      <p>{s.detail}</p>
                    </div>
                    <em>完成</em>
                  </li>
                ))}
              </ol>
              {plan.warnings.map((x) => (
                <p className="plan-warning" key={x}>
                  ⚠ {x}
                </p>
              ))}
            </>
          ) : (
            <div className="plan-empty">
              <b>4</b>
              <p>系统会先给出可审计的调用计划，再生成看板</p>
              <span>不会全量拉取几十上百个接口</span>
            </div>
          )}
        </article>
      </section>

      {spec ? (
        <ReportView spec={spec} tab={reportTab} setTab={setReportTab} />
      ) : (
        <ReportBlueprint />
      )}

      <section className="history-grid">
        <article className="history-panel">
          <div className="intel-card-head">
            <div>
              <small>RECENT RUNS</small>
              <h2>最近 Agent 任务</h2>
            </div>
            <b>{map.runs.length}</b>
          </div>
          {map.runs.slice(0, 6).map((r) => (
            <div className="history-row" key={String(r.id)}>
              <i className={String(r.status) === '已完成' ? 'done' : 'pending'} />
              <span>
                <strong>{String(r.prompt).slice(0, 46)}</strong>
                <small>
                  {cnTime(String(r.createdAt))} · {shown(r.engine)}
                </small>
              </span>
              <em>{shown(r.status)}</em>
            </div>
          ))}
          {!map.runs.length && <EmptyState title="还没有生成任务" />}
        </article>

        <article className="history-panel">
          <div className="intel-card-head">
            <div>
              <small>REPORT LIBRARY</small>
              <h2>报告版本库</h2>
            </div>
            <b>{map.reports.length}</b>
          </div>
          {map.reports.slice(0, 6).map((r) => (
            <div className="report-row" key={String(r.id)}>
              <button onClick={() => openReport(String(r.id))}>
                <span>
                  <strong>{shown(r.title)}</strong>
                  <small>
                    {shown(r.periodStart)} — {shown(r.periodEnd)} · {cnTime(String(r.createdAt))}
                  </small>
                </span>
              </button>
              <button
                onClick={() =>
                  window.open(
                    '/api/report-html?projectId=' +
                      encodeURIComponent(projectId) +
                      '&id=' +
                      encodeURIComponent(String(r.id)),
                    '_blank'
                  )
                }
              >
                HTML ↗
              </button>
            </div>
          ))}
          {!map.reports.length && <EmptyState title="生成后的 HTML 看板会保存在这里" />}
        </article>
      </section>
    </div>
  );
}

function ReportView({
  spec,
  tab,
  setTab,
}: {
  spec: Spec;
  tab: string;
  setTab: (v: string) => void;
}) {
  const visible =
    tab === 'decision'
      ? spec.sections.filter((x) => ['actions', 'progress'].includes(x.id))
      : tab === 'analysis'
      ? spec.sections.filter((x) => !['actions'].includes(x.id))
      : spec.sections.filter((x) => ['actions', 'notes'].includes(x.id));

  return (
    <section className="report-surface">
      <header>
        <div>
          <small>GENERATED REPORT · {spec.engine}</small>
          <h2>{spec.title}</h2>
          <p>
            {spec.subtitle} · {spec.period.start} — {spec.period.end}
          </p>
        </div>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(spec, null, 2)], {
              type: 'application/json',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = spec.title + '.json';
            a.click();
          }}
        >
          导出 ReportSpec
        </button>
      </header>
      <nav>
        <button
          className={tab === 'decision' ? 'active' : ''}
          onClick={() => setTab('decision')}
        >
          01 决策层
        </button>
        <button
          className={tab === 'analysis' ? 'active' : ''}
          onClick={() => setTab('analysis')}
        >
          02 分析层
        </button>
        <button
          className={tab === 'action' ? 'active' : ''}
          onClick={() => setTab('action')}
        >
          03 行动层
        </button>
      </nav>
      <div className="report-kpis">
        {spec.kpis.slice(0, 9).map((k) => (
          <article className={k.tone || ''} key={k.key}>
            <small>{k.label}</small>
            <strong>
              {shown(k.value)}
              <i>{k.unit || ''}</i>
            </strong>
            <span>{k.note}</span>
          </article>
        ))}
      </div>
      <div className="report-summary">
        {spec.summary.map((x, i) => (
          <p key={x}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            {x}
          </p>
        ))}
      </div>
      <div className="report-sections">
        {visible.map((section) => (
          <ReportSection key={section.id} section={section} />
        ))}
      </div>
      <footer>
        <span>数据来源 {spec.sources.length} 个</span>
        <span>质量检查 {spec.quality.length} 项</span>
        <span>受控结构组件编译 HTML</span>
      </footer>
    </section>
  );
}

function ReportSection({ section }: { section: Spec['sections'][number] }) {
  const keys = Object.keys(section.data[0] || {});
  return (
    <article className={['table', 'cards'].includes(section.kind) ? 'wide' : ''}>
      <small>{section.eyebrow}</small>
      <h3>{section.title}</h3>
      {section.description && <p>{section.description}</p>}
      {section.kind === 'insights' ? (
        <ul>
          {section.data.map((r, i) => (
            <li key={i}>{shown(r.text)}</li>
          ))}
        </ul>
      ) : section.kind === 'bars' ? (
        <div className="report-bars">
          {section.data.slice(0, 8).map((r, i) => {
            const val = Number(r.count || r.value || 0);
            const max = Math.max(1, ...section.data.map((x) => Number(x.count || x.value || 0)));
            return (
              <div key={i}>
                <span>{shown(r.topic || r.name || r.label)}</span>
                <i>
                  <b style={{ width: (val / max) * 100 + '%' }} />
                </i>
                <em>{val}</em>
              </div>
            );
          })}
        </div>
      ) : section.kind === 'cards' ? (
        <div className="report-cases">
          {section.data.slice(0, 8).map((r, i) => (
            <article key={String(r.noteId || i)}>
              <div>
                {r.coverUrl ? (
                  <img src={String(r.coverUrl)} alt="" />
                ) : (
                  <span>笔记</span>
                )}
                <b>#{String(i + 1).padStart(2, '0')}</b>
              </div>
              <strong>{shown(r.title || r.noteId)}</strong>
              <p>
                {shown(r.author)} · {shown(r.category)}
              </p>
              <dl>
                <div>
                  <dt>互动</dt>
                  <dd>{shown(r.interactions)}</dd>
                </div>
                <div>
                  <dt>评论</dt>
                  <dd>{shown(r.comments)}</dd>
                </div>
                <div>
                  <dt>负向</dt>
                  <dd>{shown(r.negative)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="report-table">
          <table>
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.data.slice(0, 12).map((r, i) => (
                <tr key={i}>
                  {keys.map((k) => (
                    <td key={k}>{shown(r[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!section.data.length && <EmptyState title="该时间段暂无可用数据" />}
        </div>
      )}
    </article>
  );
}

function ReportBlueprint() {
  return (
    <section className="report-blueprint">
      <header>
        <div>
          <small>REPORT BLUEPRINT</small>
          <h2>不是一张简单大屏，而是一份可追溯的完整经营报告</h2>
          <p>参考飞鹤分日看板与 Q3 日报结构，Agent 会按任务自动选用 20+ 种组件。</p>
        </div>
      </header>
      <div>
        {[
          ['决策层', '健康度、异常提醒、执行/预算进度、自动结论'],
          ['分析层', '分日趋势、月进度、账户/KFS、内容/达人/场景、评论舆情'],
          ['行动层', '问题清单、笔记链接、处置 SLA、下一步动作'],
        ].map(([a, b], i) => (
          <article key={a}>
            <b>0{i + 1}</b>
            <strong>{a}</strong>
            <p>{b}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
