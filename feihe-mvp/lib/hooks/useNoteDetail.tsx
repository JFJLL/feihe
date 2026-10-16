'use client';

import React, { useState, useCallback } from 'react';
import type { Note, NoteDetail } from '../types/project';
import { DetailDrawer } from '../../features/content/DetailDrawer';
import { NoteDetailDrawer, type NoteDetailContext } from '../../components/note-detail/NoteDetailDrawer';
import { api } from './use-project-data';
import { fetchWithCache, getCachedQuery, buildCacheKey, invalidateQueryCache } from '../cache/query-cache';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';

export function useNoteDetail({
  projectId,
  onRefresh,
  toast,
  variant,
  context,
  defaultTab,
}: {
  projectId: string;
  onRefresh: (opts?: { fresh?: boolean }) => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  variant?: 'legacy' | 'operations';
  context?: NoteDetailContext;
  defaultTab?: 'basic' | 'performance' | 'comments' | 'acceptance';
}) {
  const identity = useCacheIdentity();
  const [detail, setDetail] = useState<NoteDetail | null>(null);

  const openNote = useCallback(
    async (id: string) => {
      const detailUrl = '/api/notes/detail?id=' + encodeURIComponent(id) + '&projectId=' + encodeURIComponent(projectId);
      // Synchronous instant render if previously opened/cached
      const cacheKey = buildCacheKey(identity, projectId, detailUrl);
      const cached = getCachedQuery<NoteDetail>(cacheKey, identity);
      if (cached?.data) {
        setDetail(cached.data);
      }
      try {
        const data = await fetchWithCache<NoteDetail>(detailUrl, {
          identity,
          projectId,
          staleTime: 60 * 1000,
          ttl: 15 * 60 * 1000,
        });
        setDetail(data);
      } catch (err) {
        if (!cached?.data) {
          toast(err instanceof Error ? err.message : '明细加载失败', 'error');
        }
      }
    },
    [projectId, identity, toast]
  );

  const saveNote = useCallback(
    async (note: Note) => {
      try {
        await api('/api/resources', {
          method: 'POST',
          body: JSON.stringify({
            action: 'note_update',
            projectId,
            ...(note as unknown as Record<string, unknown>),
          }),
        });
        invalidateQueryCache({ projectId, endpoint: '/api/notes/detail' });
        toast('笔记资料已更新', 'success');
        setDetail(null);
        await onRefresh({ fresh: true });
      } catch (err) {
        toast(err instanceof Error ? err.message : '保存失败', 'error');
      }
    },
    [projectId, onRefresh, toast]
  );

  const removeNote = useCallback(
    async (note: Note) => {
      if (!confirm('确认将此笔记及当前项目内的评论快照移出项目？')) return;
      try {
        await api('/api/resources', {
          method: 'POST',
          body: JSON.stringify({ action: 'note_delete', projectId, id: note.id }),
        });
        invalidateQueryCache({ projectId, endpoint: '/api/notes/detail' });
        toast('笔记已移出当前项目', 'success');
        setDetail(null);
        await onRefresh({ fresh: true });
      } catch (err) {
        toast(err instanceof Error ? err.message : '删除失败', 'error');
      }
    },
    [projectId, onRefresh, toast]
  );

  const isOperations =
    variant === 'operations' || context === 'content' || context === 'comments' || context === 'acceptance' || context === 'growth' || context === 'insights';

  const renderDrawer = useCallback(() => {
    if (!detail) return null;
    if (isOperations) {
      return (
        <NoteDetailDrawer
          key={detail.note?.id || 'detail'}
          detail={detail}
          close={() => setDetail(null)}
          saveNote={saveNote}
          removeNote={removeNote}
          context={context || 'content'}
          defaultTab={defaultTab}
          projectId={projectId}
          onRefresh={onRefresh}
        />
      );
    }
    return (
      <DetailDrawer
        key={detail.note?.id || 'detail'}
        detail={detail}
        close={() => setDetail(null)}
        saveNote={saveNote}
        removeNote={removeNote}
      />
    );
  }, [detail, isOperations, saveNote, removeNote, context, defaultTab, projectId, onRefresh]);

  return {
    openNote,
    detail,
    closeDetail: () => setDetail(null),
    renderDrawer,
  };
}
