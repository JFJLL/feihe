'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Note } from '../../lib/types/project';
import { useNoteDetail } from '../../lib/hooks/useNoteDetail';
import type { CompetitorAggregatedData, CompetitorConfig } from '../../lib/competitors/types';
import { CompetitorConfigModal } from './CompetitorConfigModal';

interface RealCompetitorMonitorProps {
  projectId: string;
  userRole?: string;
  openNote?: (id: string) => void;
  openCategoryNotes?: (opts: { title: string; subtitle?: string; tag?: string; notes: Note[]; maxCount?: number }) => void;
}

function isValidHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function RealCompetitorMonitor({
  projectId,
  userRole = 'editor',
  openNote,
  openCategoryNotes,
}: RealCompetitorMonitorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompetitorAggregatedData | null>(null);
  const [config, setConfig] = useState<CompetitorConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const [keywordFilter, setKeywordFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [natureFilter, setNatureFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [page, setPage] = useState(1);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const evidenceTableRef = useRef<HTMLDivElement>(null);
  const { openNote: internalOpenNote, renderDrawer } = useNoteDetail({
    projectId,
    onRefresh: async () => {},
    toast: () => {},
  });
  const handleOpenNote = openNote || internalOpenNote;

  const handleBrandFilter = (brand: string) => {
    setBrandFilter(prev => (prev === brand ? '' : brand));
    setPage(1);
    evidenceTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const canManage = ['platform_admin', 'project_admin', 'editor'].includes(userRole);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        projectId,
        action: 'data',
        page: String(page),
        pageSize: '10',
      });
      if (keywordFilter) q.set('keyword', keywordFilter);
      if (brandFilter) q.set('brand', brandFilter);
      if (natureFilter) q.set('nature', natureFilter);
      if (sentimentFilter) q.set('sentiment', sentimentFilter);

      const res = await fetch('/api/competitors?' + q.toString());
      const json = (await res.json()) as any;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '获取竞品数据失败');
      }
      if (!json.configured) {
        setIsConfigured(false);
        setConfig(json.config || null);
        setData(null);
      } else {
        setIsConfigured(true);
        setData(json.data);
        setConfig(json.data?.config || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, page, keywordFilter, brandFilter, natureFilter, sentimentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleTriggerSync() {
    if (!canManage) return;
    setSyncing(true);
    setSyncMessage('已提交同步任务至调度队列...');
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_sync',
          projectId,
          maxPagesPerRun: 1,
        }),
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '排队同步失败');
      }
      setSyncMessage(json.message || '后台增量同步已完成');
      await loadData();
    } catch (err) {
      setSyncMessage('排队出错: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !data && isConfigured) {
    return (
      <div className="competitor-monitor" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>正在读取本地真实竞品数据...</div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="competitor-monitor">
        <div className="comp-empty-state">
          <div className="comp-empty-icon">📊</div>
          <div className="comp-empty-title">当前项目尚未绑定真实竞品监测任务</div>
          <div className="comp-empty-desc">
            为保障多项目数据隔离与安全，新项目不默认继承启萃任务或样本数据。请管理员绑定公司采集系统的专属 Task ID 与竞品关键词。
          </div>
          {canManage ? (
            <button
              type="button"
              className="comp-btn primary"
              onClick={() => setConfigModalOpen(true)}
            >
              ⚙️ 立即绑定数据源与配置
            </button>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
              您当前为观察者权限，请联系项目管理员进行数据源配置。
            </div>
          )}
        </div>
        {config && (
          <CompetitorConfigModal
            projectId={projectId}
            config={config}
            isOpen={configModalOpen}
            onClose={() => setConfigModalOpen(false)}
            onSaveSuccess={() => loadData()}
          />
        )}
      </div>
    );
  }

  const summary = data?.summary;
  const checkpoints = Object.values(config?.syncCheckpoints || {});

  return (
    <div className="competitor-monitor">
      <div className="comp-status-banner">
        <div className="comp-status-left">
          <div className="comp-pulse-dot" />
          <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>
            真实竞品监测 (本地归一化库)
          </strong>
          <span className="comp-tag info">
            已核验 Task ID: {config?.taskId.slice(0, 8)}...
          </span>
          <span className="comp-tag warning">
            覆盖性质: 指定关键词/小窗口增量抽样 (非全站全量)
          </span>
          <div className="comp-status-meta">
            {summary?.dateRange.minDate ? (
              <span>
                有效窗口: {summary.dateRange.minDate} 至 {summary.dateRange.maxDate} · 共已入库 {summary.totalNotes} 篇样本
              </span>
            ) : (
              <span>尚无入库样本</span>
            )}
          </div>
        </div>
        <div className="comp-status-actions">
          {syncMessage && (
            <span style={{ fontSize: '0.75rem', color: '#0284c7', marginRight: '0.5rem' }}>
              {syncMessage}
            </span>
          )}
          {canManage && (
            <>
              <button
                type="button"
                className="comp-btn"
                disabled={syncing}
                onClick={handleTriggerSync}
                title="提交后台任务队列进行单次预算增量抓取"
              >
                {syncing ? '排队中...' : '🔄 后台增量同步 (1页预算)'}
              </button>
              <button
                type="button"
                className="comp-btn"
                onClick={() => setConfigModalOpen(true)}
              >
                ⚙️ 配置绑定
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        padding: '0.625rem 0.875rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '0.78125rem',
        alignItems: 'center',
      }}>
        <strong style={{ color: '#475569' }}>监测关键词与游标:</strong>
        {(config?.keywords || []).map(kw => {
          const cp = checkpoints.find(c => c.keyword === kw);
          const hasData = cp && cp.rowsImported > 0;
          return (
            <div
              key={kw}
              style={{
                padding: '0.2rem 0.5rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                display: 'flex',
                gap: '0.35rem',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{kw}</span>
              {hasData ? (
                <span style={{ color: '#059669', fontSize: '0.71875rem' }}>
                  已收 {cp.rowsImported} 条 (第 {cp.pageCursor} 页)
                </span>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '0.71875rem' }}>待首次同步</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="comp-metric-grid">
        <div className="comp-card">
          <div className="comp-card-label">总入库监测样本</div>
          <div className="comp-card-val">{summary?.totalNotes ?? 0} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>篇</span></div>
          <div className="comp-card-sub">
            上游评估总数约 {summary?.upstreamTotalCount ? summary.upstreamTotalCount.toLocaleString() : '32,000+'} 条 · 当前为经验证抽样
          </div>
        </div>
        <div className="comp-card">
          <div className="comp-card-label">累计互动量 (转评赞藏)</div>
          <div className="comp-card-val">{summary?.totalInteractions ?? 0} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>次</span></div>
          <div className="comp-card-sub">
            来自真实采集字段统计 · 无广告金额别称
          </div>
        </div>
        <div className="comp-card">
          <div className="comp-card-label">商业内容占比</div>
          <div className="comp-card-val">
            {summary?.commercialRatio ? summary.commercialRatio.toFixed(1) + '%' : '0.0%'}
          </div>
          <div className="comp-card-sub">
            商业合作 {summary?.commercialCount ?? 0} 篇 · 真实自费 {summary?.naturalCount ?? 0} 篇 · 特征待补全 {summary?.unknownNatureCount ?? 0} 篇
          </div>
        </div>
        <div className="comp-card">
          <div className="comp-card-label">消费者问题与反馈</div>
          <div className="comp-card-val" style={{ color: '#dc2626' }}>
            {summary?.consumerIssuesCount ?? 0} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>条线索</span>
          </div>
          <div className="comp-card-sub">
            肠胃消化/口感/冲调/过敏等反馈提取
          </div>
        </div>
      </div>

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '1.25rem',
      }}>
        <div style={{ marginBottom: '0.875rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
            竞品品牌声量份额与篇均效率 (基于明确提及判定)
          </h4>
          <small style={{ color: '#64748b' }}>
            核心准则：关键词命中不等于品牌归属。仅当正文或标题明确指向某品牌时归类，多品牌或通用品类分别标出。
          </small>
        </div>
        <div className="comp-table-container">
          <table className="comp-table">
            <thead>
              <tr>
                <th>归属品牌</th>
                <th>样本笔记数</th>
                <th>份额占比</th>
                <th>总互动量</th>
                <th>篇均互动</th>
              </tr>
            </thead>
            <tbody>
              {(data?.brandShares || []).length > 0 ? (
                data!.brandShares.map(b => {
                  const isSelected = brandFilter === b.brand;
                  const displayBrand = b.brand === 'unknown' ? '待识别品牌' : b.brand;
                  return (
                    <tr
                      key={b.brand}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#f0f9ff' : undefined,
                        transition: 'background-color 0.2s',
                      }}
                      onClick={() => handleBrandFilter(b.brand)}
                      title={"点击按品牌【" + displayBrand + "】筛选样本明细"}
                    >
                      <td>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontWeight: 700,
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontSize: 'inherit',
                            textAlign: 'left',
                            textDecoration: isSelected ? 'underline' : 'none',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBrandFilter(b.brand);
                          }}
                          aria-label={"按" + displayBrand + "筛选"}
                        >
                          {displayBrand}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: '1px solid #bfdbfe',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            color: '#0284c7',
                            backgroundColor: isSelected ? '#dbeafe' : '#eff6ff',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: 'inherit',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBrandFilter(b.brand);
                          }}
                          aria-label={"查看" + b.noteCount + "篇样本"}
                        >
                          {b.noteCount} 篇
                        </button>
                      </td>
                      <td>{b.sharePercent.toFixed(1)}%</td>
                      <td>{b.interactionCount.toLocaleString()}</td>
                      <td>{b.avgInteractions}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                    暂无品牌样本统计
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '1.25rem',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
            消费者疑问、反馈与风险线索分析 (真实原文提取)
          </h4>
          <small style={{ color: '#64748b' }}>
            基于自然语言规则从真实笔记标题与内容中提取的痛点线索；规则洞察不冒充已证实消费者真实性，附带原文证据核验。
          </small>
        </div>
        <div className="comp-issue-panel">
          {(data?.issueBreakdown || []).map(cat => (
            <div key={cat.category} className={'comp-issue-card ' + cat.category}>
              <div className="comp-issue-title">
                <span>{cat.label}</span>
                <span className="comp-issue-badge">{cat.count} 条反馈</span>
              </div>
              <div className="comp-issue-keywords">
                {cat.topKeywords.map(k => (
                  <span key={k.keyword} className="comp-issue-kw-pill">
                    {k.keyword} ({k.count})
                  </span>
                ))}
              </div>
              {cat.sampleNotes.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem' }}>
                    代表笔记与证据引用 (点击查看详情):
                  </div>
                  {cat.sampleNotes.slice(0, 2).map((s, idx) => {
                    const displayBrand = s.brand === 'unknown' ? '待识别品牌' : s.brand;
                    return (
                      <div
                        key={s.noteId || idx}
                        className="comp-issue-excerpt"
                        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}
                      >
                        <div style={{ flex: 1 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenNote(s.noteId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#0284c7',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: 'inherit',
                              textDecoration: 'underline',
                            }}
                            title={`查看代表笔记详情 (ID: ${s.noteId})`}
                          >
                            [{displayBrand}] {s.title}
                          </button>
                          <span style={{ color: '#475569', marginLeft: '4px' }}>: {s.excerpt}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenNote(s.noteId)}
                          style={{
                            flexShrink: 0,
                            fontSize: '0.75rem',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#0284c7',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          aria-label={`查看【${s.title}】详情`}
                        >
                          详情 →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
            达人层级分布
          </h4>
          <span className="comp-tag">粉丝数未提供</span>
        </div>
        <details style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#64748b' }}>
          <summary style={{ cursor: 'pointer', color: '#0284c7' }}>口径说明</summary>
          上游采集接口原始记录中未提供达人粉丝数字段，系统严格按事实标注为粉丝数未提供，不凭空推测或伪造层级。
        </details>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}>
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>粉丝数未提供</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>
              {summary?.totalNotes ?? 0} 篇
            </div>
            <div style={{ fontSize: '0.71875rem', color: '#0284c7' }}>占比 100%</div>
          </div>
        </div>
      </div>

      <div
        ref={evidenceTableRef}
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
              证据笔记明细列表 (服务端分页)
            </h4>
            <small style={{ color: '#64748b' }}>
              显示真实发布时间、采集入库时间、24/32位 ID 原型及疑似重复标记；点击标题可查看正文详情{data?.pagination ? `（共 ${data.pagination.total} 篇笔记${brandFilter ? ` · 已筛选品牌: ${brandFilter === 'unknown' ? '待识别品牌' : brandFilter}` : ''}）` : ''}
            </small>
          </div>
          <div className="comp-filter-bar" style={{ padding: '0.35rem 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="comp-filter-item">
              <span>归属品牌:</span>
              <select
                className="comp-filter-select"
                value={brandFilter}
                onChange={e => { setBrandFilter(e.target.value); setPage(1); }}
              >
                <option value="">全部品牌</option>
                {(data?.brandShares || []).map(b => (
                  <option key={b.brand} value={b.brand}>
                    {b.brand === 'unknown' ? '待识别品牌' : b.brand} ({b.noteCount}篇)
                  </option>
                ))}
              </select>
            </div>
            <div className="comp-filter-item">
              <span>关键词:</span>
              <select
                className="comp-filter-select"
                value={keywordFilter}
                onChange={e => { setKeywordFilter(e.target.value); setPage(1); }}
              >
                <option value="">全部</option>
                {(config?.keywords || []).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="comp-filter-item">
              <span>内容性质:</span>
              <select
                className="comp-filter-select"
                value={natureFilter}
                onChange={e => { setNatureFilter(e.target.value); setPage(1); }}
              >
                <option value="">全部</option>
                <option value="commercial">商业合作</option>
                <option value="natural">真实自费</option>
                <option value="unknown">特征待补全</option>
              </select>
            </div>
            {brandFilter && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px' }}>
                <span>已筛选: <strong>{brandFilter === 'unknown' ? '待识别品牌' : brandFilter}</strong></span>
                <button
                  type="button"
                  onClick={() => { setBrandFilter(''); setPage(1); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', fontWeight: 700, padding: 0 }}
                  aria-label="清除品牌筛选"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="comp-table-container">
          <table className="comp-table">
            <thead>
              <tr>
                <th>笔记标题与链接</th>
                <th>命中词 / 归属</th>
                <th>作者 / ID特征</th>
                <th>发布时间 (pubTime)</th>
                <th>采集入库 (insertTime)</th>
                <th>性质 / 状态</th>
                <th>互动 (赞/评/藏/转)</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentNotes || []).length > 0 ? (
                data!.recentNotes.map(n => (
                  <tr key={n.id}>
                    <td style={{ maxWidth: '280px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenNote(n.rawNoteId || n.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          fontWeight: 600,
                          color: '#0284c7',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          marginBottom: '0.2rem',
                          display: 'block',
                          textDecoration: 'underline',
                        }}
                        title={`点击查看笔记详情 (ID: ${n.rawNoteId || n.id})`}
                      >
                        {n.title || '无标题笔记'}
                      </button>
                      {isValidHttpUrl(n.noteUrl) ? (
                        <a
                          href={n.noteUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', color: '#0284c7', textDecoration: 'none' }}
                        >
                          打开小红书原文 ↗
                        </a>
                      ) : n.noteUrl ? (
                        <span style={{ fontSize: '0.71875rem', color: '#94a3b8' }}>
                          ID: {n.noteUrl}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>{n.keywordHit}</div>
                      <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                        归属: <strong>{n.brandAttributed === 'unknown' ? '待识别品牌' : n.brandAttributed}</strong> ({n.productLine})
                      </div>
                    </td>
                    <td>
                      <div>{n.authorName}</div>
                      <div className="comp-hex-len">{n.idHexLength}位ID</div>
                    </td>
                    <td>{n.pubTime || '—'}</td>
                    <td>{n.insertTime || '—'}</td>
                    <td>
                      <div>
                        {n.contentNature === 'commercial' && <span className="comp-tag info">商业商单</span>}
                        {n.contentNature === 'natural' && <span className="comp-tag success">真实自费</span>}
                        {n.contentNature === 'unknown' && <span className="comp-tag">特征不足</span>}
                      </div>
                      {n.duplicateStatus === 'suspected_dup' && (
                        <div className="comp-dup-warning" style={{ marginTop: '0.25rem' }}>
                          ⚠ 疑似同文重复 (目标: {n.suspectedDupTarget?.slice(0, 8)}...)
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{n.interactionTotal}</strong>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {n.likedCount} / {n.commentCount} / {n.collectedCount} / {n.shareCount}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                    暂无匹配的笔记样本
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data?.pagination && data.pagination.totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.875rem',
            fontSize: '0.8125rem',
          }}>
            <span style={{ color: '#64748b' }}>
              第 {data.pagination.page} / {data.pagination.totalPages} 页 · 共 {data.pagination.total} 条
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className="comp-btn"
                disabled={data.pagination.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                className="comp-btn"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {!openNote && renderDrawer()}

      {config && (
        <CompetitorConfigModal
            projectId={projectId}
            config={config}
            isOpen={configModalOpen}
            onClose={() => setConfigModalOpen(false)}
            onSaveSuccess={() => loadData()}
        />
      )}
    </div>
  );
}