'use client';

import React, { useState } from 'react';

const PASTEL_PALETTES = [
  { bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', text: '#0369a1', border: '#7dd3fc' },
  { bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', text: '#15803d', border: '#86efac' },
  { bg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', text: '#7e22ce', border: '#d8b4fe' },
  { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', text: '#b45309', border: '#fcd34d' },
  { bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', text: '#be123c', border: '#fda4af' },
  { bg: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)', text: '#0f766e', border: '#5eead4' },
];

function hashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return PASTEL_PALETTES[Math.abs(hash) % PASTEL_PALETTES.length];
}

export function NoteThumbnail({
  src,
  alt = '',
  title = '',
  author = '',
  category = '笔记',
  className = 'ops-table-note-cover',
  eager = false,
}: {
  src?: string | null;
  alt?: string;
  title?: string;
  author?: string;
  category?: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const cleanSrc = (src && !src.startsWith('/api') && src.startsWith('http')) ? src : '';
  const palette = hashColor(author || title || category);
  const initial = (author || title || category || '笔').trim().slice(0, 1);

  if (!cleanSrc || failed) {
    return (
      <div
        className={className}
        style={{
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          color: palette.text,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: className.includes('table') ? '13px' : '22px',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
        title={title || author}
      >
        <span>{initial}</span>
        {className.includes('card') && (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              fontSize: '10px',
              padding: '1px 6px',
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '4px',
              fontWeight: 600,
              color: palette.text,
            }}
          >
            {category}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt || title}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

