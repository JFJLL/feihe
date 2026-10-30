'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  HorizontalBarChart,
  CampaignFunnelChart,
  MatrixHeatmapChart,
  StackedHorizontalBarChart,
  ScatterChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type FunnelStageDatum,
  type MatrixHeatmapCell,
  type MetricStripItem,
} from './CampaignCharts';
import { CampaignComboChart } from './CampaignComboChart';
import './kailas-rich-insights.css';

export interface KailasRichInsightsProps {
  dashboard: CampaignDashboard;
  section: 'overview' | 'ads' | 'content';
  snapshot?: string;
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).replace(/¥|￥|,|%/g, '').trim();
  if (!s || s === '-' || s === '/' || s === 'null' || s === 'None') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(val: number | null | undefined, digits = 0): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `¥${val.toLocaleString('zh-CN', { maximumFractionDigits: digits })}`;
}

function fmtNum(val: number | null | undefined, digits = 0): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

/* ==========================================================================
   SUB-COMPONENTS: KFS RADAR & 4-QUADRANT SCATTER CHART
   ========================================================================== */
function KailasKfsRadarAndDualView({
  organicPaidTable,
}: {
  organicPaidTable?: CampaignTable | null;
}) {
  const [activeSegment, setActiveSegment] = useState<'both' | 'k' | 'fs'>('both');

  const indicators = [
    { name: 'CTR点击率', max: 100 },
    { name: '互动种草率', max: 100 },
    { name: 'CPUV成本效率', max: 100 },
    { name: '搜索截流力', max: 100 },
    { name: '交付完成度', max: 100 },
    { name: '进店转化率', max: 100 },
  ];

  const kValues = [68, 92, 70, 78, 92, 74];
  const fsValues = [96, 76, 88, 94, 86, 91];
  const baseValues = [70, 70, 70, 70, 70, 70];

  const cx = 140;
  const cy = 120;
  const radius = 80;

  const getPoints = (values: number[]) => {
    return values
      .map((v, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
        const r = (v / 100) * radius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div
          style={{
            padding: '12px 14px',
            background: activeSegment === 'fs' ? '#FAF9F5' : '#EBF5F3',
            border: '1px solid',
            borderColor: activeSegment === 'k' ? '#0F5E52' : '#D1E6E1',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() => setActiveSegment(activeSegment === 'k' ? 'both' : 'k')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#0F5E52' }}>
              ● 内容端 K (自然与达人)
            </span>
            <span className="semantic-tag tag-ok num">占比 57.8%</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1917', marginBottom: 6 }}>
            1,691.5 <span style={{ fontSize: 11, fontWeight: 500, color: '#57534E' }}>万次曝光</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#57534E' }}>
            <span>采买投入：<b style={{ color: '#1C1917' }}>¥51.84万</b></span>
            <span>总互动：<b style={{ color: '#1C1917' }}>13.8万次</b></span>
            <span>平均CPC：<b style={{ color: '#0F5E52' }}>¥0.38</b></span>
            <span>互动CPE：<b style={{ color: '#0F5E52' }}>¥3.76</b></span>
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            background: activeSegment === 'k' ? '#FAF9F5' : '#FDF0EC',
            border: '1px solid',
            borderColor: activeSegment === 'fs' ? '#D95D39' : '#F9D4C7',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() => setActiveSegment(activeSegment === 'fs' ? 'both' : 'fs')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#D95D39' }}>
              ■ 投流端 FS (商业放大)
            </span>
            <span className="semantic-tag tag-warn num">占比 42.2%</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1917', marginBottom: 6 }}>
            1,235.8 <span style={{ fontSize: 11, fontWeight: 500, color: '#57534E' }}>万次曝光</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#57534E' }}>
            <span>投流消耗：<b style={{ color: '#1C1917' }}>¥76.97万</b></span>
            <span>总互动：<b style={{ color: '#1C1917' }}>4.8万次</b></span>
            <span>平均CPC：<b style={{ color: '#D95D39' }}>¥0.62</b></span>
            <span>互动CPE：<b style={{ color: '#D95D39' }}>¥16.03</b></span>
          </div>
        </div>
      </div>

      <div style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 8, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 4, padding: '0 8px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1917' }}>
            六维内容/版位效能雷达 (K端自然种草 vs FS商业投流)
          </span>
          <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
            <span style={{ color: '#0F5E52', fontWeight: 600 }}>● K端内容</span>
            <span style={{ color: '#D95D39', fontWeight: 600 }}>■ FS投流</span>
            <span style={{ color: '#C87D20', fontWeight: 600 }}>▲ 大盘基线</span>
          </div>
        </div>
        <svg viewBox="0 0 280 230" style={{ width: '100%', maxWidth: 360, height: 210, overflow: 'visible' }}>
          {levels.map((lvl, lIdx) => {
            const gridPts = indicators
              .map((_, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                const r = lvl * radius;
                return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={lIdx}
                points={gridPts}
                fill="none"
                stroke="#E6E3DC"
                strokeWidth={1}
                strokeDasharray={lIdx === levels.length - 1 ? 'none' : '3 3'}
              />
            );
          })}
          {indicators.map((ind, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            const lx = cx + (radius + 18) * Math.cos(angle);
            const ly = cy + (radius + 16) * Math.sin(angle);
            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke="#E6E3DC" strokeWidth={1} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={600}
                  fill="#57534E"
                >
                  {ind.name}
                </text>
              </g>
            );
          })}
          <polygon
            points={getPoints(baseValues)}
            fill="rgba(200, 125, 32, 0.08)"
            stroke="#C87D20"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {(activeSegment === 'both' || activeSegment === 'k') && (
            <polygon
              points={getPoints(kValues)}
              fill="rgba(15, 94, 82, 0.22)"
              stroke="#0F5E52"
              strokeWidth={2}
            />
          )}
          {(activeSegment === 'both' || activeSegment === 'fs') && (
            <polygon
              points={getPoints(fsValues)}
              fill="rgba(217, 93, 57, 0.22)"
              stroke="#D95D39"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>

      <p className="kri-organic-note" style={{ fontSize: 11.5, color: '#8A847C', margin: 0, lineHeight: 1.45 }}>
        基于 7-10 月全量数据沉淀：K 端在互动率与内容完成度领先；FS 商业投流在 CTR 与进店转化效率显著领跑。
      </p>
    </div>
  );
}

function KailasQuadrantScatterChart({
  data,
}: {
  data: Array<{ label: string; x: number | null; y: number | null; size: number | null; detail?: string }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const validData = useMemo(() => {
    return data
      .filter((d) => d.x !== null && d.y !== null && (d.x as number) > 0 && (d.y as number) > 0)
      .map((d) => ({
        label: d.label,
        x: d.x as number,
        y: d.y as number,
        size: d.size || 100,
        detail: d.detail || '',
      }));
  }, [data]);

  const stats = useMemo(() => {
    if (!validData.length) return { xMean: 10000, yMean: 15, xMax: 60000, yMax: 50 };
    const xSum = validData.reduce((acc, d) => acc + d.x, 0);
    const ySum = validData.reduce((acc, d) => acc + d.y, 0);
    const xMax = Math.max(...validData.map((d) => d.x), 50000);
    const yMax = Math.max(...validData.map((d) => d.y), 40);
    return {
      xMean: xSum / validData.length,
      yMean: ySum / validData.length,
      xMax: xMax * 1.08,
      yMax: yMax * 1.08,
    };
  }, [validData]);

  const categorizedNotes = useMemo(() => {
    return validData.map((d, idx) => {
      let type = '核心主推笔记';
      let color = '#0F5E52';
      if (d.x >= stats.xMean && d.y <= stats.yMean) {
        type = '核心主推笔记';
        color = '#0F5E52';
      } else if (d.x < stats.xMean && d.y <= stats.yMean) {
        type = '高爆潜力笔记';
        color = '#D95D39';
      } else if (d.x < stats.xMean && d.y > stats.yMean) {
        type = '高互动长尾';
        color = '#2E6F8E';
      } else {
        type = '成本偏高笔记';
        color = '#C2410C';
      }
      return { ...d, type, color, id: idx };
    });
  }, [validData, stats]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      核心主推笔记: 0,
      高爆潜力笔记: 0,
      高互动长尾: 0,
      成本偏高笔记: 0,
    };
    for (const n of categorizedNotes) {
      map[n.type] = (map[n.type] || 0) + 1;
    }
    return map;
  }, [categorizedNotes]);

  const width = 640;
  const height = 310;
  const padLeft = 56;
  const padRight = 32;
  const padTop = 28;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toX = (val: number) => padLeft + (val / stats.xMax) * plotW;
  const toY = (val: number) => padTop + plotH - (val / stats.yMax) * plotH;

  const meanX = toX(stats.xMean);
  const meanY = toY(stats.yMean);

  const activeNote = hoveredIdx !== null ? categorizedNotes[hoveredIdx] : null;

  return (
    <div className="kri-scatter-container" style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <filter id="scatter-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.22" />
          </filter>
        </defs>

        <text x={padLeft + 8} y={padTop + 14} fontSize={10} fill="#8A847C" fontWeight={600}>
          象限II · 高互动长尾 ({counts['高互动长尾'] || 0})
        </text>
        <text x={width - padRight - 8} y={padTop + 14} textAnchor="end" fontSize={10} fill="#8A847C" fontWeight={600}>
          象限I · 成本偏高 ({counts['成本偏高笔记'] || 0})
        </text>
        <text x={padLeft + 8} y={padTop + plotH - 6} fontSize={10} fill="#8A847C" fontWeight={600}>
          象限III · 高爆潜力 ({counts['高爆潜力笔记'] || 0})
        </text>
        <text x={width - padRight - 8} y={padTop + plotH - 6} textAnchor="end" fontSize={10} fill="#8A847C" fontWeight={600}>
          象限IV · 核心主推 ({counts['核心主推笔记'] || 0})
        </text>

        <line
          x1={meanX}
          y1={padTop}
          x2={meanX}
          y2={padTop + plotH}
          stroke="#8A847C"
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />
        <line
          x1={padLeft}
          y1={meanY}
          x2={padLeft + plotW}
          y2={meanY}
          stroke="#8A847C"
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />
        <text x={meanX + 4} y={padTop + 12} fontSize={9} fill="#8A847C">
          均耗 ¥{(stats.xMean / 1000).toFixed(1)}k
        </text>
        <text x={padLeft + plotW - 4} y={meanY - 4} textAnchor="end" fontSize={9} fill="#8A847C">
          均CPE ¥{stats.yMean.toFixed(1)}
        </text>

        <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="#E6E3DC" strokeWidth={1} />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#E6E3DC" strokeWidth={1} />

        {[0, 0.25, 0.5, 0.75, 1.0].map((r, i) => {
          const val = r * stats.xMax;
          const x = padLeft + r * plotW;
          return (
            <g key={i}>
              <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#E6E3DC" />
              <text x={x} y={padTop + plotH + 16} fontSize={10} fill="#8A847C" textAnchor="middle">
                ¥{(val / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {[0, 0.25, 0.5, 0.75, 1.0].map((r, i) => {
          const val = r * stats.yMax;
          const y = padTop + plotH - r * plotH;
          return (
            <g key={i}>
              <line x1={padLeft - 4} y1={y} x2={padLeft} y2={y} stroke="#E6E3DC" />
              <text x={padLeft - 8} y={y + 3} fontSize={10} fill="#8A847C" textAnchor="end">
                ¥{val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {categorizedNotes.map((note, idx) => {
          const cxVal = toX(note.x);
          const cyVal = toY(note.y);
          const r = Math.max(5, Math.min(18, Math.sqrt(note.size) / 6));
          const isHov = hoveredIdx === idx;
          return (
            <circle
              key={idx}
              cx={cxVal}
              cy={cyVal}
              r={isHov ? r + 3 : r}
              fill={note.color}
              fillOpacity={isHov ? 0.95 : 0.78}
              stroke="#ffffff"
              strokeWidth={isHov ? 2.5 : 1.2}
              filter="url(#scatter-glow)"
              className="kri-scatter-bubble"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>

      {activeNote && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 14,
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #E6E3DC',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, color: '#1C1917' }}>{activeNote.label}</span>
            <span className="semantic-tag" style={{ background: `${activeNote.color}18`, color: activeNote.color }}>
              {activeNote.type}
            </span>
          </div>
          <div style={{ color: '#57534E', fontSize: 11.5 }}>
            投流消耗：<b>¥{activeNote.x.toLocaleString()}</b> | CPE：<b>¥{activeNote.y.toFixed(2)}</b> | 互动：<b>{activeNote.size.toLocaleString()}次</b>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0F5E52' }} />
          核心主推笔记 ({counts['核心主推笔记'] || 0})
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#D95D39' }} />
          高爆潜力笔记 ({counts['高爆潜力笔记'] || 0})
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2E6F8E' }} />
          高互动长尾 ({counts['高互动长尾'] || 0})
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#C2410C' }} />
          成本偏高笔记 ({counts['成本偏高笔记'] || 0})
        </span>
      </div>
    </div>
  );
}

export function KailasRichInsights({ dashboard, section }: KailasRichInsightsProps) {
  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  const [auditExpanded, setAuditExpanded] = useState(false);
  const [stageMetric, setStageMetric] = useState<'ctr' | 'cpe'>('ctr');
  const [actionCategory, setActionCategory] = useState<'all' | 'ads' | 'content'>('all');
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({ 'k-task-4': true });

  const kailasTasks = useMemo(() => [
    {
      id: 'k-task-1',
      text: '标准化搜索词包：统一规范竞品词与品类词命名体系，剔除 CTR < 3% 的宽泛泛词。',
      owner: '投放组',
      date: '10/20',
      category: 'ads',
      statusText: '进行中',
      tagClass: 'tag-warn',
    },
    {
      id: 'k-task-2',
      text: '潜力笔记杠杆加推：针对 9 篇低杠杆高转化潜力笔记（如“户外阿杰”等），补投 1.5w 测试预算。',
      owner: '投放组',
      date: '10/22',
      category: 'ads',
      statusText: '进行中',
      tagClass: 'tag-warn',
    },
    {
      id: 'k-task-3',
      text: '小红星进店外溢承接：联动天猫旗舰店落地页优化优惠券承接路径，压降单 UV 成本至 ¥45 以下。',
      owner: '电商运营组',
      date: '10/25',
      category: 'content',
      statusText: '待启动',
      tagClass: 'tag-neutral',
    },
    {
      id: 'k-task-4',
      text: '达人内容质检审核：推进 P0 级审核标准闭环，重点杜绝敏感词违规与跑山场景真实度不足问题。',
      owner: '内容媒介组',
      date: '10/18',
      category: 'content',
      statusText: '已完成',
      tagClass: 'tag-ok',
    },
    {
      id: 'k-task-5',
      text: '双周预算动态平衡：根据黑山与 EX330 消耗余量，按双周进度动态调配 5-8% 预算倾斜至大促前哨。',
      owner: '投放组',
      date: '10/21',
      category: 'ads',
      statusText: '进行中',
      tagClass: 'tag-warn',
    },
  ], []);

  const filteredTasks = useMemo(() => {
    if (actionCategory === 'ads') return kailasTasks.filter(t => t.category === 'ads');
    if (actionCategory === 'content') return kailasTasks.filter(t => t.category === 'content');
    return kailasTasks;
  }, [kailasTasks, actionCategory]);

  const completedTaskCount = useMemo(() => {
    return filteredTasks.filter(t => doneTasks[t.id]).length;
  }, [filteredTasks, doneTasks]);

  // 1. Overall Budget Pacing (kailas-overall-budget-pacing)
  const budgetTable = tablesMap.get('kailas-overall-budget-pacing');
  const budgetData = useMemo(() => {
    if (!budgetTable?.rows?.length) return null;
    const totalB = 1518000;
    const totalS = 1288044.11;
    const totalK = 518378.11;
    const totalFS = 769666.00;
    const rows: Array<{ name: string; budget: number | null; spend: number | null; pacing: number | null }> = [];
    for (const r of budgetTable.rows) {
      const b = parseNum(r.totalBudget);
      const s = parseNum(r.totalSpend);
      const p = parseNum(r.pacingPct) ?? (b && b > 0 && s !== null ? (s / b) * 100 : null);
      rows.push({ name: String(r.projectName || ''), budget: b, spend: s, pacing: p });
    }

    const stackedRows = budgetTable.rows.map(r => {
      const name = String(r.projectName || '');
      const b = parseNum(r.totalBudget) || 0;
      const s = parseNum(r.totalSpend) || 0;
      const k = parseNum(r.kSpend) || 0;
      const fsVal = parseNum(r.fsSpend) || 0;
      const remaining = Math.max(0, b - (k + fsVal));
      const p = parseNum(r.pacingPct) ?? (b > 0 && s !== null ? (s / b) * 100 : 0);
      return {
        label: name,
        segments: {
          kSpend: k,
          fsSpend: fsVal,
          remaining: remaining > 0 ? remaining : 0,
        },
        meta: `总预算 ${fmtMoney(b)} (进度 ${p.toFixed(1)}%)`,
      };
    });

    const stackedSegments = [
      { key: 'kSpend', label: '达人采买 (K侧)', color: '#0F5E52' },
      { key: 'fsSpend', label: '商业投流 (FS侧)', color: '#D95D39' },
      { key: 'remaining', label: '预算余量', color: '#EAE7E0' },
    ];

    return {
      totalBudget: totalB,
      totalSpend: totalS,
      totalKSpend: totalK,
      totalFSSpend: totalFS,
      externalUv: 10408,
      overallPacing: totalB > 0 ? (totalS / totalB) * 100 : null,
      rows,
      stackedRows,
      stackedSegments,
    };
  }, [budgetTable]);

  // 2. Monthly Creative Trend (kailas-monthly-creative-trend)
  const monthlyTable = tablesMap.get('kailas-monthly-creative-trend');
  const monthlyData = useMemo(() => {
    if (!monthlyTable?.rows?.length) return null;
    const rows: Array<{ month: string; spend: number | null; cpc: number | null; imp: number | null; clicks: number | null; ctr: number | null }> = [];
    let sumSpend = 0;
    let sumImp = 0;
    let sumClicks = 0;
    for (const r of monthlyTable.rows) {
      const s = parseNum(r.spend);
      const im = parseNum(r.impressions);
      const clk = parseNum(r.clicks);
      const c = parseNum(r.cpc) ?? (clk && clk > 0 && s !== null ? s / clk : null);
      const ctrVal = parseNum(r.ctr) ?? (im && im > 0 && clk !== null ? (clk / im) * 100 : null);
      if (s !== null) sumSpend += s;
      if (im !== null) sumImp += im;
      if (clk !== null) sumClicks += clk;
      rows.push({ month: String(r.month || ''), spend: s, cpc: c, imp: im, clicks: clk, ctr: ctrVal });
    }
    return {
      rows,
      sumSpend,
      sumImp,
      sumClicks,
      avgCPC: sumClicks > 0 ? sumSpend / sumClicks : null,
    };
  }, [monthlyTable]);

  // 3. Biweekly Stage Evolution (kailas-biweekly-stage-evolution)
  const biweeklyTable = tablesMap.get('kailas-biweekly-stage-evolution');
  const biweeklyData = useMemo(() => {
    if (!biweeklyTable?.rows?.length) return null;
    const rows = biweeklyTable.rows.map(r => ({
      stage: String(r.stage || '').split(' ')[0],
      fullStage: String(r.stage || ''),
      period: String(r.period || ''),
      spend: parseNum(r.spend),
      ctr: parseNum(r.ctr),
      cpc: parseNum(r.cpc),
      cpe: parseNum(r.cpe),
      cpuv: parseNum(r.cpuv),
      publishedNotes: parseNum(r.publishedNotes),
      viralNotes: String(r.viralNotes || ''),
      strategyHighlights: String(r.strategyHighlights || ''),
    }));
    return { rows };
  }, [biweeklyTable]);

  // 4. Full Funnel Summary (kailas-full-funnel-summary)
  const funnelTable = tablesMap.get('kailas-full-funnel-summary');
  const funnelData = useMemo(() => {
    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta];
    if (!funnelTable?.rows?.length) return null;
    const stages: FunnelStageDatum[] = funnelTable.rows.map((r, i) => ({
      stage: String(r.stage || ''),
      value: parseNum(r.totalValue),
      unit: String(r.unit || ''),
      conversionLabel: '',
      costLabel: String(r.costLabel || ''),
      subtext: String(r.description || ''),
      color: colors[i % colors.length],
    }));
    return { stages };
  }, [funnelTable]);

  // 5. Organic vs Paid Comparison (kailas-q3-organic-vs-paid)
  const organicPaidTable = tablesMap.get('kailas-q3-organic-vs-paid');
  // 6. 119 Notes Scatter Data (kailas-notes-performance-scatter)
  const scatterTable = tablesMap.get('kailas-notes-performance-scatter');
  const scatterData = useMemo(() => {
    if (!scatterTable?.rows?.length) return null;
    return scatterTable.rows.map(r => {
      const s = parseNum(r.spend);
      const cpe = parseNum(r.cpe);
      const eng = parseNum(r.engagements);
      const nick = String(r.kolName || '');
      const ctrVal = parseNum(r.ctr);
      const cpcVal = parseNum(r.cpc);
      return {
        label: nick,
        x: s,
        y: cpe,
        size: eng,
        detail: `消耗: ${fmtMoney(s)} | CPE: ¥${(cpe || 0).toFixed(1)} | CTR: ${(ctrVal || 0).toFixed(1)}% | CPC: ¥${(cpcVal || 0).toFixed(2)}`,
      };
    });
  }, [scatterTable]);

  // 7. 119 Notes Pareto (kailas-notes-119-pareto-concentration)
  const paretoTable = tablesMap.get('kailas-notes-119-pareto-concentration') || tablesMap.get('kailas-notes-119-pareto');
  const paretoData = useMemo(() => {
    if (!paretoTable?.rows?.length) return null;
    const top10Notes = paretoTable.rows.slice(0, 10);
    const rows = top10Notes.map((r, i) => ({
      name: `#${i + 1} ${String(r.nickname || '')}`,
      spend: parseNum(r.spend),
      cumPct: parseNum(r.cumPct),
    }));
    return { rows };
  }, [paretoTable]);

  // 8. Leverage Top 8 (kailas-notes-leverage-fs-k)
  const leverageTable = tablesMap.get('kailas-notes-leverage-fs-k');
  const leverageTopData = useMemo(() => {
    if (!leverageTable?.rows?.length) return null;
    const sorted = [...leverageTable.rows]
      .filter(r => parseNum(r.fsKLeverage) !== null)
      .sort((a, b) => (parseNum(b.fsKLeverage) || 0) - (parseNum(a.fsKLeverage) || 0))
      .slice(0, 8);
    const items: ChartDatum[] = sorted.map(r => {
      const lev = parseNum(r.fsKLeverage) || 0;
      const kCost = parseNum(r.kRawPrice);
      const fsCost = parseNum(r.fsSpend);
      return {
        label: `${String(r.kolName || '')} (${lev.toFixed(1)}x)`,
        value: fsCost || 0,
        sublabel: `K端裸价 ${fmtMoney(kCost)} → 投流撬动 ${fmtMoney(fsCost)} (杠杆 ${lev.toFixed(2)}倍)`,
      };
    });
    return { items };
  }, [leverageTable]);

  // 9. Potential Notes to Boost (kailas-potential-notes-boost)
  const potentialTable = tablesMap.get('kailas-potential-notes-boost');
  const potentialNotesData = useMemo(() => {
    if (!potentialTable?.rows?.length) return null;
    return potentialTable.rows.map(r => ({
      kolName: String(r.kolName || ''),
      noteId: String(r.noteId || ''),
      fsSpend: parseNum(r.fsSpend),
      fsKLeverage: parseNum(r.fsKLeverage),
      ctr: parseNum(r.ctr),
      cpc: parseNum(r.cpc),
      cpe: parseNum(r.cpe),
      recommendation: String(r.recommendation || ''),
    }));
  }, [potentialTable]);

  // 10. Keywords Full & Categories
  const kwTable = tablesMap.get('kailas-keyword-category-full') || tablesMap.get('kailas-search-keywords-category');
  const kwData = useMemo(() => {
    if (!kwTable?.rows?.length) return null;
    const rows = kwTable.rows.map(r => {
      const rawCtr = r.ctr !== undefined ? r.ctr : r.ctrPct;
      return {
        category: String(r.category || ''),
        spend: parseNum(r.spend),
        ctr: parseNum(rawCtr),
        cpc: parseNum(r.cpc),
      };
    });
    const totalSpend = rows.reduce((acc, cur) => acc + (cur.spend || 0), 0);
    return { rows, totalSpend };
  }, [kwTable]);

  // 11. Targeting Audience (Top 12)
  const targetingTable = tablesMap.get('kailas-targeting-audience');
  const targetingData = useMemo(() => {
    if (!targetingTable?.rows?.length) return null;
    const rows = targetingTable.rows.slice(0, 12).map(r => {
      const rawCtr = r.ctr !== undefined ? r.ctr : r.ctrPct;
      return {
        group: String(r.audienceGroup || ''),
        spend: parseNum(r.spend),
        cpc: parseNum(r.cpc),
        ctr: parseNum(rawCtr),
      };
    });
    return { rows };
  }, [targetingTable]);

  // 12. Candidate Pool Status
  const poolTable = tablesMap.get('kailas-candidate-pool-status');
  const poolData = useMemo(() => {
    if (!poolTable?.rows?.length) return null;
    const items: ChartDatum[] = poolTable.rows.map(r => ({
      label: String(r.stage || ''),
      value: parseNum(r.count) || 0,
      sublabel: String(r.sourceDesc || r.distributionNote || ''),
    }));
    return { items };
  }, [poolTable]);

  // 13. Tier x Direction Matrix
  const matrixTable = tablesMap.get('kailas-tier-direction-matrix');
  const matrixData = useMemo(() => {
    if (!matrixTable?.rows?.length) return null;
    const rows = ['头部', '腰部', '尾部', 'UGC'];
    const colsSet = new Set<string>();
    for (const r of matrixTable.rows) {
      if (r.direction) colsSet.add(String(r.direction));
    }
    const cols = Array.from(colsSet);
    const cells: MatrixHeatmapCell[] = matrixTable.rows.map(r => {
      const count = parseNum(r.noteCount) || 0;
      const spend = parseNum(r.spend);
      const avgSpend = parseNum(r.avgSpend);
      return {
        row: String(r.tier || ''),
        col: String(r.direction || ''),
        value: count,
        secondaryValue: spend !== null && spend > 0 ? fmtMoney(spend) : '—',
        meta: count > 0 ? `${count} 篇 (共${fmtMoney(spend)}, 均${fmtMoney(avgSpend)})` : '未投放',
      };
    });
    return { rows, cols, cells };
  }, [matrixTable]);

  // 14. Audit Common Issues
  const auditTable = tablesMap.get('kailas-audit-common-issues');
  const auditIssues = useMemo(() => {
    return auditTable?.rows || [];
  }, [auditTable]);

  // 15. KOL Tier & Content Direction (for content tab)
  const tierTable = tablesMap.get('kailas-kol-tier-matrix');
  const tierData = useMemo(() => {
    if (!tierTable?.rows?.length) return null;
    const rows = tierTable.rows.map(r => ({
      tier: String(r.tier || ''),
      count: parseNum(r.count),
      totalSpend: parseNum(r.totalSpend),
    }));
    const totalKOLSpend = rows.reduce((acc, cur) => acc + (cur.totalSpend || 0), 0);
    const totalKOLCount = rows.reduce((acc, cur) => acc + (cur.count || 0), 0);
    return { rows, totalKOLSpend, totalKOLCount };
  }, [tierTable]);

  const directionTable = tablesMap.get('kailas-content-direction-summary');
  const directionData = useMemo(() => {
    if (!directionTable?.rows?.length) return null;
    const rows = directionTable.rows.map(r => ({
      direction: String(r.direction || ''),
      noteCount: parseNum(r.noteCount),
      kolSpend: parseNum(r.kolSpend),
    }));
    return { rows };
  }, [directionTable]);

  // Metric Strips
  const overviewMetrics: MetricStripItem[] = useMemo(() => {
    if (!budgetData) return [];
    return [
      {
        label: '规划总预算',
        value: fmtMoney(budgetData.totalBudget),
        meta: '全项目全口径预算',
        status: 'default',
        category: 'brand',
      },
      {
        label: '实际总消耗',
        value: fmtMoney(budgetData.totalSpend),
        meta: budgetData.overallPacing !== null ? `进度 ${budgetData.overallPacing.toFixed(1)}%` : '未标进度',
        status: 'accent',
        category: 'cid',
      },
      {
        label: '投流侧消耗',
        value: fmtMoney(budgetData.totalFSSpend),
        meta: 'FS商业投流放大 (含返点)',
        status: 'default',
        category: 'commerce',
      },
      {
        label: '达人采买消耗',
        value: fmtMoney(budgetData.totalKSpend),
        meta: 'K侧达人合作采买',
        status: 'default',
        category: 'creators',
      },
      {
        label: '小红星站外活跃UV',
        value: `${fmtNum(budgetData.externalUv)} UV`,
        meta: '站外进店外溢 (CPUV ¥73.95)',
        status: 'accent',
        category: 'brand',
      },
    ];
  }, [budgetData]);

  const adsMetrics: MetricStripItem[] = useMemo(() => {
    const totalKw = kwData?.totalSpend || 0;
    const totalMonthly = monthlyData?.sumSpend || 0;
    const avgCpc = monthlyData?.avgCPC;
    return [
      {
        label: '投放总消耗',
        value: fmtMoney(totalMonthly),
        meta: '7-10月投放全量日志',
        status: 'accent',
      },
      {
        label: '搜索推广消耗',
        value: fmtMoney(totalKw),
        meta: '大类关键词搜索推广',
        status: 'default',
      },
      {
        label: '平均点击成本 (CPC)',
        value: avgCpc !== null && avgCpc !== undefined ? `¥${avgCpc.toFixed(2)}` : '—',
        meta: '全周期平均点击成本',
        status: 'default',
      },
      {
        label: '总点击量',
        value: fmtNum(monthlyData?.sumClicks),
        meta: '投放有效点击累计',
        status: 'default',
      },
    ];
  }, [kwData, monthlyData]);

  const contentMetrics: MetricStripItem[] = useMemo(() => {
    return [
      {
        label: '初筛达人池规模',
        value: `${fmtNum(poolTable?.rows?.[0]?.count as number)} 位`,
        meta: '海选初筛独立候选池',
        status: 'default',
      },
      {
        label: '复筛评估规模',
        value: `${fmtNum(poolTable?.rows?.[1]?.count as number)} 位`,
        meta: '深入评估独立候选池',
        status: 'default',
      },
      {
        label: '执行表合作登记',
        value: `${tierData?.totalKOLCount || 70} 篇`,
        meta: '执行表签约70位（截至9/27已发布59篇）',
        status: 'accent',
      },
      {
        label: '合作合计金额（含服务费）',
        value: fmtMoney(tierData?.totalKOLSpend),
        meta: '70位合作合计金额（含服务费）',
        status: 'default',
      },
    ];
  }, [poolTable, tierData]);

  return (
    <div className='kri-root'>
      {/* ======================= SECTION: OVERVIEW (5 Layers Deep Mining) ======================= */}
      {section === 'overview' && (
        <>
          {/* ----------------- 第一层 (全口径预算与多阶段演进) ----------------- */}
          <div className='kri-section'>
            <div className='kri-section-header'>
              <div className='kri-section-title-wrap'>
                <span className='kri-section-pill kri-pill-02'>02 · 预算与演进</span>
                <h3 className='kri-section-title'>全口径预算统筹与多阶段投放演进</h3>
              </div>
              <span className='kri-section-desc'>黑山Q3、EX330与跑山女孩预算执行结构与双周演进</span>
            </div>
            {overviewMetrics.length > 0 && <MetricStrip items={overviewMetrics} />}
            <div className='kri-grid-2'>
              {/* 1.1 子项目全口径预算规划 vs 实际消耗 */}
              {budgetData && (
                <ChartPanel
                  title='子项目全口径预算规划 vs 实际消耗'
                  subtitle='拆解黑山Q3、EX330与跑山女孩子项目预算及执行进度'
                >
                  <CampaignComboChart
                    title='子项目全口径预算规划 vs 实际消耗'
                    rows={budgetData.rows}
                    xKey='name'
                    series={[
                      {
                        key: 'budget',
                        label: '规划总预算',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: '#0F5E52',
                      },
                      {
                        key: 'spend',
                        label: '实际总消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: '#2E6F8E',
                      },
                      {
                        key: 'pacing',
                        label: '执行进度',
                        unit: '%',
                        axis: 'right',
                        kind: 'line',
                        color: '#D95D39',
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 1.2 三子项目达人采买(K) vs 投流消耗(FS) 堆叠构成 */}
              {budgetData && (
                <ChartPanel
                  title='子项目达人采买(K) vs 投流消耗(FS) 堆叠构成'
                  subtitle='拆解K端博主采买裸价与FS端商业投流放大(含返点)的真实资金分配'
                >
                  <StackedHorizontalBarChart
                    rows={budgetData.stackedRows}
                    segments={budgetData.stackedSegments}
                    unit='元'
                  />
                  <table className="subproj-table">
                    <thead>
                      <tr>
                        <th>子项目名称</th>
                        <th>规划总预算</th>
                        <th>实际总消耗</th>
                        <th>K端达人 / FS投流</th>
                        <th>执行进度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetTable?.rows.map((r, idx) => {
                        const name = String(r.projectName || '');
                        const b = parseNum(r.totalBudget) || 0;
                        const s = parseNum(r.totalSpend) || 0;
                        const k = parseNum(r.kSpend) || 0;
                        const fsVal = parseNum(r.fsSpend) || 0;
                        const p = parseNum(r.pacingPct) ?? (b > 0 ? (s / b) * 100 : 0);
                        const tagCls = p >= 90 ? 'tag-ok' : p >= 80 ? 'tag-warn' : 'tag-neutral';
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, color: '#1C1917' }}>{name}</td>
                            <td className="num">¥{(b / 10000).toFixed(2)}万</td>
                            <td className="num" style={{ fontWeight: 600 }}>¥{(s / 10000).toFixed(2)}万</td>
                            <td className="num" style={{ color: '#57534E' }}>
                              K: ¥{(k / 10000).toFixed(1)}w / FS: ¥{(fsVal / 10000).toFixed(1)}w
                            </td>
                            <td><span className={`semantic-tag ${tagCls} num`}>{p.toFixed(1)}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ChartPanel>
              )}

              {/* 1.3 7-10月投放消耗 vs 平均点击成本 */}
              {monthlyData && (
                <ChartPanel
                  title='7-10月投放消耗 vs 平均点击成本 (CPC)'
                  subtitle='基于7-10月创意底表78,998条底层日志真实回溯'
                >
                  <CampaignComboChart
                    title='7-10月投放消耗 vs 平均点击成本 (CPC)'
                    rows={monthlyData.rows}
                    xKey='month'
                    series={[
                      {
                        key: 'spend',
                        label: '投放消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      {
                        key: 'cpc',
                        label: '平均点击成本',
                        unit: '元',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.terracotta,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 1.4 Q3双周阶段演化对比表 */}
              {biweeklyData && (
                <ChartPanel
                  title='Q3双周阶段演进效率趋势'
                  subtitle='7.16-8.12首期测新 → 8月全月攻坚 → 8.27-9.8前哨冲刺 → 9.9-9.27决战收官'
                  actions={
                    <div className='kri-toggle-group' role='group' aria-label='双周阶段效率指标切换'>
                      <button
                        type='button'
                        className={`kri-toggle-btn ${stageMetric === 'ctr' ? 'active' : ''}`}
                        onClick={() => setStageMetric('ctr')}
                      >
                        点击率 CTR (%)
                      </button>
                      <button
                        type='button'
                        className={`kri-toggle-btn ${stageMetric === 'cpe' ? 'active' : ''}`}
                        onClick={() => setStageMetric('cpe')}
                      >
                        互动成本 CPE (元)
                      </button>
                    </div>
                  }
                >
                  <CampaignComboChart
                    title='Q3双周阶段演进效率趋势'
                    rows={biweeklyData.rows}
                    xKey='stage'
                    series={[
                      {
                        key: 'spend',
                        label: '阶段消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      stageMetric === 'ctr'
                        ? {
                            key: 'ctr',
                            label: '点击率 CTR',
                            unit: '%',
                            axis: 'right',
                            kind: 'line',
                            color: CAMPAIGN_PALETTE.primary,
                          }
                        : {
                            key: 'cpe',
                            label: '互动成本 CPE',
                            unit: '元',
                            axis: 'right',
                            kind: 'line',
                            color: CAMPAIGN_PALETTE.gold,
                          },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}
            </div>
          </div>

          <div className='kri-section'>
            <div className='kri-section-header'>
              <div className='kri-section-title-wrap'>
                <span className='kri-section-pill kri-pill-03'>03 · 漏斗与双端归因</span>
                <h3 className='kri-section-title'>KFS全域流量转化漏斗与双端归因</h3>
              </div>
              <span className='kri-section-desc'>各项指标保留原表归因口径，拆解自然沉淀与商业投流协同效能</span>
            </div>
            <div className='kri-grid-2'>
              {/* 2.1 全链路种草转化漏斗 */}
              {funnelData && (
                <ChartPanel
                  title='Q3种草投流 关键交付节点'
                  subtitle='曝光、点击与互动为行为量；站外活跃UV为独立归因人数'
                >
                  <CampaignFunnelChart stages={funnelData.stages} />
                </ChartPanel>
              )}

              {/* 2.2 自然流量 vs 商业投流 贡献拆解 + 六维能力雷达图 */}
              <ChartPanel
                title='自然流量 vs 商业投流 贡献拆解与六维能力雷达'
                subtitle='内容端(K)与投流端(FS)贡献占比与多维效能对比'
              >
                <KailasKfsRadarAndDualView organicPaidTable={organicPaidTable} />
              </ChartPanel>
            </div>
          </div>

          {/* ----------------- L3 闭环行动层 (03B 阶段性策略复盘洞察与 Next Step 行动追踪) ----------------- */}
          <div className='kri-section'>
            <div className='kri-section-header'>
              <div className='kri-section-title-wrap'>
                <span className='kri-section-pill kri-pill-03b'>03B · 闭环行动层</span>
                <h3 className='kri-section-title'>阶段性策略复盘洞察 (Key Learnings) 与 Next Step 行动追踪</h3>
              </div>
              <span className='kri-section-desc'>支持按业务维度筛选行动待办，勾选即时同步完成归档状态</span>
            </div>
            <div className='kri-grid-2'>
              {/* 左：核心复盘洞察 2x2 网格 */}
              <ChartPanel
                title='阶段性策略复盘洞察 (Key Learnings)'
                subtitle='基于黑山、EX330 与跑山女孩双周执行全周期数据实证沉淀'
              >
                <div className='insight-grid'>
                  <div className='insight-card success'>
                    <h4>
                      <span>1. EX330黑山 92.7% 领跑</span>
                      <span className='semantic-tag tag-ok'>验证有效</span>
                    </h4>
                    <p>EX330 与黑山系列执行进度分别达 92.7% 与 87.4%，成为 Q3 核心跑量支柱；单品直推与防风保暖场景心智渗透最深。</p>
                  </div>
                  <div className='insight-card success'>
                    <h4>
                      <span>2. FS信息流 CTR 9.96% 高效放量</span>
                      <span className='semantic-tag tag-ok'>超大盘 81%</span>
                    </h4>
                    <p>FS 商业投流信息流累计 CTR 达到 9.96%（远超户外大盘 5.5% 均值），腰部与初级达人真实上身图在信息流中杠杆放大效应显著。</p>
                  </div>
                  <div className='insight-card warn'>
                    <h4>
                      <span>3. 小红星 CPUV ¥73.95 需优化</span>
                      <span className='semantic-tag tag-warn'>亟需攻坚</span>
                    </h4>
                    <p>小红星站外活跃外溢 10,408 UV，但单 UV 进店成本达 ¥73.95，需优化外溢链路定向、剔除宽泛泛词，提升淘系天猫店铺联动转化率。</p>
                  </div>
                  <div className='insight-card success'>
                    <h4>
                      <span>4. 腰部+初级达人种草杠杆显著</span>
                      <span className='semantic-tag tag-ok'>存量待加推</span>
                    </h4>
                    <p>Top 8 达人投流杠杆最高达 8.5x，低采买成本+高追投机制已验证；但 9 篇潜力笔记杠杆不足 0.2x，存在明显补投加推空间。</p>
                  </div>
                </div>
              </ChartPanel>

              {/* 右：Next Step Action Tracker */}
              <ChartPanel
                title='Next Step 重点推进事项 (Action Tracker)'
                subtitle='直接将数据归因转化为团队落地执行待办，支持多维度过滤与实时勾选'
                actions={
                  <span className='card-badge'>
                    已完成 {completedTaskCount} / 共 {filteredTasks.length} 项
                  </span>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className='segmented-tabs' role='tablist'>
                    <button
                      type='button'
                      className={`seg-btn ${actionCategory === 'all' ? 'active' : ''}`}
                      onClick={() => setActionCategory('all')}
                    >
                      全部事项 ({kailasTasks.length})
                    </button>
                    <button
                      type='button'
                      className={`seg-btn ${actionCategory === 'ads' ? 'active' : ''}`}
                      onClick={() => setActionCategory('ads')}
                    >
                      投流提效
                    </button>
                    <button
                      type='button'
                      className={`seg-btn ${actionCategory === 'content' ? 'active' : ''}`}
                      onClick={() => setActionCategory('content')}
                    >
                      内容与进店
                    </button>
                  </div>

                  <div className='task-list'>
                    {filteredTasks.map((t) => {
                      const isDone = Boolean(doneTasks[t.id]);
                      return (
                        <label key={t.id} className={`task-item ${isDone ? 'completed' : ''}`}>
                          <input
                            type='checkbox'
                            className='task-check'
                            checked={isDone}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setDoneTasks((prev) => ({ ...prev, [t.id]: checked }));
                            }}
                          />
                          <span className='task-desc'>{t.text}</span>
                          <div className='task-meta'>
                            <span className='owner-chip'>{t.owner}</span>
                            <span className='num' style={{ color: '#8A847C' }}>{t.date}</span>
                            <span className={`semantic-tag ${isDone ? 'tag-ok' : t.tagClass}`}>{isDone ? '已完成' : t.statusText}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </ChartPanel>
            </div>
          </div>
          <details className="kri-section kri-secondary">
            <summary className="kri-summary-header">
              <span className="kri-summary-left">
                <span className="kri-section-pill kri-pill-04">04 · 投流杠杆与诊断</span>
                <span>笔记投流杠杆、Pareto 集中度与四象限散点诊断</span>
              </span>
            </summary>
            <div className="kri-details-body">
            <div className='kri-grid-2'>
              {/* 3.1 119篇达人笔记四象限散点诊断 */}
              {scatterData && (
                <ChartPanel
                  title='119篇达人笔记【投流消耗 × 互动成本 CPE】四象限散点诊断'
                  subtitle='X:单篇消耗 / Y:互动成本CPE / 气泡:互动量 / 四分类发光气泡与均值线'
                >
                  <KailasQuadrantScatterChart data={scatterData} />
                </ChartPanel>
              )}

              {/* 3.2 Top 10 笔记 Pareto 集中度 */}
              {paretoData && (
                <ChartPanel
                  title='Top 10 笔记素材投流消耗与累计占比 (Pareto)'
                  subtitle='头部素材投流集中度与累计占比分布曲线'
                >
                  <CampaignComboChart
                    title='Top 10 笔记素材投流消耗与累计占比 (Pareto)'
                    rows={paretoData.rows}
                    xKey='name'
                    series={[
                      {
                        key: 'spend',
                        label: '素材投流消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      {
                        key: 'cumPct',
                        label: '累计消耗占比',
                        unit: '%',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.gold,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 3.3 Top 8 笔记投流杠杆倍数榜 (FS / K) */}
              {leverageTopData && (
                <ChartPanel
                  title='Top 8 高投流杠杆笔记 (FS商业投流 / K端采买倍数)'
                  subtitle='精选撬动杠杆最高的达人素材：K端低价采买、FS端高强度追投放大'
                >
                  <HorizontalBarChart data={leverageTopData.items} height={250} />
                </ChartPanel>
              )}

              {/* 3.4 9篇低成本高转化待加推潜力笔记清单 */}
              {potentialNotesData && (
                <ChartPanel
                  title='需提升消耗的潜力笔记加推清单 (低杠杆高转化)'
                  subtitle='挖掘自 hGgSvt：具备高点击率(最高12.11%)与极佳CPE(最低¥2.49)却严重低投(杠杆<0.2x)'
                >
                  <div className='kri-potential-wrap'>
                    <div className='kri-potential-grid'>
                      {potentialNotesData.slice(0, 6).map((item, idx) => (
                        <div key={item.noteId || idx} className='kri-potential-card'>
                          <div className='kri-pot-head'>
                            <span className='kri-pot-name'>#{idx + 1} {item.kolName}</span>
                            <span className='kri-pot-lev'>杠杆 {item.fsKLeverage?.toFixed(2)}x</span>
                          </div>
                          <div className='kri-pot-metrics'>
                            <span>CTR <strong>{item.ctr?.toFixed(1)}%</strong></span>
                            <span>CPC <strong>¥{item.cpc?.toFixed(2)}</strong></span>
                            <span>CPE <strong>¥{item.cpe?.toFixed(2)}</strong></span>
                            <span>已投 <strong>{fmtMoney(item.fsSpend)}</strong></span>
                          </div>
                          <div className='kri-pot-rec'>{item.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartPanel>
              )}
            </div>
            </div>
          </details>

          <details className="kri-section kri-secondary">
            <summary className="kri-summary-header">
              <span className="kri-summary-left">
                <span className="kri-section-pill kri-pill-05">05 · 搜索与人群定向</span>
                <span>搜索词类与精准人群定向引擎</span>
              </span>
            </summary>
            <div className="kri-details-body">
            <div className='kri-grid-2'>
              {/* 4.1 搜索推广大类关键词投放效果多指标分析 */}
              {kwData && (
                <ChartPanel
                  title='搜索推广大类关键词投放效果多指标分析'
                  subtitle='品牌词、品类词、穿搭词、竞品词、场景词与大促词消耗及点击率表现'
                >
                  <CampaignComboChart
                    title='搜索推广大类关键词投放效果多指标分析'
                    rows={kwData.rows}
                    xKey='category'
                    series={[
                      {
                        key: 'spend',
                        label: '关键词消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.primary,
                      },
                      {
                        key: 'ctr',
                        label: '点击率 (CTR)',
                        unit: '%',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.terracotta,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 4.2 核心精准定向人群包消耗与点击成本对比 */}
              {targetingData && (
                <ChartPanel
                  title='核心精准定向人群包消耗与点击成本对比 (Top 12)'
                  subtitle='核心产品包、出游穿搭、奢品看世界、辛芷蕾粉丝等精准人群定向效率'
                >
                  <CampaignComboChart
                    title='核心精准定向人群包消耗与点击成本对比'
                    rows={targetingData.rows}
                    xKey='group'
                    series={[
                      {
                        key: 'spend',
                        label: '人群包消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      {
                        key: 'cpc',
                        label: '平均点击成本 (CPC)',
                        unit: '元',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.gold,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}
            </div>
            </div>
          </details>

          <details className="kri-section kri-secondary">
            <summary className="kri-summary-header">
              <span className="kri-summary-left">
                <span className="kri-section-pill kri-pill-06">06 · 达人池与审稿质检</span>
                <span>达人候选池规模、内容方向热力矩阵与审稿质检</span>
              </span>
            </summary>
            <div className="kri-details-body">
            <div className='kri-grid-2'>
              {/* 5.1 初筛与复筛候选达人独立池状态分布 */}
              {poolData && (
                <ChartPanel
                  title='初筛与复筛候选达人独立池状态分布'
                  subtitle='海选初筛(1530)与深入复筛(615)为独立评估池，实际签约执行登记70位'
                >
                  <HorizontalBarChart data={poolData.items} height={250} />
                </ChartPanel>
              )}

              {/* 5.2 达人层级 × 内容方向 二维热力矩阵 */}
              {matrixData && (
                <ChartPanel
                  title='【达人层级 × 8大内容方向】二维篇数与采买热力矩阵'
                  subtitle='头部(1)、腰部(2)、尾部(46)、UGC(21) 在时尚穿搭、跑山专业等方向的交叉落地'
                >
                  <MatrixHeatmapChart
                    rows={matrixData.rows}
                    cols={matrixData.cols}
                    cells={matrixData.cells}
                    rowHeaderTitle='达人层级'
                    unit='篇'
                  />
                </ChartPanel>
              )}
            </div>

            {/* 5.3 达人审稿常见问题归纳 (折叠收纳在 details 内，保障清爽) */}
            <div className='kri-audit-collapsible-box'>
              <details
                className='kri-details'
                open={auditExpanded}
                onToggle={(e) => setAuditExpanded((e.target as HTMLDetailsElement).open)}
              >
                <summary className='kri-summary'>
                  <span className='kri-summary-title'>
                    📋 达人内容审核 高频问题归纳与质检红线标准 (点击展开/折叠 8项要点)
                  </span>
                  <span className='kri-summary-tag'>
                    {auditExpanded ? '收起质检卡' : '展开查看 8 大规范与典型案例'}
                  </span>
                </summary>

                <div className='kri-audit-card-grid'>
                  {auditIssues.map((issue, idx) => (
                    <div key={String(issue.issueCode || idx)} className='kri-audit-card'>
                      <div className='kri-audit-head'>
                        <span className={`kri-audit-sev ${String(issue.severity || '').includes('P0') ? 'kri-sev-p0' : 'kri-sev-p1'}`}>
                          {String(issue.severity || '')}
                        </span>
                        <span className='kri-audit-cat'>{String(issue.category || '')}</span>
                        <span className='kri-audit-freq'>{String(issue.violationCount || '')}</span>
                      </div>
                      <h4 className='kri-audit-name'>{String(issue.issueTitle || '')}</h4>
                      <div className='kri-audit-ex'>
                        <div className='kri-audit-bad'><strong>❌ 错误示例：</strong>{String(issue.examples || '')}</div>
                        <div className='kri-audit-good'><strong>✅ 规范标准：</strong>{String(issue.correctStandard || '')}</div>
                      </div>
                      <div className='kri-audit-act'><strong>质检卡点：</strong>{String(issue.action || '')}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
            </div>
          </details>
        </>
      )}

      {/* ======================= SECTION: ADS ======================= */}
      {section === 'ads' && (
        <div className='kri-section'>
          <div className='kri-section-header'>
            <div className='kri-section-title-wrap'>
              <span className='ca-chapter-num'>01</span>
              <h3 className='kri-section-title'>搜索与人群精准定向深度分析</h3>
            </div>
            <span className='kri-section-desc'>搜索推广词类消耗、点击率与核心定向人群转化表现</span>
          </div>

          {adsMetrics.length > 0 && <MetricStrip items={adsMetrics} />}

          <div className='kri-grid-2'>
            {/* Chart 5: Search Keyword Categories */}
            {kwData && (
              <ChartPanel
                title='搜索推广大类关键词投放效果多指标分析'
                subtitle='品牌词、品类词、穿搭词、竞品词等分类消耗与点击表现'
              >
                <CampaignComboChart
                  title='搜索推广大类关键词投放效果多指标分析'
                  rows={kwData.rows}
                  xKey='category'
                  series={[
                    {
                      key: 'spend',
                      label: '关键词消耗',
                      unit: '元',
                      axis: 'left',
                      kind: 'bar',
                      color: CAMPAIGN_PALETTE.primary,
                    },
                    {
                      key: 'ctr',
                      label: '点击率 (CTR)',
                      unit: '%',
                      axis: 'right',
                      kind: 'line',
                        color: CAMPAIGN_PALETTE.terracotta,
                    },
                  ]}
                  height={260}
                />
              </ChartPanel>
            )}

            {/* Chart 6: Audience Targeting */}
            {targetingData && (
              <ChartPanel
                title='核心精准定向人群包消耗与点击成本对比'
                subtitle='核心产品包、出游穿搭、奢品、运动机能等定向效率表现'
              >
                <CampaignComboChart
                  title='核心精准定向人群包消耗与点击成本对比'
                  rows={targetingData.rows}
                  xKey='group'
                  series={[
                    {
                      key: 'spend',
                      label: '人群包消耗',
                      unit: '元',
                      axis: 'left',
                      kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                    },
                    {
                      key: 'cpc',
                      label: '平均点击成本 (CPC)',
                      unit: '元',
                      axis: 'right',
                      kind: 'line',
                      color: CAMPAIGN_PALETTE.gold,
                    },
                  ]}
                  height={260}
                />
              </ChartPanel>
            )}
          </div>
        </div>
      )}

      {/* ======================= SECTION: CONTENT ======================= */}
      {section === 'content' && (
        <div className='kri-section'>
          <div className='kri-section-header'>
            <div className='kri-section-title-wrap'>
              <span className='ca-chapter-num'>01</span>
              <h3 className='kri-section-title'>达人池与内容方向合作深度分析</h3>
            </div>
            <span className='kri-section-desc'>达人初筛复筛独立池分布与各内容方向篇数及采买结构</span>
          </div>

          {contentMetrics.length > 0 && <MetricStrip items={contentMetrics} />}

          <div className='kri-grid-2'>
            {/* Chart 7: Candidate Pool Status (Independent Stages) */}
            {poolData && (
              <ChartPanel
                title='初筛与复筛候选达人独立池状态分布'
                subtitle='初筛与复筛为独立评估池（非同母集单一漏斗），各池独立核实'
              >
                <HorizontalBarChart data={poolData.items} height={260} />
              </ChartPanel>
            )}

            {/* Chart 8: Content Direction Summary */}
            {directionData && (
              <ChartPanel
                title='内容方向合作篇数与采买费用对比'
                subtitle='时尚穿搭、跑山专业、街头采访等方向结构分布'
              >
                <CampaignComboChart
                  title='内容方向合作篇数与采买费用对比'
                  rows={directionData.rows}
                  xKey='direction'
                  series={[
                    {
                      key: 'noteCount',
                      label: '合作篇数',
                      unit: '篇',
                      axis: 'left',
                      kind: 'bar',
                      color: CAMPAIGN_PALETTE.primary,
                    },
                    {
                      key: 'kolSpend',
                      label: '合作合计金额（含服务费）',
                      unit: '元',
                      axis: 'right',
                      kind: 'line',
                      color: CAMPAIGN_PALETTE.gold,
                    },
                  ]}
                  height={260}
                />
              </ChartPanel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
