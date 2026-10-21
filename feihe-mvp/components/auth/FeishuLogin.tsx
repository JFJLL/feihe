'use client';

import { useState, useEffect, useRef } from 'react';
import './feishu-login.css';

export interface FeishuPublicApp {
  key: string;
  name: string;
}

export interface FeishuSessionUser {
  openId: string;
  unionId?: string;
  name: string;
  avatarUrl?: string;
  tenantKey: string;
  enterpriseKey: string;
  enterpriseName: string;
  loginAt: number;
}

export function FeishuLogin() {
  const [config, setConfig] = useState<{ enabled: boolean; apps: FeishuPublicApp[] } | null>(null);
  const [user, setUser] = useState<FeishuSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new URLSearchParams(window.location.search).get('feishu_error');
    } catch {
      return null;
    }
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Check URL params for feishu_error or feishu_login
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.has('feishu_error')) {
      params.delete('feishu_error');
      changed = true;
    }
    if (params.get('feishu_login') === 'success') {
      params.delete('feishu_login');
      changed = true;
    }
    if (changed) {
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  // Fetch public config and session
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [configRes, sessionRes] = await Promise.all([
          fetch('/api/auth/feishu/config', { cache: 'no-store' }),
          fetch('/api/auth/feishu/session', { cache: 'no-store' }),
        ]);

        if (configRes.ok) {
          const cfg = (await configRes.json()) as { enabled?: boolean; apps?: FeishuPublicApp[] };
          if (mounted && cfg) {
            setConfig({
              enabled: Boolean(cfg.enabled),
              apps: Array.isArray(cfg.apps) ? cfg.apps : [],
            });
          }
        }

        if (sessionRes.ok) {
          const sess = (await sessionRes.json()) as { authenticated?: boolean; user?: FeishuSessionUser };
          if (mounted && sess.authenticated && sess.user) {
            setUser(sess.user);
          }
        }
      } catch {
        // Optional login; gracefully ignore network errors
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  if (loading || !config || !config.enabled || config.apps.length === 0) {
    return null;
  }

  const handleLoginClick = (appKey?: string) => {
    setDropdownOpen(false);
    const currentPath = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '/';
    const targetApp = appKey || config.apps[0]?.key || 'default';
    const url = `/api/auth/feishu/start?app=${encodeURIComponent(targetApp)}&redirect=${encodeURIComponent(currentPath)}`;
    window.location.assign(url);
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      await fetch('/api/auth/feishu/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Ignore network errors
    } finally {
      setUser(null);
    }
  };

  return (
    <div className="feishu-login-root" ref={rootRef}>
      {errorMsg && (
        <div className="feishu-error-banner" role="alert">
          <span>{errorMsg}</span>
          <button
            type="button"
            className="feishu-error-close"
            onClick={() => setErrorMsg(null)}
            aria-label="关闭错误提示"
          >
            &times;
          </button>
        </div>
      )}

      {user ? (
        <>
          <button
            type="button"
            className="feishu-profile-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            title={`当前登录：${user.name} (${user.enterpriseName})`}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="feishu-avatar-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="feishu-avatar-placeholder">
                {(user.name || '飞')[0]}
              </span>
            )}
            <span className="feishu-profile-name">{user.name}</span>
            <span className="feishu-enterprise-badge">{user.enterpriseName}</span>
            <svg
              className={`feishu-login-chevron ${dropdownOpen ? 'open' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="feishu-dropdown-menu" role="menu">
              <div className="feishu-dropdown-header">
                <div className="feishu-dropdown-header-title">飞书企业身份</div>
                <div className="feishu-dropdown-header-info">{user.enterpriseName} · {user.name}</div>
                <div className="feishu-dropdown-header-sub">ID: {user.openId.slice(0, 10)}...</div>
              </div>
              <button
                type="button"
                className="feishu-dropdown-item danger"
                onClick={handleLogout}
                role="menuitem"
              >
                <span>退出登录</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </>
      ) : config.apps.length > 1 ? (
        <>
          <button
            type="button"
            className="feishu-login-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            <svg className="feishu-login-icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 13.5L12 4.5L21 13.5L18 20.5H6L3 13.5Z"
                fill="#3370ff"
                stroke="#3370ff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M12 4.5V16.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>飞书企业登录</span>
            <svg
              className={`feishu-login-chevron ${dropdownOpen ? 'open' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="feishu-dropdown-menu" role="menu">
              <div className="feishu-dropdown-header">
                <div className="feishu-dropdown-header-title">选择所属企业登录</div>
              </div>
              {config.apps.map((app) => (
                <button
                  key={app.key}
                  type="button"
                  className="feishu-dropdown-item"
                  onClick={() => handleLoginClick(app.key)}
                  role="menuitem"
                >
                  <span>{app.name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          className="feishu-login-btn"
          onClick={() => handleLoginClick(config.apps[0]?.key)}
        >
          <svg className="feishu-login-icon" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 13.5L12 4.5L21 13.5L18 20.5H6L3 13.5Z"
              fill="#3370ff"
              stroke="#3370ff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M12 4.5V16.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{config.apps[0]?.name || '飞书企业登录'}</span>
        </button>
      )}
    </div>
  );
}

export default FeishuLogin;
