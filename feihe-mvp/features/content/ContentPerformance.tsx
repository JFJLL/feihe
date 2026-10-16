'use client';

import { useMemo } from 'react';
import { contentDirectionLabel, aggregateTopics } from '../../lib/dashboard-display';
import { NoteThumbnail } from '../../components/ui/NoteThumbnail';
import { ContentAnalyticsBoard } from './ContentAnalyticsBoard';
import { ScenePerformanceBoard } from './ScenePerformanceBoard';

import type { Dashboard, AnalyticRow, Note } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { MatrixHeatmap, WordCloudChart, TreeMapChart } from '../overview/AdvancedCharts';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function cleanLabelText(value: unknown, fallback = '其他') {
  const text = String(value || '').trim();
  if (!text || /https?:\/\/|\uFFFD/.test(text) || text.length > 30) return fallback;
  return contentDirectionLabel(text, fallback);
}

function DistributionBars({
  rows,
  valueKey,
  labelKey,
  empty,
  secondaryKey,
  secondaryUnit = '',
  valueUnit = '',
  limit = 10,
  onItemClick,
}: {
  rows: AnalyticRow[];
  valueKey: string;
  labelKey: string;
  empty: string;
  secondaryKey?: string;
  secondaryUnit?: string;
  valueUnit?: string;
  limit?: number;
  onItemClick?: (row: AnalyticRow) => void;
}) {
  const validVals = rows.map((x) => num(x[valueKey])).filter((v): v is number => Number.isFinite(v) && v > 0);
  const max = validVals.length ? Math.max(0, ...validVals) : 0;
  const list = rows.slice(0, limit);
  return (
    <div className="distribution-bars">
      {list.length ? (
        list.map((row, index) => {
          const rawVal = row[valueKey];
          const isObserved = rawVal !== null && rawVal !== undefined && Number.isFinite(num(rawVal));
          const val = isObserved ? num(rawVal) : 0;
          const isPos = isObserved && val > 0;
          const pctWidth = isPos && max > 0 ? (val / max) * 100 : 0;
          const secVal = secondaryKey ? row[secondaryKey] : (row.desc ? row.desc : undefined);
          const secText = secVal !== undefined && secVal !== null
            ? (typeof secVal === 'number' && Number.isFinite(secVal) ? compact(secVal) + (secondaryUnit ? ` ${secondaryUnit}` : '') : String(secVal))
            : null;
          return (
            <div key={String(row[labelKey] || index) + '-' + index} onClick={() => onItemClick && onItemClick(row)} style={{ cursor: onItemClick ? 'pointer' : 'default' }} title={onItemClick ? '点击查看该分类下的笔记' : undefined}>
              <span title={String(row[labelKey] || '')}>{cleanLabelText(row[labelKey], '其他')}</span>
              <i>
                <b style={{ width: `${pctWidth}%`, background: isObserved ? undefined : '#cbd5e1' }} />
              </i>
              <div style={{ display: 'flex', gap: 2, flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                <strong style={{ color: isObserved ? '#0f172a' : '#94a3b8', fontWeight: isObserved ? 600 : 400 }}>
                  {isObserved ? `${compact(val)}${valueUnit ? ` ${valueUnit}` : ''}` : '—'}
                </strong>
                {secText && (
                  <em style={{ color: '#64748b', fontSize: '11px', fontStyle: 'normal' }}>
                    {secText}
                  </em>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty">{empty}</div>
      )}
    </div>
  );
}

function displayTag(value: unknown, fallback: string) {
  const text = String(value || '').trim();
  return !text || /https?:\/\/|\uFFFD/.test(text) || text.length > 30 ? fallback : text;
}

function TopNotes({
  rows,
  openNote,
}: {
  rows: AnalyticRow[];
  openNote: (id: string) => void;
}) {
  return (
    <div className="hot-note-grid">
      {rows.length ? (
        rows.slice(0, 12).map((note, index) => (
          <article key={String(note.id)}>
            <div>
              <NoteThumbnail
                src={String(note.coverUrl || '')}
                title={String(note.title || '')}
                author={String(note.author || '')}
                category={contentDirectionLabel(note.category1, '分类待补充')}
                className="note-radar-cover"
                eager={index < 3}
              />
            </div>
            <strong>{String(note.title || note.id)}</strong>
            <p>
              {String(note.author || '未知作者')} · {displayTag(note.brand || note.productScope, '品牌待补充')}
            </p>
            <dl>
              <div>
                <dt>阅读</dt>
                <dd>{compact(note.readCount)}</dd>
              </div>
              <div>
                <dt>互动</dt>
                <dd>{compact(note.interactionCount)}</dd>
              </div>
              <div>
                <dt>评论</dt>
                <dd>{compact(note.commentTotal)}</dd>
              </div>
            </dl>
            <button onClick={() => openNote(String(note.id))}>查看笔记明细 →</button>
          </article>
        ))
      ) : (
        <EmptyState title="暂无笔记排行" text="同步笔记表现指标后生成高价值笔记排行。" />
      )}
    </div>
  );
}

export function ContentPerformance({
  data,
  openNote,
  openCategoryNotes,
}: {
  data: Dashboard;
  openNote: (id: string) => void;
  openCategoryNotes?: (opts: { title: string; subtitle?: string; tag?: string; notes: Note[]; maxCount?: number }) => void;
}) {
  const handlePipelineClick = (pipeName: string) => {
    if (!openCategoryNotes) return;
    const clean = pipeName.trim();
    const matched = (data.notes || []).filter(n => {
      const p = (n.pipeline || "").trim();
      return p === clean || clean.includes(p) || (n.title || "").includes(clean);
    });
    openCategoryNotes({
      title: "投放管线 · " + clean,
      subtitle: "该管线共归属 " + matched.length + " 篇笔记，展示前 50 篇（按互动量降序）",
      tag: "投放管线",
      notes: matched.length ? matched : (data.notes || []).slice(0, 30),
      maxCount: 50,
    });
  };

  const handleCategoryClick = (categoryName: string) => {
    if (!openCategoryNotes) return;
    const normTarget = contentDirectionLabel(categoryName);
    const matched = (data.notes || []).filter(n => {
      return (n.category1 === categoryName) || (contentDirectionLabel(n.category1) === normTarget);
    });
    openCategoryNotes({
      title: '内容切角 / 场景 · ' + normTarget,
      subtitle: '该分类下共关联 ' + matched.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '内容切角',
      notes: matched,
      maxCount: 50,
    });
  };

  const handleTierClick = (tierLabel: string) => {
    if (!openCategoryNotes) return;
    const cleanLabel = tierLabel.trim();
    const matched = (data.notes || []).filter(n => {
      const l = (n.creatorLevel || '未标注').trim();
      return l === cleanLabel || l.includes(cleanLabel) || cleanLabel.includes(l);
    });
    openCategoryNotes({
      title: '达人层级 · ' + cleanLabel,
      subtitle: '该层级共收录 ' + matched.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '达人层级',
      notes: matched,
      maxCount: 50,
    });
  };

  const handleLocationClick = (locName: string) => {
    if (!openCategoryNotes) return;
    const clean = locName.trim();
    const matched = (data.notes || []).filter(n => (n.province || '').trim() === clean || (n.city || '').trim() === clean);
    openCategoryNotes({
      title: '达人地域 · ' + clean,
      subtitle: '该地域共收录 ' + matched.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '达人地域',
      notes: matched,
      maxCount: 50,
    });
  };

  const handleSceneRowClick = (scene: string, level: string, matchedNotes: Note[]) => {
    if (!openCategoryNotes) return;
    const normScene = contentDirectionLabel(scene);
    openCategoryNotes({
      title: '方向×达人层级 · ' + normScene + ' / ' + level,
      subtitle: '该交叉维度下共关联 ' + matchedNotes.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '细分场景',
      notes: matchedNotes,
      maxCount: 50,
    });
  };

  const handleTreeMapClick = (item: { label: string; value: number }) => {
    if (!openCategoryNotes) return;
    const clean = item.label.trim();
    const normClean = contentDirectionLabel(clean);
    const matched = (data.notes || []).filter(n => {
      const c = (n.category1 || '').trim();
      return c === clean || contentDirectionLabel(c) === normClean || c.includes(clean);
    });
    openCategoryNotes({
      title: '内容场景 · ' + clean,
      subtitle: '场景下共关联 ' + matched.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '场景树状图',
      notes: matched,
      maxCount: 50,
    });
  };

  const handleFormatClick = (formatName: string) => {
    if (!openCategoryNotes) return;
    const clean = formatName.trim();
    const matched = (data.notes || []).filter(n => (n.noteType || '待补充').trim() === clean);
    openCategoryNotes({
      title: '内容形式 · ' + clean,
      subtitle: '该形式共收录 ' + matched.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '内容形式',
      notes: matched,
      maxCount: 50,
    });
  };

  const handleSourceClick = (sourceName: string) => {
    if (!openCategoryNotes) return;
    const clean = sourceName.trim();
    const matched = (data.notes || []).filter(n => {
      const s = n.sourceType || '';
      if (clean === '自有发布') return s === 'owned';
      if (clean === '商业合作') return s === 'commercial';
      if (clean === '外部扫描' || clean === '关键词扫描') return s === 'scanned' || s === 'keyword_scan';
      return s === clean;
    });
    openCategoryNotes({
      title: '内容来源 · ' + clean,
      subtitle: '该来源下共收录 ' + matched.length + ' 篇笔记，展示前 50 篇（按互动量降序）',
      tag: '内容来源',
      notes: matched,
      maxCount: 50,
    });
  };

  const m = data.metrics;
  const q = data.analytics.dataQuality;
  const total = num(q.total);
  const totalCategoryNotes = (data.analytics.categories || []).reduce((sum, r) => sum + num(r.count), 0) || 1;
  const categoriesWithShare = (data.analytics.categories || []).slice(0, 10).map(r => ({
    ...r,
    shareText: `${((num(r.count) / totalCategoryNotes) * 100).toFixed(1)}% 占比`,
  }));

  // 1. 一级方向互动贡献（按互动总量降序排列，与左侧发文篇数形成深度比照，双列等高）
  const categoryInteractions = [...(data.analytics.categories || [])]
    .filter((row) => num(row.interactions) > 0 || num(row.count) > 0)
    .sort((a, b) => num(b.interactions) - num(a.interactions))
    .slice(0, 10);

  // 2. 核心互动类型构成（点赞、收藏、分享、真实评论转化结构，区分未细分字段与真实0）
  const interactionTotal = num(m.interactionCount) || 1;
  const hasLike = typeof m.likeCount === 'number' && Number.isFinite(m.likeCount);
  const hasFav = typeof m.favoriteCount === 'number' && Number.isFinite(m.favoriteCount);
  const hasShare = typeof m.shareCount === 'number' && Number.isFinite(m.shareCount);
  const hasComment = typeof m.commentTotal === 'number' && Number.isFinite(m.commentTotal);

  const interactionBreakdown: AnalyticRow[] = [
    {
      name: '点赞互动',
      count: hasLike ? m.likeCount! : null,
      rate: hasLike ? (m.likeCount as number) / interactionTotal : null,
      desc: hasLike ? null : '源表未细分点赞',
    },
    {
      name: '收藏转化',
      count: hasFav ? m.favoriteCount! : null,
      rate: hasFav ? (m.favoriteCount as number) / interactionTotal : null,
      desc: hasFav ? null : '源表未细分收藏',
    },
    {
      name: '主动分享',
      count: hasShare ? m.shareCount! : null,
      rate: hasShare ? (m.shareCount as number) / interactionTotal : null,
      desc: hasShare ? null : '源表未细分分享',
    },
    {
      name: '真实评论',
      count: hasComment ? m.commentTotal! : null,
      rate: hasComment ? (m.commentTotal as number) / interactionTotal : null,
      desc: null,
    },
  ];

  // 3. 达人地域分布（过滤待补充并显示明确归属省市，真实比例展示）
  const validLocations = (data.analytics.locations || [])
    .filter((row) => row.name && row.name !== '待补充' && num(row.count) > 0)
    .sort((a, b) => num(b.count) - num(a.count));
  const unmappedLocation = (data.analytics.locations || []).find((row) => row.name === '待补充');
  const unmappedCount = unmappedLocation ? num(unmappedLocation.count) : 0;
  const mappedCount = validLocations.reduce((sum, r) => sum + num(r.count), 0);

  // 4. 投放需求管线交付与预算执行
  const pipelines = data.pipelines || [];

  // 5. 评论预警处置与闭环进度
  const actions = m.actions || {};
  const sentimentActionRows: AnalyticRow[] = [
    ...(m.questionCount !== null ? [{ name: '求助/购买问询', count: m.questionCount, desc: '转化与导流机会' }] : []),
    { name: '待回复跟进', count: num(actions.replyPending), desc: '运营工单' },
    ...(m.positiveCount !== null ? [{ name: '正向赞誉口碑', count: m.positiveCount, desc: '高价值口碑' }] : []),
    { name: '待删除处置', count: num(actions.deletePending), desc: '违规/竞品干扰' },
    ...(m.negativeCount !== null ? [{ name: '负向敏感预警', count: m.negativeCount, desc: '客诉舆情预警' }] : []),
  ];

  // 6. 品牌声量与千次投放成效
  const brandEfficiencyRows: AnalyticRow[] = [
    { name: '累计全盘曝光', count: num(m.exposure), desc: num(m.cpm) ? `CPM ¥${num(m.cpm).toFixed(2)}` : '曝光大盘' },
    { name: '累计总阅读量', count: num(m.readCount), desc: num(m.cpr) ? `CPR ¥${num(m.cpr).toFixed(2)}` : '阅读成本未提供' },
    { name: '累计总互动量', count: num(m.interactionCount), desc: num(m.cpe) ? `CPE ¥${num(m.cpe).toFixed(2)}` : '互动成本未提供' },
    { name: '全盘平均互动率', count: Number((num(m.engagementRate) * 100).toFixed(2)), desc: '项目已记录互动/阅读', unit: '%' },
    { name: '达人合作总支出', count: num(m.creatorCost), desc: `覆盖 ${num(q.metricCount)} 篇`, isCurrency: 1 },
  ];

  // 7. 达人层级样本均值精确统计：区分真实观测为0与未采集/无样本（显示为 —），分母仅计有效观测样本
  const creatorLevelRows = useMemo<Array<{
    name: string;
    count: number;
    avgRead: number | null;
    avgInteraction: number | null;
    avgCpe: number | null;
    readSamples: number;
    interSamples: number;
  }>>(() => {
    if (data.notes && data.notes.length > 0) {
      const map = new Map<string, {
        name: string;
        count: number;
        totalRead: number;
        readSamples: number;
        totalInter: number;
        interSamples: number;
        totalCost: number;
        costSamples: number;
      }>();
      for (const n of data.notes) {
        const lvl = String(n.creatorLevel || '未分层');
        const cur = map.get(lvl) || {
          name: lvl,
          count: 0,
          totalRead: 0,
          readSamples: 0,
          totalInter: 0,
          interSamples: 0,
          totalCost: 0,
          costSamples: 0,
        };
        cur.count++;
        if (typeof n.readCount === 'number' && Number.isFinite(n.readCount)) {
          cur.totalRead += n.readCount;
          cur.readSamples++;
        }
        if (typeof n.interactionCount === 'number' && Number.isFinite(n.interactionCount)) {
          cur.totalInter += n.interactionCount;
          cur.interSamples++;
        }
        const price = Number(n.notePrice);
        if (Number.isFinite(price) && price > 0) {
          cur.totalCost += price;
          cur.costSamples++;
        }
        map.set(lvl, cur);
      }
      return [...map.values()].map(l => ({
        name: l.name,
        count: l.count,
        avgRead: l.readSamples > 0 ? Math.round(l.totalRead / l.readSamples) : null,
        avgInteraction: l.interSamples > 0 ? Math.round(l.totalInter / l.interSamples) : null,
        avgCpe: l.interSamples > 0 && l.totalInter > 0 && l.totalCost > 0 ? (l.totalCost / l.totalInter) : null,
        readSamples: l.readSamples,
        interSamples: l.interSamples,
      })).sort((a, b) => b.count - a.count);
    }
    return (data.analytics.creatorLevels || []).map(r => ({
      name: String(r.name || '未分层'),
      count: num(r.count),
      readSamples: num(r.avgRead) > 0 ? num(r.count) : 0,
      interSamples: num(r.avgInteraction) > 0 ? num(r.count) : 0,
      avgRead: num(r.avgRead) > 0 ? num(r.avgRead) : null,
      avgInteraction: num(r.avgInteraction) > 0 ? num(r.avgInteraction) : null,
      avgCpe: num(r.avgCpe) > 0 ? num(r.avgCpe) : null,
    }));
  }, [data.notes, data.analytics.creatorLevels]);

  // ===== 第二、三阶段看板数据 =====
  // 人群×阶段矩阵热力图
  const planning = data.feishu?.planning || [];
  const audiences = [...new Set(planning.map(p => p.audience).filter((a): a is string => !!a))].slice(0, 6);
  const stages = [...new Set(planning.map(p => p.stage).filter((s): s is string => !!s))].slice(0, 6);
  const heatmapData = audiences.map(a => stages.map(s => planning.filter(p => p.audience === a && p.stage === s).length));

  // 场景分布树状图
  const sceneMap = new Map<string, number>();
  for (const p of planning) {
    if (p.scene) sceneMap.set(p.scene, (sceneMap.get(p.scene) || 0) + 1);
  }
  const treeMapItems = [...sceneMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({ label, value, color: ['#1e6091', '#0d9488', '#7c3aed', '#f59e0b', '#dc2626', '#0891b2', '#65a30d', '#db2777'][i % 8] }));

  // 痛点词云（从 topics 数据）
  const topicSummary = aggregateTopics(data.analytics.topics || []);
  const wordCloudWords = topicSummary.words;

  // 月度产出趋势
  const monthMap = new Map<string, number>();
  for (const note of data.notes || []) {
    if (note.publishedAt) {
      const month = String(note.publishedAt).slice(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }
  }
  const monthlyOutput = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // 消费者反馈分类（评论情感分布）
  const hasSentiment = Boolean(m.sentimentAvailable && (m.positiveCount !== null || m.negativeCount !== null || m.questionCount !== null));
  const feedbackCategories = hasSentiment ? [
    { label: '正向赞誉', value: num(m.positiveCount), color: '#16a34a' },
    { label: '求助/购买问询', value: num(m.questionCount), color: '#3b82f6' },
    { label: '中性讨论', value: Math.max(0, num(m.commentTotal) - num(m.positiveCount) - num(m.negativeCount) - num(m.questionCount)), color: '#64748b' },
    { label: '负向敏感', value: num(m.negativeCount), color: '#dc2626' },
  ].filter(c => c.value > 0) : [];

  return (
    <div className="stack animate-fade-in">
      {/* 顶部指标卡 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="累计总曝光"
          value={compact(m.exposure)}
          unit="次"
          desc="已同步内容曝光总额"
          tag="曝光规模"
        />
        <MetricCard
          theme="teal"
          label="累计总阅读"
          value={compact(m.readCount)}
          unit="次"
          desc={num(m.cpr) ? 'CPR ¥' + num(m.cpr).toFixed(2) : '待同步投放费用'}
          tag="阅读成本"
        />
        <MetricCard
          theme="green"
          label="累计总互动"
          value={compact(m.interactionCount)}
          unit="次"
          desc={'全盘互动率 ' + pct(num(m.engagementRate))}
          tag="互动质量"
        />
        <MetricCard
          theme="purple"
          label="达人合作费用"
          value={num(m.creatorCost) ? '¥' + compact(m.creatorCost) : '待同步'}
          unit=""
          desc={'已覆盖 ' + num(q.metricCount) + '/' + total + ' 篇内容'}
          tag="达人采买"
        />
      </section>

      {/* 资产来源、数据缺口、形式贡献与达人效率大盘（双行严格对齐等高） */}
      <ContentAnalyticsBoard
        analytics={data.analytics}
        creatorLevels={creatorLevelRows}
        onSourceClick={handleSourceClick}
        onFormatClick={handleFormatClick}
      />

      {/* 第一组：内容选题战略对比（篇数供给 vs 互动吸收，双列 10 项严格等高） */}
      <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
        <DashboardSection
          eyebrow="CONTENT STRATEGY"
          title="一级内容方向分布"
          desc="按选题方向拆解发文篇数与内容供给规模。"
        >
          <DistributionBars
            onItemClick={r => handleCategoryClick(String(r.name))}
            rows={categoriesWithShare}
            valueKey="count"
            labelKey="name"
            valueUnit="篇"
            secondaryKey="shareText"
            limit={10}
            empty="导入 RedTrend 字段后生成"
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="ENGAGEMENT IMPACT"
          title="一级内容方向互动贡献"
          desc="按选题方向累计互动总量降序拆解，对比各切角互动吸收效能。"
        >
          <DistributionBars
            onItemClick={r => handleCategoryClick(String(r.name))}
            rows={categoryInteractions}
            valueKey="interactions"
            labelKey="name"
            valueUnit="互动"
            secondaryKey="reads"
            secondaryUnit="阅读"
            limit={10}
            empty="暂无选题互动统计"
          />
        </DashboardSection>
      </div>

      {/* 第二组：品牌声量成效与核心互动构成（双列 stretch 自然等高，边底对齐，消除 y=2500 空白） */}
      <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
        <DashboardSection
          eyebrow="BRAND EFFICIENCY"
          title="品牌声量与千次投放成效"
          desc="全库品牌内容曝光成本、千次转化与均篇效能拆解。"
        >
          <div className="distribution-bars" style={{ height: 'calc(100% - 90px)', minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {brandEfficiencyRows.map((item, idx) => (
              <div key={idx}>
                <span title={String(item.name)}>{String(item.name)}</span>
                <i>
                  <b style={{ width: `${100 - idx * 15}%` }} />
                </i>
                <div style={{ display: 'flex', gap: 2, flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                    {item.isCurrency ? '¥' + compact(item.count) : item.unit ? `${item.count}${item.unit}` : compact(item.count)}
                  </strong>
                  <em style={{ color: '#64748b', fontSize: '11px', fontStyle: 'normal' }}>
                    {String(item.desc)}
                  </em>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        <div className="stack" style={{ gap: 20 }}>
          <DashboardSection
            eyebrow="INTERACTION MIX"
            title="核心互动类型构成拆解"
            desc="全盘笔记点赞、收藏、分享与评论真实互动转化结构。"
          >
            <DistributionBars
              rows={interactionBreakdown}
              valueKey="count"
              labelKey="name"
              valueUnit="次"
              limit={4}
              empty="暂无互动细分数据"
            />
            <p className="metric-note" style={{ marginTop: 8 }}>全盘累计互动 {compact(m.interactionCount)} 次。源表未细分点赞/收藏/分享分项时标示 —，不误计为零。</p>
          </DashboardSection>

          <DashboardSection
            eyebrow="CONTENT STATUS"
            title="内容建档与监测状态"
            desc="项目全盘笔记的收录、达标、待补与抓取状态分布。"
          >
            <DistributionBars
              rows={data.analytics.statusDistribution}
              valueKey="count"
              labelKey="name"
              valueUnit="篇"
              limit={3}
              empty="暂无状态数据"
            />
          </DashboardSection>
        </div>
      </div>

      {/* 第三组：达人层级效率矩阵、地域渗透与需求管线交付（左列 10 行表格，右列 6 省市+3 管线自然等高） */}
      <div className="workspace-two-col" style={{ alignItems: 'start' }}>
        <DashboardSection
          eyebrow="CREATOR MATRIX"
          title="达人层级效率矩阵"
          desc="头部、腰部、初级达人与 KOC 采买效率与 CPE 表现。"
        >
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <table className="ops-table" style={{ whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th>达人层级</th>
                  <th>笔记数</th>
                  <th>均阅读</th>
                  <th>均互动</th>
                  <th>均 CPE 互动成本</th>
                </tr>
              </thead>
              <tbody>
                {creatorLevelRows.map((row, index) => (
                  <tr key={row.name + '-' + index} onClick={() => handleTierClick(String(row.name))} style={{ cursor: openCategoryNotes ? 'pointer' : 'default' }} title={openCategoryNotes ? ("点击查看「" + row.name + "」层级笔记") : undefined}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><strong style={{ color: openCategoryNotes ? '#0284c7' : 'inherit' }}>{String(row.name)}</strong>{openCategoryNotes && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', whiteSpace: 'nowrap' }}>查看 ↗</span>}</div></td>
                    <td>{num(row.count)}</td>
                    <td>
                      {row.avgRead !== null && row.avgRead !== undefined ? (
                        <span>
                          {compact(row.avgRead)}
                          {row.readSamples !== undefined && row.readSamples > 0 && row.readSamples < row.count && (
                            <small style={{ color: '#94a3b8', fontSize: '11px', marginLeft: 4 }}>({row.readSamples}篇)</small>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      {row.avgInteraction !== null && row.avgInteraction !== undefined ? (
                        <span>
                          {compact(row.avgInteraction)}
                          {row.interSamples !== undefined && row.interSamples > 0 && row.interSamples < row.count && (
                            <small style={{ color: '#94a3b8', fontSize: '11px', marginLeft: 4 }}>({row.interSamples}篇)</small>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: num(row.avgCpe) ? '#0f172a' : '#94a3b8' }}>
                        {num(row.avgCpe) ? '¥' + num(row.avgCpe).toFixed(2) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <div className="stack" style={{ gap: 20 }}>
          <DashboardSection
            eyebrow="GEOGRAPHY"
            title="内容达人地域分布"
            desc={`达人分布主要省市与地域渗透格局（已定位 ${mappedCount} 位达人${unmappedCount > 0 ? `，待回填归属地 ${unmappedCount.toLocaleString()} 篇` : ''}）。`}
          >
            <DistributionBars
              onItemClick={r => handleLocationClick(String(r.name))}
              rows={validLocations}
              valueKey="count"
              labelKey="name"
              valueUnit="位"
              limit={6}
              empty="待同步达人地域字段"
            />
          </DashboardSection>

          <DashboardSection
            eyebrow="PROCUREMENT PIPELINES"
            title="投放需求管线交付进度"
            desc="各投放业务管线笔记交付目标与预算消耗执行情况。"
          >
            {pipelines.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pipelines.map((p, idx) => {
                  const target = Math.max(1, num(p.targetCount));
                  const delivered = num(p.deliveredCount);
                  const progress = Math.min(100, (delivered / target) * 100);
                  const spent = num(p.spent);
                  const budget = num(p.budget);
                  return (
                    <div key={p.id || idx} onClick={() => handlePipelineClick(p.name)} style={{ padding: '6px 8px', borderRadius: 8, cursor: openCategoryNotes ? 'pointer' : 'default', transition: 'background 0.15s ease' }} title={openCategoryNotes ? ('点击查看「' + p.name + '」管线笔记') : undefined}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 5 }}>
                        <strong style={{ color: '#0f172a' }}>{p.name}</strong>
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>
                          {delivered.toLocaleString()}{' '}
                          <small style={{ color: '#64748b', fontWeight: 400 }}>
                            / {target.toLocaleString()} 篇 ({progress.toFixed(1)}%)
                          </small>
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                            borderRadius: 999,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                        <span>已消耗 ¥{spent.toLocaleString()}</span>
                        <span>总预算 ¥{budget.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">暂无投放管线数据</div>
            )}
          </DashboardSection>
        </div>
      </div>

      {/* 第四组：内容规划矩阵与场景分析 */}
      <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
        <DashboardSection
          eyebrow="AUDIENCE × STAGE"
          title="人群×阶段内容矩阵热力图"
          desc="内容规划中各人群在不同决策阶段的选题覆盖密度。"
        >
          {audiences.length > 0 && stages.length > 0 ? (
            <MatrixHeatmap rows={audiences} cols={stages} data={heatmapData} />
          ) : <EmptyState compact title="暂无规划数据" text="同步内容规划all in one表格后生成人群×阶段矩阵。" />}
        </DashboardSection>

        <DashboardSection
          eyebrow="SCENE TREEMAP"
          title="内容场景分布树状图"
          desc="一级场景的选题数量占比，面积越大代表该场景覆盖越密集。"
        >
          {treeMapItems.length > 0 ? (
            <TreeMapChart items={treeMapItems} onItemClick={handleTreeMapClick} />
          ) : <EmptyState compact title="暂无场景数据" text="同步内容规划场景库后生成场景分布树状图。" />}
        </DashboardSection>
      </div>

      {/* 第五组：达人×内容方向细分效果（独立通栏展示长表格，完整展现 5 维度指标） */}
      <DashboardSection
        eyebrow="CREATOR × SCENE"
        title="达人×内容方向：覆盖与效果"
        desc="对照发布数量、篇均互动和报价成本，筛选值得复盘的内容方向。"
      >
        <ScenePerformanceBoard notes={data.notes || []} onRowClick={handleSceneRowClick} />
      </DashboardSection>

      {/* 第六组：用户诉求与评论舆情闭环（双列 stretch 自然等高，边底齐平，消除 y=3500 空白） */}
      <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
        <DashboardSection
          eyebrow="USER INTENTS"
          title="高频讨论话题与核心诉求"
          desc="笔记与评论高频提及的核心诉求分类与讨论热度集中度。"
        >
          {data.analytics.topics && data.analytics.topics.length > 0 ? (
            <DistributionBars
              rows={data.analytics.topics}
              valueKey="count"
              labelKey="name"
              valueUnit="提及"
              limit={8}
              empty="暂无话题数据"
            />
          ) : (
            <EmptyState compact title="暂无高频话题数据" text="同步笔记与评论话题标签后生成诉求热度排行。" />
          )}

          {wordCloudWords.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>评论高频痛点词云</div>
              <WordCloudChart words={wordCloudWords} />
              <p className="metric-note">其他及未分类评论 {topicSummary.unclassified.toLocaleString()} 条，单独列示，不作为具体话题。</p>
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="SENTIMENT & ACTIONS"
          title="评论预警处置与闭环进度"
          desc="重点求助问询、客诉负向预警与违规内容处置跟踪。"
        >
          <DistributionBars
            rows={sentimentActionRows}
            valueKey="count"
            labelKey="name"
            valueUnit="条"
            limit={5}
            empty="暂无处置工单数据"
          />

          {feedbackCategories.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>消费者反馈分类构成</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {feedbackCategories.map((c, i) => {
                  const catTotal = feedbackCategories.reduce((s, x) => s + x.value, 0);
                  const sharePct = catTotal > 0 ? (c.value / catTotal * 100) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{c.label}</span>
                        <span style={{ color: '#64748b' }}>{c.value.toLocaleString()} 条 · {sharePct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${sharePct}%`, height: '100%', background: c.color, borderRadius: 999, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DashboardSection>
      </div>

      {/* 第七组：月度内容产出趋势 */}
      <DashboardSection
        eyebrow="MONTHLY OUTPUT"
        title="月度内容产出趋势"
        desc="当前项目全量笔记按发布日期分月统计；未填写日期的笔记不参与月度趋势。"
      >
        {monthlyOutput.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200, padding: '10px 0' }}>
            {monthlyOutput.map(([month, count]) => {
              const max = Math.max(...monthlyOutput.map(([, c]) => c), 1);
              const h = (count / max) * 160;
              return (
                <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{count}</span>
                  <div style={{ width: '100%', maxWidth: 40, height: h, background: 'linear-gradient(180deg, #3b82f6, #1e40af)', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  <span style={{ fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap' }}>{month}</span>
                </div>
              );
            })}
          </div>
        ) : <EmptyState compact title="暂无产出数据" text="同步笔记发布日期后生成月度产出趋势。" />}
      </DashboardSection>

      {/* 第八组：卡审话术风险看板（条件呈现） */}
      {(() => {
        const riskRows = (data.feishu?.contentRisk || []) as Array<{ riskType: string; reason: string; originalScript: string; replacementScript: string; tips: string }>;
        if (!riskRows.length) return null;
        const typeCounts = riskRows.reduce((acc, r) => { acc[r.riskType] = (acc[r.riskType] || 0) + 1; return acc; }, {} as Record<string, number>);
        const colors = ['#dc2626', '#d97706', '#7c3aed', '#2563eb', '#0891b2', '#16a34a'];
        return (
          <DashboardSection
            eyebrow="CONTENT RISK"
            title="卡审话术风险分类与替换指南"
            desc="基于飞书卡审话术总结，分类展示高频卡审类型、原因与合规替换话术。"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {Object.entries(typeCounts).map(([type, count], i) => (
                <div key={type} style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${colors[i % colors.length]}15, ${colors[i % colors.length]}08)`, borderRadius: 10, border: `1px solid ${colors[i % colors.length]}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors[i % colors.length] }}>{type}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: colors[i % colors.length] }}>{count}</span>
                  </div>
                  {riskRows.filter(r => r.riskType === type).slice(0, 2).map((r, j) => (
                    <div key={j} style={{ marginBottom: 8, fontSize: 11.5 }}>
                      <div style={{ color: '#64748b', marginBottom: 2 }}><strong style={{ color: '#dc2626' }}>风险：</strong>{r.reason?.substring(0, 50)}{r.reason?.length > 50 ? '...' : ''}</div>
                      <div style={{ color: '#16a34a' }}><strong>替换：</strong>{r.replacementScript?.substring(0, 50)}{r.replacementScript?.length > 50 ? '...' : ''}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </DashboardSection>
        );
      })()}

      {/* 第九组：高热内容表现排行 */}
      <DashboardSection
        eyebrow="CONTENT RANKING"
        title="高热内容表现排行"
        desc="按互动与评论总量排序，阅读量辅助评估；点击查看笔记明细。"
      >
        <TopNotes rows={data.analytics.topNotes} openNote={openNote} />
      </DashboardSection>
    </div>
  );
}
