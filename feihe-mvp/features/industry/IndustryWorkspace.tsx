'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { IndustryV2Report, IndustryV2Config } from '../../lib/industry-v2-types';
import { IndustryV2Header, type IndustryTabType } from './IndustryV2Header';
import { IndustryV2ConfigDialog } from './IndustryV2ConfigDialog';
import { IndustryV2OverviewTab } from './IndustryV2OverviewTab';
import { IndustryV2ContentTab } from './IndustryV2ContentTab';
import { IndustryV2CreatorsTab } from './IndustryV2CreatorsTab';
import { IndustryV2RhythmTab } from './IndustryV2RhythmTab';
import { IndustryV2ActionsTab } from './IndustryV2ActionsTab';
import { EmptyStateBox } from './IndustryV2Widgets';
import './industry.css';

export function IndustryWorkspace({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spu, setSpu] = useState('');
  const [brand, setBrand] = useState('');
  const [projectName, setProjectName] = useState(projectId);
  const [canWrite, setCanWrite] = useState(false);
  const [configV2, setConfigV2] = useState<IndustryV2Config | null>(null);
  const [report, setReport] = useState<IndustryV2Report | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<IndustryTabType>('overview');
  const [selectedQueryId, setSelectedQueryId] = useState<string>('all');
  const [isPolling, setIsPolling] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Generation tracking strictly avoids cross-project and cross-query state pollution
  const generationRef = useRef(0);
  const [requestGeneration, setRequestGeneration] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollInFlightRef = useRef(false);

  // Helper to start a fresh generation and cancel any existing requests
  const startNewGeneration = useCallback(() => {
    generationRef.current += 1;
    setRequestGeneration(generationRef.current);
    setSyncing(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    return generationRef.current;
  }, []);

  // Server-side fetch with queryId support
  const loadData = useCallback(
    async (gen: number, queryId: string, isPoll = false) => {
      if (gen !== generationRef.current) return;
      if (isPoll && pollInFlightRef.current) return;

      if (!isPoll) {
        setLoading(true);
        setError(null);
      } else {
        pollInFlightRef.current = true;
      }

      try {
        const queryParam =
          queryId && queryId !== 'all' ? `&queryId=${encodeURIComponent(queryId)}` : '';
        const res = await fetch(
          `/api/industry?projectId=${encodeURIComponent(projectId)}${queryParam}`,
          {
            cache: 'no-store',
            signal: abortControllerRef.current?.signal,
          }
        );

        if (gen !== generationRef.current) return;

        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          spu?: string;
          brand?: string;
          projectName?: string;
          canWrite?: boolean;
          configV2?: IndustryV2Config | null;
          report?: IndustryV2Report | null;
        };

        if (!res.ok || !json.ok) {
          throw new Error(json.error || '获取行业分析报告失败');
        }

        if (gen !== generationRef.current) return;

        setSpu(json.spu || '');
        setBrand(json.brand || '');
        setProjectName(json.projectName || projectId);
        setCanWrite(Boolean(json.canWrite));
        if (json.configV2 !== undefined) {
          setConfigV2(json.configV2 || null);
        }
        setReport(json.report || null);

        // Auto-poll logic: if tasks are still active (running > 0 or pending > 0), ensure polling is active
        const cov = json.report?.coverage;
        const hasActiveTasks = cov ? cov.running > 0 || cov.pending > 0 : false;
        setIsPolling(hasActiveTasks);
      } catch (err: unknown) {
        if (abortControllerRef.current?.signal.aborted) return;
        if (gen !== generationRef.current) return;
        if (!isPoll) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isPoll) {
          pollInFlightRef.current = false;
        }
        if (gen === generationRef.current && !isPoll) {
          setLoading(false);
        }
      }
    },
    [projectId]
  );

  // Project switch effect
  useEffect(() => {
    let ignore = false;
    const currentGen = startNewGeneration();

    void Promise.resolve().then(() => {
      if (!ignore) {
        setReport(null);
        setConfigV2(null);
        setSpu('');
        setBrand('');
        setProjectName(projectId);
        setError(null);
        setSelectedQueryId('all');
        setIsPolling(false);
        setFeedbackMessage(null);
        void loadData(currentGen, 'all', false);
      }
    });

    return () => {
      ignore = true;
      generationRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, [projectId, loadData, startNewGeneration]);

  // Handle switching query filter: allocates new generation and aborts any prior requests
  const handleSelectQuery = (newQueryId: string) => {
    setSelectedQueryId(newQueryId);
    setReport(null);
    const newGen = startNewGeneration();
    void loadData(newGen, newQueryId, false);
  };

  // Serial polling timer: poll every 5s after the previous poll finishes
  // Captures effectGen at effect setup time to avoid executing on bumped generation
  useEffect(() => {
    if (!isPolling) return;
    let active = true;
    const effectGen = generationRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextPoll = () => {
      if (!active || effectGen !== generationRef.current) return;
      timer = setTimeout(async () => {
        if (!active || effectGen !== generationRef.current) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          // Skip while tab hidden, reschedule check in 5s
          scheduleNextPoll();
          return;
        }
        await loadData(effectGen, selectedQueryId, true);
        if (active && effectGen === generationRef.current && isPolling) {
          scheduleNextPoll();
        }
      }, 5000);
    };

    scheduleNextPoll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [isPolling, selectedQueryId, loadData, requestGeneration]);

  // Trigger background progressive sync enqueue
  const handleTriggerEnqueue = async () => {
    const reqGen = startNewGeneration();
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enqueue_v2',
          projectId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '排队补采发起失败');
      }

      if (reqGen !== generationRef.current) return;

      setFeedbackMessage('排队成功！任务已提交队列，等待调度器执行，每 5 秒自动检测进度。');
      setIsPolling(true);
      await loadData(reqGen, selectedQueryId, true);
    } catch (err) {
      if (reqGen !== generationRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqGen === generationRef.current) {
        setSyncing(false);
      }
    }
  };

  // Callback after saving config:
  // Reset selectedQueryId to 'all' to prevent 400 on deleted queries and bump generation
  const handleConfigSaved = async (enqueueTriggered?: boolean) => {
    setSelectedQueryId('all');
    const newGen = startNewGeneration();

    if (enqueueTriggered) {
      setFeedbackMessage('配置已保存，补采任务已排队，等待后台调度执行...');
      setIsPolling(true);
    } else {
      setFeedbackMessage('配置已成功保存。');
    }
    await loadData(newGen, 'all', false);
  };

  // Initial loading state
  if (loading && !report) {
    return (
      <div className="v2-loading-screen">
        <div className="v2-spinner" />
        <p>正在读取行业洞察多维采样数据与配置…</p>
      </div>
    );
  }

  // Check for persistent error or lastError
  const covFailedCount = report?.coverage?.failed || 0;
  const lastErrorText =
    covFailedCount > 0
      ? `采样覆盖中有 ${covFailedCount} 项遇到异常，建议检查接口配额或稍后重试`
      : null;

  return (
    <div className="industry-workspace v2-workspace">
      {/* Header and Controls */}
      <IndustryV2Header
        projectName={projectName}
        spu={spu}
        brand={brand}
        configV2={configV2}
        report={report}
        canWrite={canWrite}
        syncing={syncing}
        activeTab={activeTab}
        selectedQueryId={selectedQueryId}
        onSelectTab={setActiveTab}
        onSelectQuery={handleSelectQuery}
        onOpenConfig={() => setConfigDialogOpen(true)}
        onTriggerEnqueue={handleTriggerEnqueue}
      />

      {/* Notice / Feedback Banner */}
      {feedbackMessage && (
        <div className="v2-feedback-banner">
          <span>ℹ️ {feedbackMessage}</span>
          <button
            type="button"
            className="v2-btn-close-sm"
            onClick={() => setFeedbackMessage(null)}
            aria-label="关闭提示"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="v2-alert-error" role="alert">
          <strong>⚠️ 异常提示：</strong> {error}
        </div>
      )}

      {/* Background Partial/Failed Notice */}
      {lastErrorText && !error && (
        <div className="v2-feedback-banner" style={{ background: '#fff7c2', borderColor: '#f3d673', color: '#ab6400' }}>
          <span>⚠️ {lastErrorText}</span>
        </div>
      )}

      {/* Missing SPU Callout */}
      {!spu && (
        <div className="v2-missing-spu-box">
          <h4>未配置项目 SPU（标准品名）：</h4>
          <p>
            行业洞察严格依据项目持久化的 SPU 与竞品词包发起检索。当前项目尚未配置 SPU，请前往「<strong>项目设置 &gt; 项目资料</strong>」维护 SPU（如“星飞帆”、“卓睿”）或点击上方「配置词包」维护品类与竞品词。
          </p>
        </div>
      )}

      {/* Main Tab Content */}
      {report ? (
        <div
          className="v2-main-content"
          key={`${projectId}:${selectedQueryId}`}
          id={`industry-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`industry-tab-${activeTab}`}
        >
          {activeTab === 'overview' && (
            <IndustryV2OverviewTab
              report={report}
              onSelectQuery={handleSelectQuery}
            />
          )}
          {activeTab === 'content' && <IndustryV2ContentTab report={report} />}
          {activeTab === 'creators' && <IndustryV2CreatorsTab report={report} />}
          {activeTab === 'rhythm' && <IndustryV2RhythmTab report={report} />}
          {activeTab === 'actions' && <IndustryV2ActionsTab report={report} />}
        </div>
      ) : (
        !error && (
          <EmptyStateBox
            title="暂无行业洞察报告"
            message={
              spu
                ? '当前项目尚未生成分析快照。请点击上方「排队补采」或「配置词包」启动数据采集。'
                : '请先维护本品 SPU 或配置监测词包。'
            }
            action={
              canWrite && spu ? (
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={handleTriggerEnqueue}
                  disabled={syncing}
                >
                  {syncing ? '排队中...' : '立即排队补采近 30 天'}
                </button>
              ) : null
            }
          />
        )
      )}

      {/* Config Dialog */}
      <IndustryV2ConfigDialog
        key={projectId}
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        projectId={projectId}
        spu={spu}
        brand={brand}
        initialConfig={configV2}
        onSaved={handleConfigSaved}
      />
    </div>
  );
}
