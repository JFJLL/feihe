'use client';

import React, { useState, useCallback } from 'react';
import type { Note, NoteDetail } from '../types/project';
import { DetailDrawer } from '../../features/content/DetailDrawer';
import { api } from './use-project-data';

export function useNoteDetail({
  projectId,
  onRefresh,
  toast,
}: {
  projectId: string;
  onRefresh: () => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [detail, setDetail] = useState<NoteDetail | null>(null);

  const openNote = useCallback(
    async (id: string) => {
      try {
        const data = await api<NoteDetail>(
          '/api/notes/detail?id=' + encodeURIComponent(id) + '&projectId=' + encodeURIComponent(projectId)
        );
        setDetail(data);
      } catch (err) {
        toast(err instanceof Error ? err.message : '明细加载失败', 'error');
      }
    },
    [projectId, toast]
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
        toast('笔记资料已更新', 'success');
        setDetail(null);
        await onRefresh();
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
        toast('笔记已移出当前项目', 'success');
        setDetail(null);
        await onRefresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : '删除失败', 'error');
      }
    },
    [projectId, onRefresh, toast]
  );

  const renderDrawer = useCallback(() => {
    if (!detail) return null;
    return (
      <DetailDrawer
        key={detail.note?.id || 'detail'}
        detail={detail}
        close={() => setDetail(null)}
        saveNote={saveNote}
        removeNote={removeNote}
      />
    );
  }, [detail, saveNote, removeNote]);

  return {
    openNote,
    detail,
    closeDetail: () => setDetail(null),
    renderDrawer,
  };
}