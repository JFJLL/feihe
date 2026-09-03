'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/hooks/use-project-data';
import type { Plan, Spec } from '../../lib/types/project';

type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  reportId?: string | null;
  engine?: string | null;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMsg[];
};

const QUICK_POOL = [
  '生成近30天启萃经营复盘，结合聚光消耗、自然笔记互动及关键词样本',
  '分析聚光投放消耗与灵犀母婴大盘机会Top30',
  '灵犀母婴13细分市场供需与竞品品牌/SPU排行',
  '排查近期负面风险评论与供应商核验情况',
  '本周发布进度落后多少，还差几篇笔记可以补齐',
  '本品与竞品声量对比，谁在涨谁在掉',
  '把高互动笔记沉淀为灵感选题并推荐投流种子',
  '生成一份给老板看的一页纸决策摘要',
];

const QUICK_PAGE = 4;

function storageKey(projectId: string) {
  return 'agent-sessions:' + projectId;
}

function loadSessions(projectId: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
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

export function FloatingAgent({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickPage, setQuickPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessions(loadSessions(projectId));
    } catch {
      setSessions([]);
    }
  }, [projectId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(sessions.slice(0, 30)));
    } catch {
      /* storage optional */
    }
  }, [sessions, projectId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sessions, activeId, open, busy]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) || null,
    [sessions, activeId],
  );

  const quickItems = useMemo(() => {
    const start = (quickPage * QUICK_PAGE) % QUICK_POOL.length;
    return Array.from({ length: QUICK_PAGE }, (_, i) => QUICK_POOL[(start + i) % QUICK_POOL.length]);
  }, [quickPage]);

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

  async function handleSend(raw?: string) {
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
      const context = withUser.slice(-7, -1).map((m) => (m.role === 'user' ? '用户：' + m.content : '助手：' + m.content)).join('\n');
      const contextualPrompt = context ? '【历史对话】\n' + context + '\n【本次需求】\n' + text : text;
      const res = await api<{ ok: boolean; plan: Plan; spec: Spec; reportId: string; engine: string }>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ projectId, prompt: contextualPrompt }),
      });
      const summary = (res.spec?.summary || []).slice(0, 4).join('\n');
      const assistant: ChatMsg = {
        role: 'assistant',
        content:
          '已生成「' + (res.spec?.title || '智能看板') + '」·' + res.engine + (summary ? '\n' + summary : ''),
        reportId: res.reportId,
        engine: res.engine,
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, updatedAt: assistant.createdAt, messages: [...withUser, assistant] } : s)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败，请重试';
      setError(msg);
      const assistant: ChatMsg = { role: 'assistant', content: '抱歉，本次生成失败：' + msg + '。可以换个说法再试一次。', createdAt: new Date().toISOString() };
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, messages: [...withUser, assistant] } : s)),
      );
    } finally {
      setBusy(false);
    }
  }

  const sorted = useMemo(() => [...sessions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), [sessions]);

  return (
    <>
      <button
        type="button"
        className="floating-agent-btn"
        aria-label="打开智能助手"
        onClick={() => {
          setOpen(true);
          if (!activeId && sessions.length === 0) newSession();
        }}
      >
        <span className="floating-agent-pulse" />
        <span className="floating-agent-icon">智</span>
      </button>

      <div className={'floating-agent-mask' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
      <aside className={'floating-agent-panel' + (open ? ' show' : '')} aria-hidden={!open}>
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
              <div>
                <small>AI · 项目上下文已关联</small>
                <h3>Hi，我是增长助手</h3>
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
                    <span>{timeLabel(s.updatedAt)} · {s.messages.length} 条</span>
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
                  <h4>Hi，我是增长助手</h4>
                  <p>这里是项目专属 AI 助手，已关联当前项目数据与接口。和首页输入框同一套生成逻辑，本轮对话内记得住上下文。</p>
                  <div className="floating-agent-quick-head">
                    <span>您可能想问</span>
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
                    {m.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {m.role === 'assistant' && m.reportId && (
                      <Link className="floating-agent-report-link" href={'/projects/' + encodeURIComponent(projectId) + '/insights?tab=ai'}>
                        在分析报告中查看完整 HTML →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="floating-agent-msg assistant">
                  <div className="floating-agent-bubble thinking">正在调用接口并生成看板…</div>
                </div>
              )}
              {error && <p className="floating-agent-error">{error}</p>}
            </div>

            {active && active.messages.length > 0 && (
              <div className="floating-agent-inline-quick">
                {quickItems.slice(0, 2).map((q) => (
                  <button key={q} type="button" onClick={() => void handleSend(q)}>{q.slice(0, 14)}…</button>
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
                placeholder="有什么问题尽管问我…（Enter 发送，Shift+Enter 换行）"
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
    </>
  );
}
