'use client';

import React from 'react';
import { NoteCover } from './NoteCover';

export function NoteThumbnail({
  src,
  alt = '',
  title = '',
  author = '',
  category = '笔记',
  className = 'ops-table-note-cover',
  eager = false,
  url = '',
}: {
  src?: string | null;
  alt?: string;
  title?: string;
  author?: string;
  category?: string;
  className?: string;
  eager?: boolean;
  url?: string | null;
}) {
  return (
    <NoteCover
      src={src}
      alt={alt}
      title={title}
      author={author}
      category={category}
      className={className}
      eager={eager}
      url={url}
      showOriginalLinkWhenMissing={false}
    />
  );
}
