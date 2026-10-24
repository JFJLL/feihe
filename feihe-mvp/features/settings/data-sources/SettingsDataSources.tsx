'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FeishuSources, SyncButton } from '../../../components/ui/FeishuSources';
import type { FeishuData } from '../../../lib/feishu-model';
import type { Source, Workspace } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { MetricCard } from '../../../components/ui/operations/MetricCard';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { api, cnTime } from '../../../lib/hooks/use-project-data';
import { FieldMappingEditor, type FieldMappingRule } from './FieldMappingEditor';
import { Dialog } from '../../../components/ui/Dialog';
import { inferColumnType } from '../../../lib/column-types';
import { transformMappedRows, mappingContextMatches, type MappingContext } from '../../../lib/field-mapping';

const emptySource: Record<string, unknown> = {
  name: '业务数据表',
  type: 'feishu_sheet',
  spreadsheet: '',
  sheetId: '',
  range: '',
  kind: 'general',
  syncFrequency: 'manual',
  mappingJson: '[]',
};

export function SettingsDataSources({
  projectId,
  workspace,
  onDone,
  toast,
  active = true,
}: {
  projectId: string;
  active?: boolean;
  workspace: Workspace | null;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [source, setSource] = useState<Record<string, unknown>>(emptySource);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState('');
  const submitLock = useRef(false);
  const confirmedSourceId = useRef('');
  const savedSnapshot = useRef('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [clientSyncErrors, setClientSyncErrors] = useState<Record<string, string>>({});
  const [feishu, setFeishu] = useState<FeishuData>();
  const [statusError, setStatusError] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [detectedSheets, setDetectedSheets] = useState<Array<{ sheetId: string; title: string; rowCount?: number }>>([]);

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawPreviewRows, setRawPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [mappingRules, setMappingRules] = useState<FieldMappingRule[]>([]);

  const inspectRequestId = useRef(0);
  const inspectAbort = useRef<AbortController | null>(null);
  const [mappingContext, setMappingContext] = useState<MappingContext | null>(null);
  const [inspectError, setInspectError] = useState('');
  function invalidateInspect() { inspectRequestId.current++; inspectAbort.current?.abort(); setInspecting(false); }
  function closeEditor() { if (submitLock.current) return; confirmedSourceId.current = ''; savedSnapshot.current = ''; setSaveFeedback(''); invalidateInspect(); setIsAdding(false); setSource(emptySource); setMappingContext(null); setRawHeaders([]); setRawPreviewRows([]); setMappingRules([]); }
  useEffect(() => () => { inspectRequestId.current++; inspectAbort.current?.abort(); }, [projectId]);
  useEffect(() => {
    if (!active) { inspectRequestId.current++; inspectAbort.current?.abort(); }
  }, [active]);
  if (!active && (isAdding || inspecting || Boolean(source.id))) {
    confirmedSourceId.current = ''; savedSnapshot.current = '';
    setIsAdding(false); setInspecting(false); setSource(emptySource);
  }
  const mappingErrors = transformMappedRows(rawPreviewRows, mappingRules).errors;

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  const statusRequest = useRef(0);
  const loadSources = useCallback(async () => {
    const requestId = ++statusRequest.current;
    try {
      const data = await api<FeishuData>(`/api/feishu/sync?projectId=${encodeURIComponent(projectId)}`);
      if (requestId !== statusRequest.current) return;
      setFeishu(data);
      setStatusError('');
    } catch (e) {
      if (requestId === statusRequest.current) setStatusError(e instanceof Error ? e.message : '同步状态加载失败');
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    api<FeishuData>(`/api/feishu/sync?projectId=${encodeURIComponent(projectId)}`).then((data) => {
      if (!cancelled) setFeishu(data);
    }).catch((e) => {
      if (!cancelled) setStatusError(e instanceof Error ? e.message : '同步状态加载失败');
    });
    return () => { cancelled = true; statusRequest.current++; };
  }, [projectId]);

  const sources = (workspace?.sources || []).filter((item) => item.projectId === projectId);
  const currentProject = workspace?.projects.find((item) => item.id === projectId);
  const syncedSources = sources.filter((item) => item.lastSyncedAt);
  const failedSources = sources.filter((item) => item.lastError || clientSyncErrors[item.id]);
  const latestSync = syncedSources.map((item) => item.lastSyncedAt).sort().at(-1);

  function handleUrlChange(newUrl: string) {
    invalidateInspect(); setMappingContext(null); setInspectError('');
    setSource((prev) => ({
      ...prev,
      spreadsheet: newUrl,
      sheetId: '',
      mappingJson: '[]',
    }));
    setDetectedSheets([]);
    setRawHeaders([]);
    setRawPreviewRows([]);
    setMappingRules([]);
  }

  async function handleInspectLink(targetSheetId?: string, draft = source) {
    const url = String(draft.spreadsheet || '').trim();
    if (!url) {
      toast('请先粘贴飞书表格链接', 'error');
      return;
    }

    invalidateInspect();
    const currentReqId = ++inspectRequestId.current;
    const controller = new AbortController(); inspectAbort.current = controller;
    setInspectError(''); setRawHeaders([]); setRawPreviewRows([]); setMappingRules([]); setMappingContext(null);
    setInspecting(true);

    try {
      const res = await api<{
        ok: boolean;
        detected: {
          type: string;
          sourceType?: string;
          documentToken?: string;
          sheetId?: string;
          sheets?: Array<{ sheetId: string; title: string; rowCount: number }>;
          preview?: { headers: string[]; rows: Array<Record<string, unknown>>; schema?: Array<{ key: string; type: string }> };
        };
      }>('/api/feishu/inspect', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({
          url,
          projectId,
          sheetId: targetSheetId || draft.sheetId || undefined,
        }),
      });

      if (currentReqId !== inspectRequestId.current) return;

      if (res.detected) {
        toast('链接解析成功', 'success');
        const sheetsList = res.detected.sheets || [];
        setDetectedSheets(sheetsList);

        const chosenSheetId = targetSheetId || draft.sheetId || (sheetsList[0] ? sheetsList[0].sheetId : '');
        setSource((prev) => ({
          ...prev,
          sheetId: chosenSheetId,
          type: res.detected.sourceType || prev.type,
          name: prev.name && prev.name !== '业务数据表' ? prev.name : (sheetsList.find((s) => s.sheetId === chosenSheetId)?.title || prev.name),
        }));

        if (res.detected.preview && res.detected.preview.headers?.length) {
          const hdrs = res.detected.preview.headers;
          const rows = res.detected.preview.rows || [];
          setRawHeaders(hdrs);
          setRawPreviewRows(rows);

          const context: MappingContext = { projectId, documentToken: res.detected.documentToken || url, sheetId: String(chosenSheetId), fields: res.detected.preview.schema || hdrs.map(key => ({ key, type: inferColumnType(rows.map(r => r[key])) })) };
          let savedRules: FieldMappingRule[] = [];
          let savedContext: MappingContext | null = null;
          try { const saved = JSON.parse(String(draft.mappingJson || '{}')); savedRules = Array.isArray(saved) ? saved : saved.rules || []; savedContext = saved.context || null; } catch {}
          const sameContext = mappingContextMatches(savedContext, context);
          const rules: FieldMappingRule[] = sameContext ? savedRules : hdrs.map(h => {
            const values = rows.map(r => r[h]);
            const type = inferColumnType(values) as FieldMappingRule['type'];
            const percent = type === 'number' && values.some(value => typeof value === 'string' && /%$/.test(value.trim()));
            return { sourceField: h, targetField: h, type, nullPolicy: 'null', ...(percent ? { numericUnit: 'percent', sourcePercentScale: 'fraction' } : {}) } as FieldMappingRule;
          });
          if (savedRules.length && !sameContext) toast('工作表或字段结构已变化，已清除旧映射，请重新确认', 'info');
          setMappingRules(rules); setMappingContext(context);
          setSource(prev => ({ ...prev, mappingJson: JSON.stringify({ rules, context }) }));
        }
      }
    } catch (err) {
      if (currentReqId === inspectRequestId.current) {
        setInspectError(err instanceof Error ? err.message : '检测链接失败');
        toast(err instanceof Error ? err.message : '检测链接失败', 'error');
      }
    } finally {
      if (currentReqId === inspectRequestId.current) {
        setInspecting(false);
      }
    }
  }

  function handleSheetChange(sheetId: string) {
    invalidateInspect(); setMappingContext(null); setRawHeaders([]); setRawPreviewRows([]); setMappingRules([]);
    const draft = { ...source, sheetId, mappingJson: '[]' };
    setSource(draft);
    void handleInspectLink(sheetId, draft);
  }

  async function saveSource(andSync = false) {
    if (submitLock.current || busy || inspecting || !mappingContext || mappingErrors.length) return;
    submitLock.current = true;
    setBusy('source');
    const mappingJson = JSON.stringify({ rules: mappingRules, context: mappingContext });
    const snapshot = JSON.stringify({ ...source, id: undefined, mappingJson });
    let effectiveSourceId = confirmedSourceId.current || String(source.id || '');
    let saved = Boolean(effectiveSourceId);
    let syncConfirmed = false;
    try {
      if (!andSync || savedSnapshot.current !== snapshot || !effectiveSourceId) {
        const saveRes = await api<{ ok: boolean; id: string }>('/api/projects', {
          method: 'POST', body: JSON.stringify({ ...source, id: effectiveSourceId || undefined, action: 'save_source', projectId, mappingJson }),
        });
        if (!saveRes.ok || !saveRes.id) throw new Error('配置保存响应缺少已确认的来源 ID');
        effectiveSourceId = saveRes.id;
        confirmedSourceId.current = saveRes.id;
        savedSnapshot.current = snapshot;
        setSource(prev => ({ ...prev, id: saveRes.id, mappingJson }));
        saved = true;
        setSaveFeedback('配置已保存；等待同步。可关闭后从来源列表继续处理。');
        toast('数据源配置已保存', 'success');
        await onDone();
      }
      if (andSync) {
        setSaveFeedback('配置已保存，正在同步…');
        const syncRes = await api<{ ok: boolean; imported: number }>('/api/feishu/sync', {
          method: 'POST', body: JSON.stringify({ projectId, sourceId: effectiveSourceId }),
        });
        if (!syncRes.ok) throw new Error('同步未确认成功');
        syncConfirmed = true;
        setClientSyncErrors(prev => ({ ...prev, [effectiveSourceId]: '' }));
        toast(`同步成功，已入库 ${syncRes.imported} 行数据`, 'success');
        await onDone();
      }
      submitLock.current = false;
      closeEditor();
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      if (syncConfirmed) {
        setSaveFeedback('同步已成功，列表刷新失败：' + message + '。配置与数据已保存，可刷新查看。');
      } else if (saved) {
        setSaveFeedback(andSync ? '配置已保存，同步未成功：' + message + '。可重试同步或修改映射后重试。' : '配置已保存，列表刷新失败：' + message + '。可刷新后继续同步。');
        if (andSync) setClientSyncErrors(prev => ({ ...prev, [effectiveSourceId]: message }));
        await onDone().catch(() => {});
      } else setSaveFeedback('配置保存失败：' + message);
      toast(message, 'error');
    } finally {
      submitLock.current = false;
      setBusy('');
      await loadSources();
    }
  }

  function handleEditExistingSource(item: Source) {
    invalidateInspect(); setMappingContext(null); setRawHeaders([]); setRawPreviewRows([]); setMappingRules([]);
    confirmedSourceId.current = item.id; savedSnapshot.current = '';
    setSaveFeedback(item.lastError || clientSyncErrors[item.id] ? '配置已保存，同步未成功。可重试同步或修改映射后重试。' : '配置已保存，可继续同步。');
    const draft = { id: item.id, name: item.name, type: item.type, spreadsheet: item.spreadsheet, sheetId: item.sheetId, range: item.range || '', kind: item.kind || 'general', syncFrequency: item.syncFrequency || 'manual', mappingJson: item.mappingJson || '[]' };
    setSource(draft); setIsAdding(true);
    if (item.spreadsheet) void handleInspectLink(item.sheetId, draft);
  }

  async function syncSource(item: Source) {
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setBusy(item.id);
    try {
      const res = await api<{ ok: boolean; imported: number; message?: string }>('/api/feishu/sync', {
        method: 'POST',
        body: JSON.stringify({ ...item, projectId: item.projectId, sourceId: item.id }),
      });
      toast(`${item.name} 同步完成（导入 ${res.imported} 行）`, 'success');
      setClientSyncErrors(prev => ({ ...prev, [item.id]: '' }));
      await onDone();
    } catch (err) {
      setClientSyncErrors(prev => ({ ...prev, [item.id]: err instanceof Error ? err.message : '同步失败' }));
      toast(err instanceof Error ? err.message : '同步失败', 'error');
      await onDone().catch(() => {});
    } finally {
      submitLock.current = false;
      setBusy('');
      await loadSources();
    }
  }

  function removeSource(item: Source) {
    setConfirmDialog({
      open: true,
      title: `移除数据源“${item.name}”`,
      description: '移除数据源后，系统将停止对该表格的同步。历史已导入的业务数据将予以保留。',
      onConfirm: async () => {
        setBusy(item.id);
        try {
          await api('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ action: 'remove_source', projectId: item.projectId, id: item.id }),
          });
          toast('数据源已移除', 'success');
          await onDone();
          await loadSources();
        } catch (err) {
          toast(err instanceof Error ? err.message : '移除失败', 'error');
        } finally {
          setBusy('');
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  return (
    <div className="stack">
      <section className="ops-metric-grid" aria-label="项目数据源同步概况">
        <MetricCard label="已配置数据源" value={workspace ? sources.length : '—'} unit="个" theme="blue" desc="当前项目手动登记的数据源，不含内置工作表" />
        <MetricCard label="有同步记录" value={workspace ? syncedSources.length : '—'} unit="个" theme="green" desc={latestSync ? `最近同步 ${cnTime(latestSync)}` : '尚无同步记录'} />
        <MetricCard label="需处理的数据源" value={workspace ? failedSources.length : '—'} unit="个" theme={failedSources.length ? 'red' : 'teal'} desc="按最近错误记录统计；详情见下方数据源列表" />
        <MetricCard label="最近读取行数合计" value={workspace && syncedSources.length ? syncedSources.reduce((sum, item) => sum + (Number(item.lastRowCount) || 0), 0).toLocaleString() : '—'} unit="行" theme="purple" desc="各源最近一次读取量相加，未经跨表去重；无记录显示 —" />
      </section>

      {statusError && <ErrorState error={`${statusError}${feishu ? '；下方保留上次读取的状态。' : ''}`} onRetry={loadSources} />}
      {!feishu && !statusError && <LoadingState text="正在读取同步核对状态…" />}

      {projectId === 'qicui' && feishu && (
        <section className="pastel-card reference-section section-teal">
          <div className="card-header-row">
            <div className="header-left">
              <span className="section-mini-tag tag-teal">内置工作表核对</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>真实同步快照</h3>
                <SyncButton projectId={projectId} onRefresh={async () => { await onDone(); await loadSources(); }} />
              </div>
            </div>
            <span className="header-tag">{feishu.checkedAt ? cnTime(feishu.checkedAt) : '尚未核对'}</span>
          </div>
          <p className="reference-note">已返回 {feishu.reports.length} 张工作表报告，其中 {feishu.reports.filter((r) => r.status === 'error').length} 张读取失败。投放数据截至 {feishu.latestDate || '暂无日期'}；同步核对时间不代表业务数据日期。</p>
          <p className="reference-note">展开下方溯源明细查看原表链接、工作表 ID、读取范围与逐表错误。</p>
          <FeishuSources data={feishu} projectId={projectId} />
        </section>
      )}

      <section className="settings-sources-section">
        <article className="platform-panel pastel-card reference-section section-teal">
          <div className="list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="section-kicker">CONNECTED SOURCES</div>
              <h2 style={{ margin: '2px 0 4px' }}>{currentProject?.name || '当前项目'}的数据源</h2>
              <p style={{ margin: 0 }}>支持飞书电子表格、多维表格与通用任务表接入；支持可视化字段映射与落库校验。</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="section-mini-tag tag-blue" style={{ fontSize: '12px', padding: '4px 10px' }}>
                共 {sources.length} 个配置
              </span>
              {!isAdding && !source.id && (
                <button
                  type="button"
                  className="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: 14 }}
                  onClick={() => {
                    confirmedSourceId.current = ''; savedSnapshot.current = ''; setSaveFeedback('');
                    invalidateInspect(); setMappingContext(null);
                    setSource(emptySource);
                    setDetectedSheets([]);
                    setRawHeaders([]);
                    setRawPreviewRows([]);
                    setMappingRules([]);
                    setIsAdding(true);
                  }}
                >
                  <span>＋</span> 接入飞书数据源
                </button>
              )}
            </div>
          </div>

          {(isAdding || Boolean(source.id)) && (
            <Dialog title={source.id ? '配置字段映射：' + String(source.name || '') : '接入飞书表格与可视化字段映射'} width={960} onClose={closeEditor} footer={<>              {/* Actions */}
              <div className="editor-actions" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={closeEditor}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid #cdced6', background: '#fff', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={busy === 'source' || inspecting || !mappingContext || mappingErrors.length > 0 || !source.name || !source.spreadsheet || !source.sheetId}
                  onClick={() => saveSource(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid #cdced6', background: '#fff', color: '#1c2024', cursor: 'pointer', fontWeight: 600 }}
                >
                  仅保存配置
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'source' || inspecting || !mappingContext || mappingErrors.length > 0 || !source.name || !source.spreadsheet || !source.sheetId}
                  onClick={() => saveSource(true)}
                  style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {busy === 'source' ? '正在执行…' : source.id ? (savedSnapshot.current === JSON.stringify({ ...source, id: undefined, mappingJson: JSON.stringify({ rules: mappingRules, context: mappingContext }) }) ? '重试同步' : '保存映射并重试同步') : '✓ 保存并首次同步'}
                </button>
              </div>
</>}>
              {saveFeedback && <div role="status" data-testid="source-save-status" style={{ overflowWrap: 'anywhere', marginBottom: 12 }}>{saveFeedback} {source.id ? `来源 ID：${source.id}` : ''}</div>}
              <fieldset disabled={busy === 'source'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              {/* Step 1: Basic Information */}
              <div className="platform-form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <label>
                  数据源名称
                  <input
                    value={String(source.name || '')}
                    placeholder="如：华北区门店咨询与签约表"
                    onChange={(e) => setSource({ ...source, name: e.target.value })}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>数据用途</span>
                  <CustomSelect
                    value={String(source.kind || 'general')}
                    onChange={(val) => setSource({ ...source, kind: val })}
                    options={[
                      { value: 'general', label: '通用表格数据集（任务、活动、预算、转化）', badge: '通用' },
                      { value: 'owned', label: '发布进度 / 自有笔记', badge: '内容' },
                      { value: 'supplier', label: '供应商评论交付', badge: '评论' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>同步策略</span>
                  <CustomSelect
                    value={String(source.syncFrequency || 'manual')}
                    onChange={(val) => setSource({ ...source, syncFrequency: val })}
                    options={[
                      { value: 'manual', label: '手动同步 (已就绪)', color: '#29a383' },
                      { value: 'hourly', label: '每小时自动 (调度待启用)', color: '#ffc53d', disabled: true },
                      { value: 'daily', label: '每日自动 (调度待启用)', color: '#60646c', disabled: true },
                    ]}
                    style={{ width: '100%' }}
                  />
                </label>

                {/* Link and Detect */}
                <label className="full">
                  飞书表格链接（支持电子表格、多维表格与 Wiki 节点）
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input
                      style={{ flex: 1 }}
                      value={String(source.spreadsheet || '')}
                      aria-label="飞书表格链接"
                      placeholder="https://yimeichuanbo.feishu.cn/wiki/... 或 sheets/... 或 base/..."
                      onChange={(e) => handleUrlChange(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={inspecting || !source.spreadsheet}
                      onClick={() => handleInspectLink()}
                      style={{ padding: '0 16px', borderRadius: 6, border: '0.5px solid #0d74ce', background: '#e6f4fe', color: '#0d74ce', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600 }}
                    >
                      {inspecting ? '正在检测…' : '智能检测工作表 ↗'}
                    </button>
                  </div>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>目标工作表 (Sheet / Table ID)</span>
                  {detectedSheets.length > 0 ? (
                    <CustomSelect
                      ariaLabel="目标工作表"
                      value={String(source.sheetId || '')}
                      onChange={(val) => handleSheetChange(val)}
                      placeholder="-- 请选择工作表 / 数据表 --"
                      options={[
                        { value: '', label: '-- 请选择工作表 / 数据表 --' },
                        ...detectedSheets.map((s) => ({
                          value: s.sheetId,
                          label: `${s.title} (${s.sheetId})`,
                        })),
                      ]}
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <input
                      value={String(source.sheetId || '')}
                      placeholder="点击上方智能检测自动选择"
                      onChange={(e) => setSource({ ...source, sheetId: e.target.value })}
                      style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '0.5px solid #cdced6', fontSize: 14 }}
                    />
                  )}
                </label>

                <label>
                  读取范围 (普通电子表格适用)
                  <input
                    value={String(source.range || '')}
                    placeholder="留空为全表；填入范围将明确限制读取"
                    onChange={(e) => setSource({ ...source, range: e.target.value })}
                  />
                </label>
              </div>

              {inspectError && <div role="alert">{inspectError}</div>}
              <p>读取范围留空表示完整工作表；指定范围时只同步该范围。</p>
              {/* Visual Field Mapping Editor */}
              {rawHeaders.length > 0 && (
                <FieldMappingEditor
                  rawHeaders={rawHeaders}
                  rawPreviewRows={rawPreviewRows}
                  mappingRules={mappingRules}
                  onChange={(updated) => {
                    setMappingRules(updated);
                    setSource((prev) => ({ ...prev, mappingJson: JSON.stringify({ rules: updated, context: mappingContext }) }));
                  }}
                />
              )}

              </fieldset>
            </Dialog>
          )}

          <div className="management-list" style={{ marginTop: '14px' }}>
            {sources.length ? (
              sources.map((item) => (
                <div key={item.id} className="source-list-item" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#ffffff', border: '0.5px solid #d9d9e0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(28, 32, 36, 0.03)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e6f4fe', color: '#0d74ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                    飞
                  </div>
                  <div className="source-list-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, overflowWrap: 'anywhere' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '14px', color: '#1c2024' }}>{item.name}</strong>
                      <span className="section-mini-tag tag-blue" style={{ fontSize: 12 }}>
                        {item.kind === 'general' ? '通用数据集' : item.kind === 'owned' ? '发布进度' : item.kind === 'supplier' ? '供应商交付' : item.kind || '未标注用途'} ·{' '}
                      </span>
                      <span style={{ fontSize: 12, color: '#60646c', background: '#f0f0f3', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.syncFrequency === 'hourly' ? '每小时自动(待启用)' : item.syncFrequency === 'daily' ? '每日自动(待启用)' : '手动同步'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#60646c', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>工作表：<code style={{ color: '#0d74ce' }}>{item.sheetId || '未填写 Sheet ID'}</code></span>
                      <span>范围：<code>{item.range || '全表'}</code></span>
                      <span>最近读取：<strong>{item.lastSyncedAt ? (String(item.lastRowCount) + ' 行') : '—'}</strong></span>
                    </div>
                    {(item.lastError || clientSyncErrors[item.id]) && (
                      <div style={{ fontSize: 12, color: '#ce2c31' }}>
                        ⚠ 配置已保存，同步未成功：{item.lastError || clientSyncErrors[item.id]}
                      </div>
                    )}
                  </div>
                  <div className="source-list-status" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: !item.lastError && !clientSyncErrors[item.id] && (item.status?.includes('正常') || item.status?.includes('已连接')) ? '#29a383' : '#ffc53d' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: !item.lastError && !clientSyncErrors[item.id] && (item.status?.includes('正常') || item.status?.includes('已连接')) ? '#29a383' : '#ffc53d' }} />
                      {item.lastError || clientSyncErrors[item.id] ? '同步失败' : item.lastSyncedAt ? '同步成功' : '配置已保存 · 待首次同步'}
                    </span>
                    <div style={{ fontSize: 12, color: '#60646c', marginTop: '2px' }}>
                      {item.lastSyncedAt ? cnTime(item.lastSyncedAt) : '暂未同步'}
                    </div>
                  </div>
                  <div className="source-list-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => handleEditExistingSource(item)}
                      style={{ padding: '6px 10px', fontSize: 14, borderRadius: '6px', border: '0.5px solid #cdced6', background: '#fff', color: '#1c2024', cursor: 'pointer', fontWeight: 500 }}
                    >
                      ✏ 编辑/映射
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy) || !item.spreadsheet || !item.sheetId}
                      onClick={() => syncSource(item)}
                      style={{ padding: '6px 12px', fontSize: 14, borderRadius: '6px', border: '0.5px solid #0d74ce', background: '#e6f4fe', color: '#0d74ce', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {busy === item.id ? '同步中…' : '立即同步'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => removeSource(item)}
                      style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '0.5px solid #cdced6', background: '#fff', color: '#e5484d', cursor: 'pointer' }}
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="当前项目尚未配置数据源" text="点击上方「接入飞书数据源」开始绑定飞书表格或多维表格。" />
            )}
          </div>
        </article>
      </section>

      <Dialog open={confirmDialog.open} title={confirmDialog.title} onClose={() => { if (!busy) setConfirmDialog(prev => ({ ...prev, open: false })); }} width={460} footer={<><button disabled={Boolean(busy)} onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>取消</button><button disabled={Boolean(busy)} onClick={() => void confirmDialog.onConfirm()}>{busy ? '正在移除…' : '确认移除'}</button></>}><p>{confirmDialog.description}</p></Dialog>
    </div>
  );
}
