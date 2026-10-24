'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Note, NoteDetail } from '../../lib/types/project';
import { api, cnTime, pct } from '../../lib/hooks/use-project-data';
import { NoteCover } from '../ui/NoteCover';
import { StyledSelect } from '../ui/StyledSelect';

function isValidHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export type NoteDetailContext = 'content' | 'comments' | 'acceptance' | 'growth' | 'insights';

export function NoteDetailDrawer({
  detail,
  close,
  saveNote,
  removeNote,
  context = 'content',
  defaultTab,
  projectId,
  onRefresh,
  baseCount = 30,
}: {
  detail: NoteDetail;
  close: () => void;
  saveNote?: (note: Note) => void;
  removeNote?: (note: Note) => void;
  context?: NoteDetailContext;
  defaultTab?: 'basic' | 'performance' | 'comments' | 'acceptance';
  projectId?: string;
  onRefresh?: (opts?: { fresh?: boolean }) => Promise<void>;
  baseCount?: number;
}) {
  const n = detail.note;
  const { capabilities } = detail;
  const canEdit = capabilities ? capabilities.canEdit : false;
  const canDelete = capabilities ? capabilities.canDelete : false;
  const canCalibrate = capabilities ? capabilities.canCalibrate : false;
  const readonlyReason = capabilities?.readonlyReason || '来源快照，只读查看';

  const [draft, setDraft] = useState(n);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationReason, setCalibrationReason] = useState('');
  const [calibrationSuccess, setCalibrationSuccess] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const initialTab = defaultTab || (
    context === 'comments' || context === 'acceptance' ? 'comments' :
    context === 'insights' ? 'performance' :
    'basic'
  );
  const [tab, setTab] = useState<'basic' | 'performance' | 'comments' | 'acceptance'>(initialTab);

  const allowEditStatus = context === 'acceptance';

  // Body scroll lock & Focus trap
  useEffect(() => {
    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus initial element
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      triggerElementRef.current?.focus();
    };
  }, [close]);

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      close();
    }
  }, [close]);

  async function handleCalibrateAcceptance() {
    if (!draft?.id || !draft.status) return;
    setCalibrating(true);
    setCalibrationSuccess('');
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          action: 'calibrate_acceptance',
          projectId,
          noteId: draft.id,
          newStatus: draft.status,
          reason: calibrationReason || '人工验收校正',
        }),
      });
      setCalibrationSuccess('验收状态已校正并记入审计日志');
      if (onRefresh) await onRefresh({ fresh: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : '校正失败');
    } finally {
      setCalibrating(false);
    }
  }

  // Resolve image list: if note has imageList array, use it; else fallback to coverUrl
  const imageList: string[] = (n?.imageList && n.imageList.length > 0)
    ? n.imageList
    : (n?.coverUrl ? [n.coverUrl] : []);
  const currentCoverUrl = imageList[activeImageIdx] || n?.coverUrl || '';

  return (
    <div className="note-detail-modal-backdrop" onMouseDown={handleBackdropMouseDown} role="dialog" aria-modal="true" aria-labelledby="note-detail-title">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="note-detail-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="note-detail-modal-header">
          <div className="note-detail-modal-header-info">
            <span className="note-detail-modal-eyebrow">
              NOTE DETAIL
              {!canEdit && (
                <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>
                  / 🔒 {readonlyReason}
                </span>
              )}
            </span>
            <h2 id="note-detail-title" className="note-detail-modal-title">
              {n?.title || n?.id || '笔记明细'}
            </h2>
            <p className="note-detail-modal-meta">
              <span>👤 {n?.author || '未知博主'}</span>
              <span>·</span>
              <span>🏷️ {n?.status || '已收录'}</span>
              {n?.publishedAt && (
                <>
                  <span>·</span>
                  <span>📅 发布于 {n.publishedAt.slice(0, 10)}</span>
                </>
              )}
              {n?.lastFetchedAt && (
                <>
                  <span>·</span>
                  <span>最近抓取 {cnTime(n.lastFetchedAt)}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className="note-detail-modal-close"
            onClick={close}
            aria-label="关闭弹窗"
            title="关闭 (Esc)"
          >
            ×
          </button>
        </header>

        {/* Hero Section: Media + Overview */}
        <section className="note-detail-modal-hero">
          <div className="note-detail-modal-media">
            <NoteCover
              src={currentCoverUrl}
              noteId={n?.id}
              projectId={projectId || 'qicui'}
              candidates={imageList}
              title={n?.title}
              author={n?.author}
              url={n?.url}
              aspectRatio="3:4"
              className="note-detail-cover-box"
              eager
            />
            {imageList.length > 1 && (
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', maxWidth: 108 }}>
                {imageList.slice(0, 4).map((img, idx) => (
                  <button
                    key={img + idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    style={{
                      width: 24,
                      height: 24,
                      padding: 0,
                      border: activeImageIdx === idx ? '2px solid var(--dt-primary, #008573)' : '0.5px solid #cdced6',
                      borderRadius: 4,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="note-detail-modal-summary">
            <div className="note-detail-modal-tags">
              {n?.category1 && (
                <span className="note-detail-chip chip-primary">
                  切角：{n.category1}
                </span>
              )}
              {n?.creatorLevel && (
                <span className="note-detail-chip chip-purple">
                  达人：{n.creatorLevel}
                </span>
              )}
              {n?.brand && (
                <span className="note-detail-chip">
                  品牌：{n.brand}
                </span>
              )}
              {n?.productScope && (
                <span className="note-detail-chip">
                  范围：{n.productScope}
                </span>
              )}
              {n?.noteType && (
                <span className="note-detail-chip">
                  形式：{n.noteType}
                </span>
              )}
            </div>

            <div className="note-detail-modal-content-box">
              <span className="label">正文摘要：</span>
              {n?.content ? (
                n.content
              ) : (
                <span style={{ color: '#60646c' }}>
                  源数据未提供正文长文本{n?.category1 || n?.category2 ? `（分类切角：${[n.category1, n.category2].filter(Boolean).join(' / ')}）` : ''}
                </span>
              )}
            </div>

            {isValidHttpUrl(n?.url) ? (
              <a
                href={n?.url || ''}
                target="_blank"
                rel="noreferrer"
                className="text-link"
                style={{ fontSize: '12px', color: '#0d74ce', alignSelf: 'flex-start', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                在小红书查看原笔记 ↗
              </a>
            ) : n?.url ? (
              <span style={{ fontSize: '12px', color: '#60646c' }}>原笔记标识: {n.url}</span>
            ) : null}
          </div>
        </section>

        {/* Tabs Navigation */}
        <nav className="note-detail-modal-tabs" role="tablist" aria-label="明细标签">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'basic'}
            className={`note-detail-modal-tab ${tab === 'basic' ? 'active' : ''}`}
            onClick={() => setTab('basic')}
          >
            基础资料
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'performance'}
            className={`note-detail-modal-tab ${tab === 'performance' ? 'active' : ''}`}
            onClick={() => setTab('performance')}
          >
            内容表现
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'comments'}
            className={`note-detail-modal-tab ${tab === 'comments' ? 'active' : ''}`}
            onClick={() => setTab('comments')}
          >
            评论监测
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'acceptance'}
            className={`note-detail-modal-tab ${tab === 'acceptance' ? 'active' : ''}`}
            onClick={() => setTab('acceptance')}
          >
            验收与处置
          </button>
        </nav>

        {/* Tab Content Body */}
        <div className="note-detail-modal-body">
          {tab === 'basic' && (
            <div role="tabpanel" aria-label="基础资料">
              {draft && (
                <section className="note-editor">
                  {!canEdit || context === 'comments' || context === 'acceptance' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>笔记标题</span>
                        <div style={{ fontSize: '14px', color: '#1c2024', fontWeight: 600, marginTop: '2px' }}>{draft.title || '未命名笔记'}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>作者 / 博主</span>
                          <div style={{ fontSize: '14px', color: '#1c2024', marginTop: '2px' }}>{draft.author || '未知博主'}</div>
                        </div>
                        <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>产品范围</span>
                          <div style={{ fontSize: '14px', color: '#1c2024', marginTop: '2px' }}>{draft.productScope || '本品'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>来源分类</span>
                          <div style={{ fontSize: '14px', color: '#1c2024', marginTop: '2px' }}>
                            {draft.sourceType === 'owned' ? '自有发布' : draft.sourceType === 'commercial' ? '商业合作' : '关键词扫描'}
                          </div>
                        </div>
                        <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>收录状态</span>
                          <div style={{ fontSize: '14px', color: '#1c2024', fontWeight: 600, marginTop: '2px' }}>{draft.status || '已收录'}</div>
                        </div>
                      </div>
                      {draft.url && (
                        <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>笔记链接</span>
                          <div style={{ marginTop: '2px', wordBreak: 'break-all' }}>
                            {isValidHttpUrl(draft.url) ? (
                              <a href={draft.url} target="_blank" rel="noreferrer" className="text-link" style={{ fontSize: 14 }}>
                                {draft.url} ↗
                              </a>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#60646c' }}>
                                {draft.url} <small style={{ color: '#60646c' }}>(内部标识，未提供前台外链)</small>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="note-readonly-banner">
                        <span>🔒</span>
                        <span>{!canEdit ? readonlyReason : '评论运营与验收模式下基础资料为只读锁定状态；如需调整状态请前往“验收与处置”标签进行校正。'}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label>
                        标题
                        <input
                          value={draft.title || ''}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                      </label>
                      <label>
                        博主
                        <input
                          value={draft.author || ''}
                          onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                        />
                      </label>
                      <label>
                        笔记链接
                        <input
                          value={draft.url || ''}
                          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                        />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <label>
                          来源分类
                          <StyledSelect
                            value={draft.sourceType || 'scan'}
                            onChange={(e) => setDraft({ ...draft, sourceType: e.target.value })}
                            aria-label="来源分类"
                          >
                            <option value="owned">自有发布</option>
                            <option value="commercial">商业合作</option>
                            <option value="keyword_scan">关键词扫描</option>
                          </StyledSelect>
                        </label>
                        <label>
                          产品范围
                          <StyledSelect
                            value={draft.productScope || '本品'}
                            onChange={(e) => setDraft({ ...draft, productScope: e.target.value })}
                            aria-label="产品范围"
                          >
                            <option value="本品">本品</option>
                            <option value="竞品">竞品</option>
                            <option value="其他">其他</option>
                          </StyledSelect>
                        </label>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', margin: '4px 0 8px' }}>
                        验收状态：<strong>{draft.status || '待抓取'}</strong>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        {canEdit && saveNote && (
                          <button type="button" className="primary" onClick={() => saveNote(draft)}>
                            保存基础资料
                          </button>
                        )}
                        {canDelete && removeNote && (
                          <button type="button" className="danger-link" onClick={() => removeNote(draft)}>
                            移出项目
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}
            </div>
          )}

          {tab === 'performance' && (
            <div role="tabpanel" aria-label="内容表现">
              <section className="mini-kpis">
                <article>
                  <p>阅读量</p>
                  <strong>{n?.readCount ? Number(n.readCount).toLocaleString() : '—'}</strong>
                  <span className="up">单篇总阅读</span>
                </article>
                <article>
                  <p>互动量</p>
                  <strong>{n?.interactionCount ? Number(n.interactionCount).toLocaleString() : '—'}</strong>
                  <span className="up">赞藏评总计</span>
                </article>
                <article>
                  <p>互动率</p>
                  <strong>
                    {n?.readCount && n?.interactionCount
                      ? pct(Number(n.interactionCount) / Number(n.readCount))
                      : '—'}
                  </strong>
                  <span className="up">互动/阅读</span>
                </article>
              </section>

              <div style={{ marginTop: '16px', fontSize: '14px', display: 'grid', gap: '8px', background: '#f9f9fb', padding: 14, borderRadius: 8, border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
                <div><strong>内容方向：</strong>{n?.category1 || '待补充'}</div>
                <div><strong>内容形式：</strong>{n?.noteType || '待补充'}</div>
                <div><strong>达人层级：</strong>{n?.creatorLevel || '待补充'}</div>
                <div><strong>点赞数：</strong>{n?.likeCount ?? '—'}</div>
                <div><strong>收藏数：</strong>{n?.favoriteCount ?? '—'}</div>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div role="tabpanel" aria-label="评论监测">
              <section className="mini-kpis">
                <article>
                  <p>评论总数</p>
                  <strong>{n?.commentTotal || 0}</strong>
                  <span className="up">主评+楼中楼</span>
                </article>
                <article>
                  <p>正向评论</p>
                  <strong>{n?.positiveCount || 0}</strong>
                  <span className="up">
                    {n?.commentTotal ? pct((n.positiveCount || 0) / n.commentTotal) : '—'}
                  </span>
                </article>
                <article>
                  <p>负向/问询</p>
                  <strong>{(n?.negativeCount || 0) + (n?.questionCount || 0)}</strong>
                  <span className="danger">重点复查</span>
                </article>
              </section>

              <h3 style={{ fontSize: '14px', marginTop: '16px', marginBottom: '8px', fontWeight: 600 }}>抓取指标快照</h3>
              <div className="snapshot-list">
                {detail.snapshots && detail.snapshots.length ? (
                  detail.snapshots.map((x) => (
                    <div key={x.capturedAt}>
                      <time>{cnTime(x.capturedAt)}</time>
                      <span>主评 {x.l1Count}</span>
                      <span>楼中楼 {x.l2Count}</span>
                      <b>合计 {x.totalCount}</b>
                    </div>
                  ))
                ) : (
                  <div className="empty" style={{ padding: 12, textAlign: 'center', color: '#60646c', fontSize: '12px' }}>暂无历史快照</div>
                )}
              </div>
            </div>
          )}

          {tab === 'acceptance' && (
            <div role="tabpanel" aria-label="验收与处置">
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f9f9fb', borderRadius: '8px', fontSize: '14px', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
                <div><strong>当前验收状态：</strong>{n?.status || '已收录'}</div>
                <div><strong>前5主评品牌提及率：</strong>{pct(n?.brandMentionTop5 || 0)}</div>
              </div>

              {allowEditStatus && canCalibrate ? (
                <div style={{ margin: '16px 0', padding: '14px', background: '#e6f7ed', borderRadius: '8px', border: '0.5px solid #acdec8' }}>
                  <strong style={{ fontSize: '14px', color: '#208368' }}>人工验收校正（独立审计归档）</strong>
                  <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#208368' }}>
                      校正验收结果
                      <StyledSelect
                        value={draft?.status || '待抓取'}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, status: e.target.value } : prev))}
                        aria-label="校正验收结果"
                      >
                        <option value="待抓取">待抓取</option>
                        <option value="符合基础要求">符合基础要求</option>
                        <option value="符合且能汇报">符合且能汇报</option>
                        <option value={`不够${baseCount}条需补充`}>不够{baseCount}条需补充</option>
                      </StyledSelect>
                    </label>
                    <label style={{ fontSize: '12px', color: '#208368' }}>
                      校正原因说明
                      <input
                        placeholder="例如：人工复核前5条主评品牌提及达标"
                        value={calibrationReason}
                        onChange={(e) => setCalibrationReason(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="primary"
                      disabled={calibrating}
                      style={{ background: '#29a383', borderColor: '#208368', fontSize: 14, padding: '6px 12px' }}
                      onClick={handleCalibrateAcceptance}
                    >
                      {calibrating ? '校正提交中…' : '提交人工验收校正'}
                    </button>
                    {calibrationSuccess && (
                      <span style={{ fontSize: '12px', color: '#208368' }}>✓ {calibrationSuccess}</span>
                    )}
                  </div>
                </div>
              ) : allowEditStatus && !canCalibrate ? (
                <div style={{ margin: '16px 0', padding: '12px', background: '#f9f9fb', borderRadius: '8px', border: '0.5px solid var(--slate-6, #d9d9e0)', fontSize: 14, color: 'var(--slate-11, #60646c)' }}>
                  🔒 验收状态源自业务采集记录（只读），不支持人工覆盖校正
                </div>
              ) : null}

              <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>需处置关键评论</h3>
              <div className="drawer-comments">
                {detail.comments && detail.comments.length ? (
                  detail.comments.map((x) => (
                    <article key={x.id}>
                      <span>
                        {x.sentiment} / {x.category}
                      </span>
                      <p>{x.content}</p>
                      <small>
                        {x.action} / {x.treatmentStatus}
                      </small>
                    </article>
                  ))
                ) : (
                  <div className="empty" style={{ padding: 12, textAlign: 'center', color: '#60646c', fontSize: '12px' }}>暂无需处置的关键评论</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
