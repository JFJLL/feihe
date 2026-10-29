'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ProjectContext } from './ProjectContext';
import { api } from '../../lib/hooks/use-project-data';
import type { Plan, Spec } from '../../lib/types/project';
import { useCacheIdentity } from './IdentityBoundary';
import { identityStorageKey } from '../../lib/browser-cache';
import { SafeMarkdownText } from './SafeMarkdownText';

type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  reportId?: string | null;
  engine?: string | null;
  sources?: Array<{ key: string; name: string; records: number; url?: string }>;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMsg[];
};

const QUICK_POOL = [
  '当前选择业务日的广告投放消耗是多少，来源是什么？',
  '当前选择业务日与前一日广告消耗对比与达成率',
  '当前业务日核心指标与预算达成进展',
  '排查评论区交付与自然评论记录分离情况',
  '本品内容档案与执行记录数据质量排查',
  '竞品抽样笔记品牌分布情况（合生元/金领冠/未知）',
  '生成当前业务日经营复盘一页纸决策摘要',
  '分析聚光投放消耗与灵犀母婴大盘机会',
];

const QUICK_PAGE = 4;
const PROJECT_QUICK_POOL = [
  '汇报当前项目已发布指标',
  '查看本项目来源更新时间与有效样本',
  '查看当前团队看板周期的结果',
  '保存一份同口径报告供团队查看'
];

function storageKey(projectId: string, identity: string) {
  return 'agent-sessions:' + identityStorageKey(identity, projectId);
}

function loadSessions(projectId: string, identity: string): ChatSession[] {
  if (!identity) return [];
  try {
    const raw = localStorage.getItem(storageKey(projectId, identity));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function timeLabel(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function FloatingAgent({
  projectId,
  projectName,
  projectBrand,
  activeSection = 'overview',
}: {
  projectId: string;
  projectName?: string;
  projectBrand?: string;
  activeSection?: string;
}) {
  const projectCtx = useContext(ProjectContext);
  const currentProject = projectCtx?.currentProject;

  const resolvedBrand = projectBrand || currentProject?.brand;
  const resolvedName = projectName || currentProject?.name;

  const projectLabel = useMemo(() => {
    if (resolvedName) return resolvedName;
    return projectId === 'qicui' ? '启萃项目' : projectId;
  }, [projectId, resolvedName]);

  const assistantTitle = '智能分析助手';
  const identity = useCacheIdentity();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickPage, setQuickPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<string>('2026-10-13');
  const bodyRef = useRef<HTMLDivElement>(null);

  // Resolve active context from global store, DOM inputs, or URL
  const resolveActiveContext = useCallback(() => {
    if (typeof window === 'undefined') return { day: '2026-10-13', section: activeSection, tab: 'overview' };
    const winCtx = (window as unknown as { __ACTIVE_AGENT_CONTEXT__?: { day?: string; from?: string; to?: string; tab?: string; mode?: string } }).__ACTIVE_AGENT_CONTEXT__;
    const domDay = document.querySelector<HTMLInputElement>('input[aria-label="业务日期"], input[aria-label="业务基准日"]')?.value;
    const domFrom = document.querySelector<HTMLInputElement>('input[aria-label="统计开始"]')?.value;
    const domTo = document.querySelector<HTMLInputElement>('input[aria-label="统计结束"]')?.value;
    const params = new URLSearchParams(window.location.search);
    const day = winCtx?.day || domDay || params.get('day') || '2026-10-13';
    const from = winCtx?.from || domFrom || params.get('from') || undefined;
    const to = winCtx?.to || domTo || params.get('to') || undefined;
    const tab = winCtx?.tab || params.get('tab') || (activeSection === 'overview' ? 'overview' : undefined);
    const mode = winCtx?.mode || params.get('dataMode') || 'latest';
    return { day, from, to, tab, mode, section: activeSection || 'overview' };
  }, [activeSection]);

  // Synchronize currentDay with page changes in real time
  useEffect(() => {
    const sync = () => {
      const winCtx = (window as unknown as { __ACTIVE_AGENT_CONTEXT__?: { day?: string } }).__ACTIVE_AGENT_CONTEXT__;
      const domDay = document.querySelector<HTMLInputElement>('input[aria-label="业务日期"], input[aria-label="业务基准日"]')?.value;
      const params = new URLSearchParams(window.location.search);
      const d = winCtx?.day || domDay || params.get('day');
      if (d) setCurrentDay(d);
    };
    sync();
    window.addEventListener('app:context-change', sync);
    window.addEventListener('popstate', sync);
    const interval = setInterval(sync, 400);
    return () => {
      window.removeEventListener('app:context-change', sync);
      window.removeEventListener('popstate', sync);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    try {
      setSessions(loadSessions(projectId, identity));
    } catch {
      setSessions([]);
    }
  }, [projectId, identity]);

  useEffect(() => {
    try {
      if (identity) localStorage.setItem(storageKey(projectId, identity), JSON.stringify(sessions.slice(0, 30)));
    } catch {
      /* storage optional */
    }
  }, [sessions, projectId, identity]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sessions, activeId, open, busy]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) || null,
    [sessions, activeId],
  );

  const quickItems = useMemo(() => {
    const pool = projectId === 'qicui' ? QUICK_POOL : PROJECT_QUICK_POOL;
    const start = (quickPage * QUICK_PAGE) % pool.length;
    return Array.from({ length: QUICK_PAGE }, (_, i) => pool[(start + i) % pool.length]);
  }, [quickPage, projectId]);

  const newSession = useCallback(() => {
    const now = new Date().toISOString();
    const s: ChatSession = {
      id: 'chat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: '新的对话',
      updatedAt: now,
      messages: [],
    };
    setSessions((prev) => [s, ...prev].slice(0, 30));
    setActiveId(s.id);
    setShowHistory(false);
    setError(null);
    return s.id;
  }, []);

  const openSession = useCallback((id: string) => {
    setActiveId(id);
    setShowHistory(false);
    setError(null);
  }, []);

  const removeSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  const handleSend = useCallback(async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setError(null);
    let sessionId = activeId;
    let history: ChatMsg[] = active?.messages || [];
    if (!sessionId) {
      sessionId = newSession();
      history = [];
    }
    const now = new Date().toISOString();
    const userMsg: ChatMsg = { role: 'user', content: text, createdAt: now };
    const withUser = [...history, userMsg];
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              title: s.messages.length === 0 ? text.slice(0, 20) : s.title,
              updatedAt: now,
              messages: withUser,
            }
          : s,
      ),
    );
    setInput('');
    setBusy(true);
    try {
      const res = await api<{
        ok: boolean;
        reply?: string;
        engine?: string;
        reportId?: string;
        factsSummary?: Record<string, unknown>;
        sources?: Array<{ key: string; name: string; records: number; url?: string }>;
        spec?: Spec;
        error?: string;
      }>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          action: 'chat',
          prompt: text,
          history: withUser.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          context: resolveActiveContext(),
        }),
      });

      const replyContent = res.reply || (res.spec?.summary ? res.spec.summary.join('\n') : '已完成分析。');
      const assistant: ChatMsg = {
        role: 'assistant',
        content: replyContent,
        reportId: res.reportId,
        engine: res.engine || 'Keystone AI (gpt-5.6-terra)',
        sources: res.sources,
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, updatedAt: assistant.createdAt, messages: [...withUser, assistant] } : s)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '分析请求未完成，请重试';
      setError(msg);
      const assistant: ChatMsg = {
        role: 'assistant',
        content: '抱歉，本次分析失败：' + msg + '。可以换个说法再试一次。',
        createdAt: new Date().toISOString()
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, messages: [...withUser, assistant] } : s)),
      );
    } finally {
      setBusy(false);
    }
  }, [input, busy, activeId, active, newSession, projectId, activeSection, currentDay]);

  // Global event listener to open assistant from overview header or other controls
  useEffect(() => {
    const handler = (e: Event) => {
      setOpen(true);
      if (e instanceof CustomEvent && e.detail?.prompt) {
        void handleSend(e.detail.prompt);
      }
    };
    window.addEventListener('open-project-assistant', handler);
    (window as unknown as { __openProjectAssistant?: (prompt?: string) => void }).__openProjectAssistant = (prompt?: string) => {
      setOpen(true);
      if (prompt) void handleSend(prompt);
    };
    return () => {
      window.removeEventListener('open-project-assistant', handler);
      delete (window as unknown as { __openProjectAssistant?: unknown }).__openProjectAssistant;
    };
  }, [handleSend]);

  const sorted = useMemo(() => [...sessions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), [sessions]);

  return (
    <>
      <button
        type="button"
        className={'floating-agent-btn' + (open ? ' active' : '')}
        aria-label={open ? '收起智能助手' : '打开智能助手/AI分析'}
        title={open ? '收起智能助手' : '打开智能助手/AI分析'}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open && !activeId && sessions.length === 0) newSession();
        }}
      >
        <span className="floating-agent-pulse" />
        <span className="floating-agent-icon">{open ? '✕' : '✦'}</span>
        <span className="floating-agent-label">{open ? '收起助手' : '智能助手 / AI分析'}</span>
      </button>

      <div className={'floating-agent-mask' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
      {open && (
        <aside className="floating-agent-panel show" aria-label={assistantTitle}>
          <header className="floating-agent-head">
            {showHistory ? (
              <>
                <div>
                  <small>HISTORY</small>
                  <h3>历史对话</h3>
                </div>
                <div className="floating-agent-head-actions">
                  <button type="button" title="返回对话" onClick={() => setShowHistory(false)}>←</button>
                  <button type="button" title="关闭" onClick={() => setOpen(false)}>✕</button>
                </div>
              </>
            ) : (
              <>
                <div className="floating-agent-head-content">
                    <div className="floating-agent-head-main-row">
                      <h3>智能助手</h3>
                      <span className="floating-agent-status-badge online" title="模型接口：Keystone gpt-5.6-terra">● 已连接</span>
                    </div>
                    <div className="floating-agent-head-sub-row">
                      <span>{projectLabel}</span>
                      <span className="floating-agent-sub-divider">·</span>
                      <span className="floating-agent-day-tag">业务日：{currentDay}</span>
                    </div>
                  </div>
                <div className="floating-agent-head-actions">
                  <button type="button" title="历史记录" onClick={() => setShowHistory(true)}>🕘</button>
                  <button type="button" title="新对话" onClick={newSession}>＋</button>
                  <button type="button" title="关闭" onClick={() => setOpen(false)}>✕</button>
                </div>
              </>
            )}
          </header>

          {showHistory ? (
            <div className="floating-agent-history">
              {sorted.length === 0 ? (
                <p className="floating-agent-empty">还没有历史对话，回到对话页开始第一轮吧。</p>
              ) : (
                sorted.map((s) => (
                  <div key={s.id} className={'floating-agent-history-item' + (s.id === activeId ? ' active' : '')}>
                    <button type="button" className="floating-agent-history-main" onClick={() => openSession(s.id)}>
                      <strong>{s.title}</strong>
                      <span>{timeLabel(s.updatedAt)} / {s.messages.length} 条</span>
                    </button>
                    <button type="button" className="floating-agent-history-del" title="删除" onClick={() => removeSession(s.id)}>删</button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="floating-agent-body" ref={bodyRef}>
                {(!active || active.messages.length === 0) && (
                  <div className="floating-agent-welcome">
                    <div className="floating-agent-avatar">✦</div>
                    <h4>Hi，我是{assistantTitle}</h4>
                    <p>{projectId === 'qicui' ? '已接入当前项目真实业务底表、937篇档案与竞品采样库。可直接提问分日投放消耗、达人发布进度或口碑风险。' : '使用本项目已发布的看板指标生成可核对报告。当前未启用AI增强，不自动调用其他项目或行业外部接口。'}</p>
                    <div className="floating-agent-quick-head">
                      <span>快捷分析</span>
                      <button type="button" onClick={() => setQuickPage((p) => p + 1)}>⟳ 换一批</button>
                    </div>
                    <div className="floating-agent-quick-list">
                      {quickItems.map((q) => (
                        <button key={q} type="button" onClick={() => void handleSend(q)}>
                          <span>{q}</span>
                          <i>→</i>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(active?.messages || []).map((m, idx) => (
                  <div key={idx} className={'floating-agent-msg ' + m.role}>
                    <div className="floating-agent-bubble">
                      {m.role === 'assistant' ? (
                        <SafeMarkdownText content={m.content} />
                      ) : (
                        m.content.split('\n').map((line, i) => (
                          <p key={i}>{line}</p>
                        ))
                      )}
                      {m.role === 'assistant' && m.engine && (
                        <small className="floating-agent-engine-tag">✦ {m.engine}</small>
                      )}
                      {(() => {
                        if (m.role !== 'assistant' || !m.sources || m.sources.length === 0) return null;
                        const lower = m.content.toLowerCase();
                        // 1. 优先正文中明确 source key 命中（精确小写匹配 key）
                        const keyMatches = m.sources.filter(s => {
                          const k = s.key?.trim().toLowerCase();
                          return Boolean(k && lower.includes(k));
                        });

                        let matched: typeof m.sources = [];
                        if (keyMatches.length > 0) {
                          // 有明确 key 命中时，仅保留这些命中 key，绝不可再把同 URL 其他未被提及的 source key 算进来
                          const seenKeys = new Set<string>();
                          matched = keyMatches.filter(s => {
                            if (seenKeys.has(s.key)) return false;
                            seenKeys.add(s.key);
                            return true;
                          });
                        } else {
                          // 无明确 key 时：先尝试名称匹配（排除 name 与 key 相同）
                          const nameMatches = m.sources.filter(s => {
                            const n = s.name?.trim();
                            return Boolean(n && n !== s.key && m.content.includes(n));
                          });
                          if (nameMatches.length > 0) {
                            const seenNames = new Set<string>();
                            matched = nameMatches.filter(s => {
                              if (seenNames.has(s.name)) return false;
                              seenNames.add(s.name);
                              return true;
                            });
                          } else {
                            // 仍无命中时：安全 URL 回退，且同 URL 仅保留一条
                            const seenUrls = new Set<string>();
                            matched = m.sources.filter(s => {
                              if (s.url && m.content.includes(s.url) && !seenUrls.has(s.url)) {
                                seenUrls.add(s.url);
                                return true;
                              }
                              return false;
                            });
                          }
                        }
                        if (matched.length === 0) return null;
                        return (
                          <div className="floating-agent-sources">
                            <span style={{ fontSize: 12, color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>参考出处：</span>
                            {matched.map((s, i) => (
                              s.url ? (
                                <a
                                  key={i}
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="floating-agent-source-pill is-link"
                                  title={s.url}
                                >
                                  {s.name || s.key} ↗
                                </a>
                              ) : (
                                <span key={i} className="floating-agent-source-pill" title={s.name || s.key}>
                                  {s.name || s.key}
                                </span>
                              )
                            ))}
                          </div>
                        );
                      })()}
                      {m.role === 'assistant' && m.reportId && (
                        <a
                          className="floating-agent-report-link"
                          href={'/api/report-html?projectId=' + encodeURIComponent(projectId) + '&id=' + encodeURIComponent(m.reportId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          在新窗口查看完整 HTML 报告 →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="floating-agent-msg assistant">
                    <div className="floating-agent-bubble thinking">正在调取真实业务底表并由 AI 深度分析…</div>
                  </div>
                )}
                {error && <p className="floating-agent-error">{error}</p>}
              </div>

              {active && active.messages.length > 0 && (
                <div className="floating-agent-inline-quick">
                  {quickItems.slice(0, 2).map((q) => (
                    <button key={q} type="button" onClick={() => void handleSend(q)}>{q.slice(0, 16)}…</button>
                  ))}
                </div>
              )}

              <footer className="floating-agent-input">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="询问当前业务日的广告消耗、达人进度或口碑风险… (Enter 发送)"
                />
                <button
                  type="button"
                  className="floating-agent-send"
                  disabled={busy || !input.trim()}
                  onClick={() => void handleSend()}
                >
                  ↑
                </button>
              </footer>
            </>
          )}
        </aside>
      )}
    </>
  );
}
