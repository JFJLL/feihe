import React from 'react';
import type { IndustryV2Report, IndustryV2Config } from '../../lib/industry-v2-types';
import { QueryPillBadge } from './IndustryV2Widgets';

export type IndustryTabType = 'overview' | 'content' | 'creators' | 'rhythm' | 'actions';

const TAB_ITEMS: Array<{ id: IndustryTabType; index: string; icon: string; name: string; count?: number }> = [
  { id: 'overview', index: '01', icon: '📊', name: '总览看板' },
  { id: 'content', index: '02', icon: '📝', name: '内容策略' },
  { id: 'creators', index: '03', icon: '👥', name: '达人策略' },
  { id: 'rhythm', index: '04', icon: '⏱️', name: '投放节奏' },
  { id: 'actions', index: '05', icon: '🚀', name: '机会行动' },
];

export function IndustryV2Header({
  projectName,
  spu,
  brand,
  configV2,
  report,
  canWrite,
  syncing,
  activeTab,
  selectedQueryId,
  onSelectTab,
  onSelectQuery,
  onOpenConfig,
  onTriggerEnqueue,
}: {
  projectName: string;
  spu: string;
  brand: string;
  configV2: IndustryV2Config | null;
  report: IndustryV2Report | null;
  canWrite: boolean;
  syncing: boolean;
  activeTab: IndustryTabType;
  selectedQueryId: string;
  onSelectTab: (tab: IndustryTabType) => void;
  onSelectQuery: (queryId: string) => void;
  onOpenConfig: () => void;
  onTriggerEnqueue: () => Promise<void>;
}) {
  const coverage = report?.coverage;
  const isRunning = coverage ? coverage.running > 0 : false;
  const isPending = !isRunning && (coverage ? coverage.pending > 0 : false);

  const latestCollectedText = report?.latestCollectedAt
    ? new Date(report.latestCollectedAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '暂无观测记录';

  // Priority: configV2.queries always contains the full list of queries for the project
  const queries = configV2?.queries || report?.config?.queries || [];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const currentIndex = TAB_ITEMS.findIndex((t) => t.id === activeTab);
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % TAB_ITEMS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = TAB_ITEMS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = TAB_ITEMS[nextIndex];
    onSelectTab(nextTab.id);
    const targetBtn = document.getElementById(`industry-tab-${nextTab.id}`);
    targetBtn?.focus();
  };

  return (
    <header className="v2-header">
      {/* Top Banner Row */}
      <div className="v2-banner">
        <div className="v2-banner-row">
          <div className="v2-banner-title-row">
            <span
              className={`v2-status-dot ${
                !spu
                  ? 'dot-error'
                  : isRunning
                  ? 'dot-running'
                  : isPending
                  ? 'dot-pending'
                  : coverage?.failed && coverage.failed > 0
                  ? 'dot-warning'
                  : 'dot-ready'
              }`}
              title={
                !spu
                  ? '缺少 SPU 配置'
                  : isRunning
                  ? '后台数据采集中'
                  : isPending
                  ? '任务排队等待执行'
                  : '数据已就绪'
              }
            />
            <h1 className="v2-project-title">行业洞察 {projectName}</h1>
            {spu && <span className="v2-tag v2-tag-spu">SPU: {spu}</span>}
            {brand && <span className="v2-tag v2-tag-brand">品牌: {brand}</span>}
            {configV2?.categoryKeyword && (
              <span className="v2-tag v2-tag-cat">品类: {configV2.categoryKeyword}</span>
            )}
            <span className="v2-tag v2-tag-source">数据源：小红书蒲公英</span>
            {configV2?.dailyEnabled === false && (
              <span
                className="v2-tag v2-tag-paused"
                title="每日自动更新已暂停，仍可随时点击右侧按钮手动排队补采"
              >
                自动更新已暂停
              </span>
            )}
          </div>


        {/* Right actions */}
        {canWrite && (
          <div className="v2-header-actions">
            <button
              type="button"
              className="v2-btn v2-btn-secondary"
              onClick={onOpenConfig}
            >
              ⚙️ 监测设置
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              disabled={syncing || isRunning || !spu}
              onClick={onTriggerEnqueue}
              title={
                !spu
                  ? '请先配置 SPU'
                  : isRunning
                  ? '后台采集中，请稍候'
                  : isPending
                  ? '将待补采任务交给后台调度，仍遵守每日额度；暂停自动更新时也可手动提交'
                  : '更新数据'
              }
            >
              {syncing
                ? '排队中...'
                : isRunning
                ? '采集中...'
                : isPending
                ? '⚡ 继续更新'
                : '⚡ 更新数据'}
            </button>
          </div>
        )}
        </div>

          {/* Collection Coverage Bar */}
          {coverage ? (
            <div className="v2-coverage-summary">
              <div className="v2-coverage-stats">
                <span className="v2-coverage-label">
                  采样覆盖区间：
                  <strong>{report?.from}</strong> 至 <strong>{report?.to}</strong>
                  <small>（截止上海前天（T-2），避开平台收录延迟）</small>
                <span className="v2-coverage-divider">/</span>
                  <span>最近真实抓取：<strong>{latestCollectedText}</strong></span>
                </span>
                <span className="v2-coverage-divider">|</span>
                <span className="v2-coverage-unit-label" title="统计口径：词×日任务（即 监控词数 × 监测天数）">
                  进度 (词×日任务)：
                </span>
                <span className="v2-coverage-badges">
                  <span className="v2-badge v2-badge-complete" title="已采完词×日任务数">
                    已采完: {coverage.complete} 词×日任务
                  </span>
                  {coverage.partial > 0 && (
                    <span
                      className="v2-badge v2-badge-partial"
                      title="部分覆盖：可能因单日3页预算截断、日期缺失或脏行导致，不伪装全量覆盖"
                    >
                      部分覆盖: {coverage.partial} 词×日任务
                    </span>
                  )}
                  {coverage.running > 0 && (
                    <span className="v2-badge v2-badge-running">
                      采集中: {coverage.running} 词×日任务
                    </span>
                  )}
                  {coverage.pending > 0 && (
                    <span className="v2-badge v2-badge-pending" title="任务已排队，等待调度器执行">
                      待调度: {coverage.pending} 词×日任务
                    </span>
                  )}
                  {coverage.failed > 0 && (
                    <span className="v2-badge v2-badge-failed">
                      异常: {coverage.failed} 词×日任务
                    </span>
                  )}

                </span>
              </div>
            </div>
          ) : (
            <div className="v2-coverage-summary">
              <span className="v2-coverage-label" style={{ color: '#60646c' }}>
                暂无采集覆盖记录
              </span>
            </div>
          )}
      </div>

      {/* Navigation Tabs */}
      <div className="v2-tabs-bar">
        <nav className="v2-nav-tabs" role="tablist" aria-label="行业洞察功能分页" onKeyDown={handleTabKeyDown}>
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tab.id === 'actions' ? report?.actions?.length : undefined;
            return (
              <button
                key={tab.id}
                id={`industry-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`industry-tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`v2-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.id as IndustryTabType)}
              >
                <span className="v2-tab-num">{tab.index}</span>
                <span className="v2-tab-icon">{tab.icon}</span>
                <span className="v2-tab-title">{tab.name}</span>
                {typeof count === 'number' && count > 0 && (
                  <span className="v2-tab-count">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Query selector pills */}
        {queries.length > 0 && (
          <div className="v2-query-filter-strip">
            <span className="v2-filter-label">监测词：</span>
            <button
              type="button"
              className={`v2-filter-pill ${selectedQueryId === 'all' ? 'active' : ''}`}
              onClick={() => onSelectQuery('all')}
            >
              全部监测词 ({queries.length} 词)
            </button>
            {queries.map((q) => (
              <button
                key={q.id}
                type="button"
                className={`v2-filter-pill ${selectedQueryId === q.id ? 'active' : ''}`}
                onClick={() => onSelectQuery(q.id)}
                title={`关键字: ${q.keyword}`}
              >
                <QueryPillBadge kind={q.kind} label={q.label} />
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
