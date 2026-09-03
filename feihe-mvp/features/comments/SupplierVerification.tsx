'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Dashboard, Ops } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { cnTime, pct, api } from '../../lib/hooks/use-project-data';

function StatusCard({
  value,
  title,
  note,
  cls,
}: {
  value: number;
  title: string;
  note: string;
  cls: string;
}) {
  return (
    <article className={'status-card ' + cls}>
      <b>{value}</b>
      <span>{title}</span>
      <small>{note}</small>
    </article>
  );
}

export function SupplierVerification({
  data,
  ops,
  uploadWorkbook,
  verifySupplier,
  loading,
  runResult,
  projectId,
  onDone,
  toast,
}: {
  data: Dashboard;
  ops: Ops;
  uploadWorkbook: (f: File | undefined, k: 'owned' | 'supplier') => void;
  verifySupplier: () => void;
  loading: boolean;
  runResult: string;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const s = data.metrics.supplier || {};
  const [filter, setFilter] = useState('');
  const rows = ops.supplier.filter((x) => !filter || x.visibility === filter);
  const total = Number(s.total || 0);
  const visible = Number(s.exactCount || 0) + Number(s.modifiedCount || 0);

  async function deleteSupplier(id: number) {
    if (!confirm('确认删除此供应商评论记录？')) return;
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action: 'supplier_delete', projectId, id }),
      });
      toast('记录已删除', 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  }

  return (
    <div className="stack">
      <section className="status-grid supplier-status">
        <StatusCard
          value={Number(s.exactCount || 0)}
          title="原文一致外显"
          note="可计入审核通过"
          cls="good"
        />
        <StatusCard
          value={Number(s.modifiedCount || 0)}
          title="有修改但外显"
          note="用于总结更易通过表达"
          cls="base"
        />
        <StatusCard
          value={Number(s.missingCount || 0)}
          title="当前未外显"
          note="需补发或复查账号"
          cls="danger-card"
        />
        <StatusCard
          value={Number(s.pendingCount || 0)}
          title="待核验"
          note="等待下一轮抓取"
          cls="warn"
        />
      </section>

      <section className="panel supplier-tools">
        <div>
          <PanelHead eyebrow="SUPPLIER QA" title="隔天外显复核" />
          <p style={{ margin: '4px 0 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
            按笔记分组抓取全量评论，区分原文一致、有修改和未外显。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label className="upload">
            导入交付 Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => uploadWorkbook(e.target.files?.[0], 'supplier')}
            />
          </label>
          <button
            className="primary"
            disabled={loading || !total}
            onClick={verifySupplier}
          >
            核验全部待检评论
          </button>
        </div>
      </section>

      {runResult && <pre className="result-box">{runResult}</pre>}

      <section className="analysis-grid">
        <article className="panel">
          <PanelHead eyebrow="VISIBILITY" title="外显率与审核共性" />
          <div className="big-rate">
            <strong>{total ? pct(visible / total) : '—'}</strong>
            <span>
              外显率 · {visible}/{total}
            </span>
          </div>
          <div className="feature-grid">
            {ops.supplierFeatures.map((x) => (
              <div key={x.visibility}>
                <b>{x.visibility.replace('当前外显-', '')}</b>
                <span>均长 {x.avgLength} 字</span>
                <span>细节词 {x.detailRate}%</span>
                <span>自然断句 {x.commaRate}%</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelHead eyebrow="PASSING SIGNAL" title="审核通过分析方法" />
          <ul className="insight-list">
            <li>
              <b>真实细节率</b>
              <span>
                比较具体场景、使用过程、时间和量化结果在外显与未外显话术中的差异。
              </span>
            </li>
            <li>
              <b>表达自然度</b>
              <span>对比长度、断句、口语化改写与原文一致率。</span>
            </li>
            <li>
              <b>逐轮复核</b>
              <span>每轮核验留痕，可查看状态变化并导出给供应商补发。</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <PanelHead
          eyebrow="DELIVERY DETAIL"
          title="供应商评论明细"
          extra={
            <Link
              className="text-link"
              href={'/api/export?type=supplier&projectId=' + (data.projectId ?? 'qicui')}
            >
              导出核验结果 ↗
            </Link>
          }
        />
        <div className="filterbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option>待核验</option>
            <option>当前外显-原文一致</option>
            <option>当前外显-有修改</option>
            <option>当前未外显</option>
          </select>
          <span>{rows.length} 条（最多展示 120）</span>
        </div>

        <div className="data-table supplier-table">
          <div className="tr th">
            <span>笔记 / 博主</span>
            <span>计划评论</span>
            <span>实际外显</span>
            <span>状态</span>
            <span>核验 / 操作</span>
          </div>
          {rows.map((x) => (
            <div className="tr" key={x.id}>
              <span>
                <a
                  href={x.noteUrl || 'https://www.xiaohongshu.com/explore/' + x.noteId}
                  target="_blank"
                  rel="noreferrer"
                >
                  {x.noteId}
                </a>
                <small>{x.creator || '—'}</small>
              </span>
              <span>{x.plannedContent}</span>
              <span>{x.matchedContent || '—'}</span>
              <span>
                <i
                  className={
                    'pill ' +
                    (x.visibility.includes('未外显')
                      ? 'warn-pill'
                      : x.visibility === '待核验'
                      ? 'gray-pill'
                      : 'green-pill')
                  }
                >
                  {x.visibility}
                </i>
              </span>
              <span className="row-actions">
                {cnTime(x.verifiedAt)}
                <button className="danger-link" onClick={() => deleteSupplier(x.id)}>
                  删除
                </button>
              </span>
            </div>
          ))}
          {!rows.length && (
            <EmptyState title="暂无供应商评论" text="导入供应商交付 Excel 后开始外显复核。" />
          )}
        </div>
      </section>
    </div>
  );
}
