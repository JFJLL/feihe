'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface NoteCoverProps {
  src?: string | null;
  noteId?: string | null;
  projectId?: string | null;
  title?: string;
  author?: string;
  url?: string | null;
  aspectRatio?: '3:4' | '1:1' | '16:9' | string;
  candidates?: string[] | null;
  imageList?: string[] | null;
  className?: string;
  eager?: boolean;
  alt?: string;
  showOriginalLinkWhenMissing?: boolean;
  category?: string;
}

// Known Xiaohongshu CDN domains that support HTTPS
const KNOWN_HTTPS_CDNS = [
  'ci.xiaohongshu.com',
  'sns-img-qc.xhscdn.com',
  'sns-na-i1.xhscdn.com',
  'sns-na-i2.xhscdn.com',
  'sns-na-i3.xhscdn.com',
  'sns-na-i4.xhscdn.com',
  'sns-na-i5.xhscdn.com',
  'sns-na-i6.xhscdn.com',
  'sns-avatar-qc.xhscdn.com',
  'sns-webpic-qc.xhscdn.com',
];

function sanitizeCoverUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'http:' &&
      KNOWN_HTTPS_CDNS.some((d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d))
    ) {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

// Module-level deduplication and concurrency control for lazy cover resolution
const inFlightResolves = new Map<string, Promise<string | null>>();
const resolvedCache = new Map<string, string>();
const failedCache = new Map<string, number>(); // key -> timestamp of failure
let activeResolves = 0;
const MAX_CONCURRENT_RESOLVES = 2;
const resolveQueue: Array<() => void> = [];

function pumpQueue() {
  while (activeResolves < MAX_CONCURRENT_RESOLVES && resolveQueue.length > 0) {
    const nextTask = resolveQueue.shift();
    if (nextTask) {
      activeResolves++;
      nextTask();
    }
  }
}

async function resolveNoteCover(projectId: string, noteId: string): Promise<string | null> {
  const cacheKey = `${projectId}:${noteId}`;
  if (resolvedCache.has(cacheKey)) {
    return resolvedCache.get(cacheKey)!;
  }
  const lastFailed = failedCache.get(cacheKey);
  if (lastFailed && Date.now() - lastFailed < 120_000) {
    return null; // Failed recently, back off for 2 minutes
  }

  if (inFlightResolves.has(cacheKey)) {
    return inFlightResolves.get(cacheKey)!;
  }

  const promise = new Promise<string | null>((resolve) => {
    const execute = async () => {
      try {
        const url = `/api/note-covers?projectId=${encodeURIComponent(projectId)}&noteId=${encodeURIComponent(noteId)}&resolve=1&format=json`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { coverUrl?: string };
        if (data.coverUrl && typeof data.coverUrl === 'string' && data.coverUrl.startsWith('http')) {
          resolvedCache.set(cacheKey, data.coverUrl);
          resolve(data.coverUrl);
        } else {
          failedCache.set(cacheKey, Date.now());
          resolve(null);
        }
      } catch {
        failedCache.set(cacheKey, Date.now());
        resolve(null);
      } finally {
        activeResolves--;
        inFlightResolves.delete(cacheKey);
        pumpQueue();
      }
    };

    resolveQueue.push(execute);
    pumpQueue();
  });

  inFlightResolves.set(cacheKey, promise);
  return promise;
}

export function NoteCover({
  src,
  noteId,
  projectId = 'qicui',
  title = '',
  author = '',
  url = '',
  aspectRatio = '3:4',
  candidates,
  imageList,
  className = '',
  eager = false,
  alt = '',
  showOriginalLinkWhenMissing = true,
  category = '',
}: NoteCoverProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const triedResolveRef = useRef(false);
  const candidatesList = React.useMemo(() => {
    const raw = candidates || imageList || [];
    return raw.filter((c) => typeof c === "string" && c.trim().length > 0);
  }, [candidates, imageList]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check if we need to resolve on-demand
  const hasDirectSrc = Boolean(src && !src.includes('/api/note-covers?resolve=1'));
  const effectiveNoteId = noteId ? String(noteId).trim().toLowerCase() : '';

  useEffect(() => {
    if (hasDirectSrc || !effectiveNoteId || !projectId) return;
    if (src && !src.includes('/api/note-covers?resolve=1')) return;

    let active = true;
    resolveNoteCover(projectId, effectiveNoteId).then((resolved) => {
      if (active && mountedRef.current && resolved) {
        setResolvedSrc(resolved);
      }
    });

    return () => {
      active = false;
    };
  }, [hasDirectSrc, effectiveNoteId, projectId, src]);

  const activeSrc = resolvedSrc || (candidatesList.length > 0 && candidateIdx < candidatesList.length ? candidatesList[candidateIdx] : null) || (hasDirectSrc ? src : null) || src;
  const cleanSrc = sanitizeCoverUrl(activeSrc);

  const handleImageError = () => {
    if (!mountedRef.current) return;
    if (candidateIdx + 1 < candidatesList.length) {
      setCandidateIdx((prev) => prev + 1);
      return;
    }
    if (!triedResolveRef.current && effectiveNoteId && projectId) {
      triedResolveRef.current = true;
      resolveNoteCover(projectId, effectiveNoteId)
        .then((newUrl) => {
          if (mountedRef.current && newUrl && newUrl !== activeSrc) {
            setResolvedSrc(newUrl);
          } else if (mountedRef.current) {
            setLoadFailed(true);
          }
        })
        .catch(() => {
          if (mountedRef.current) setLoadFailed(true);
        });
      return;
    }
    setLoadFailed(true);
  };

  // Fallback when URL is empty or image failed to load
  if (!cleanSrc || loadFailed) {
    return (
      <div
        className={`note-cover-placeholder ${className}`}
        style={{
          aspectRatio: aspectRatio === '3:4' ? '3 / 4' : aspectRatio === '1:1' ? '1 / 1' : aspectRatio,
        }}
        title={`${title || author || '笔记'} / 封面未获取`}
        data-cover-state="unfetched"
      >
        <div className="note-cover-placeholder-inner">
          <svg
            className="note-cover-placeholder-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m3 15 5-5c.9-.9 2.1-.9 3 0l7 7" />
          </svg>
          <span className="note-cover-placeholder-text">封面未获取</span>
          {category && <span className="note-cover-placeholder-category">{category}</span>}
          {showOriginalLinkWhenMissing && url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="note-cover-placeholder-link"
              onClick={(e) => e.stopPropagation()}
              title="在小红书查看原文"
            >
              查看原文 ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`note-cover-container ${className}`}
      style={{
        aspectRatio: aspectRatio === '3:4' ? '3 / 4' : aspectRatio === '1:1' ? '1 / 1' : aspectRatio,
      }}
      data-cover-state="loaded"
    >
      <img
        src={cleanSrc}
        alt={alt || title || '笔记封面'}
        className="note-cover-img"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
    </div>
  );
}
