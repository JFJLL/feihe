'use client';

import React, { useState } from 'react';
import type { CompetitorIntelligenceData } from '../../lib/competitor-intelligence';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

export function CompetitorIntelligenceSection({
  intelligence,
}: {
  intelligence?: CompetitorIntelligenceData;
}) {
  const [activeBrand, setActiveBrand] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  if (!intelligence || !intelligence.brands.length) return null;

  const { months, brands, performance, creatorMix, formatMix, tagNames, contentMix, productStrategies, actions, searchFlow } = intelligence;

  const curMonth = months.includes(selectedMonth) ? selectedMonth : months.at(-1) || '2026-08';
  const perfList = performance.filter(p => p.month === curMonth);
  const filteredBrands = activeBrand === 'all' ? brands : brands.filter(b => b.id === activeBrand);

  // 当前月份各品牌指标汇总
  const brandPerfMap = new Map(perfList.map(p => [p.brand, p]));

  return (
    <div className="stack animate-fade-in" style={{ gap: '20px', marginTop: '8px' }}>
      {/* 顶部情报筛选与快速切换工具栏 */}
      <div className="reference-date-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className="section-mini-tag tag-purple">全盘竞品情报台</span>
          <small>数据源自飞鹤竞品月报收集表（千瓜/灵犀/蒲公英多源核对）</small>
        </div>
        <div className="reference-date-controls">
          <label>情报月份
            <select value={curMonth} onChange={e => setSelectedMonth(e.target.value)} aria-label="情报月份">
              {[...months].reverse().map(m => (
                <option key={m} value={m}>{m}{m === months.at(-1) ? ' (最新)' : ''}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setActiveBrand('all')} className={activeBrand === 'all' ? 'active' : ''}>
            全部品牌
          </button>
        </div>
      </div>

      {/* 1. 竞争信号带：各品牌商单投入与爆文率总览驾驶舱 */}
      <DashboardSection
        eyebrow="CONTENT STRATEGY"
        title="7 大品牌商单投放与爆文效率大盘"
        desc="横向对比各品牌当月商单总投入（万元）、商业笔记篇数、阅读/互动量与爆文率。点击卡片可聚焦观察单个品牌。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {brands.map(b => {
            const p = brandPerfMap.get(b.id);
            const isSelected = activeBrand === b.id;
            return (
              <div
                key={b.id}
                onClick={() => setActiveBrand(activeBrand === b.id ? 'all' : b.id)}
                style={{
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${b.color}` : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  background: isSelected ? '#f0f9ff' : '#ffffff',
                  boxShadow: isSelected ? '0 4px 12px rgba(30,96,145,0.12)' : '0 1px 3px rgba(15,23,42,0.04)',
                  transition: 'all .2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: b.color, fontSize: '15px' }}>{b.name} {b.self ? '(本品)' : ''}</strong>
                  <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: p ? '#ecfdf5' : '#fef2f2', color: p ? '#047857' : '#b91c1c' }}>
                    {p ? '已填报' : '未报备'}
                  </span>
                </div>
                {p ? (
                  <>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                      ¥{(p.spend / 10000).toFixed(1)} <small style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>万投入</small>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span>笔记 <b>{p.notes.toLocaleString()}</b> 篇</span>
                      <span>爆文 <b>{p.viral}</b> 篇</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span>爆文率 <strong style={{ color: '#0284c7' }}>{(p.reported.viralRate * 100).toFixed(1)}%</strong></span>
                      <span>互动 <b style={{ color: '#059669' }}>{compact(p.interactions)}</b></span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', padding: '16px 0', textAlign: 'center' }}>该月份暂无公开填报数据</div>
                )}
              </div>
            );
          })}
        </div>
      </DashboardSection>

      {/* 2. 达人量级矩阵分布 & 内容形式对比 (两栏) */}
      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="CREATOR EFFICIENCY"
          title="各品牌达人量级供给矩阵"
          desc="统计明星、头部、腰部、初级及素人博主占比，看各家投流与种草结构集中度。"
        >
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>品牌</th>
                  <th>明星/知名</th>
                  <th>头部博主</th>
                  <th>腰部达人</th>
                  <th>初级达人</th>
                  <th>素人KOC</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map(b => {
                  const mix = creatorMix.find(m => m.brand === b.id && m.month === curMonth);
                  if (!mix) return null;
                  return (
                    <tr key={b.id}>
                      <td><strong style={{ color: b.color }}>{b.name}</strong></td>
                      <td>{((mix.star + mix.known) * 100).toFixed(1)}%</td>
                      <td>{(mix.head * 100).toFixed(1)}%</td>
                      <td><strong style={{ color: '#1e6091' }}>{(mix.waist * 100).toFixed(1)}%</strong></td>
                      <td><strong style={{ color: '#0d9488' }}>{(mix.junior * 100).toFixed(1)}%</strong></td>
                      <td>{(mix.amateur * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="FORMAT MIX"
          title="图文 vs 视频内容形态构成"
          desc="对比各品牌在小红书图文与视频形式的资源倾斜度。"
        >
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>品牌</th>
                  <th>图文占比</th>
                  <th>视频占比</th>
                  <th>形态结构分布</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map(b => {
                  const f = formatMix.find(m => m.brand === b.id && m.month === curMonth);
                  if (!f) return null;
                  const imgPct = Math.round(f.image * 100);
                  const vidPct = Math.round(f.video * 100);
                  return (
                    <tr key={b.id}>
                      <td><strong style={{ color: b.color }}>{b.name}</strong></td>
                      <td>{imgPct}%</td>
                      <td>{vidPct}%</td>
                      <td>
                        <div style={{ height: '14px', width: '100%', background: '#8b5cf6', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${imgPct}%`, background: '#1e6091', transition: 'width .5s' }} title={`图文 ${imgPct}%`} />
                          <div style={{ width: `${vidPct}%`, background: '#8b5cf6', transition: 'width .5s' }} title={`视频 ${vidPct}%`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      </div>

      {/* 3. 14 大内容切角渗透热力矩阵 */}
      <DashboardSection
        eyebrow="TOPIC TAXONOMY"
        title="14 大内容切角与场景渗透分布（篇数矩阵）"
        desc="源自千瓜商业笔记打标底表：横向对比各大品牌在喂养经验、转奶、敏宝、干货科普等 14 种选题的投放兵力。"
      >
        <div className="ops-table-wrap" style={{ maxHeight: '380px', overflowX: 'auto' }}>
          <table className="ops-table" style={{ minWidth: '860px' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 2 }}>内容切角 / 需求</th>
                {brands.map(b => (
                  <th key={b.id} style={{ color: b.color, textAlign: 'center' }}>{b.short}</th>
                ))}
                <th style={{ textAlign: 'center' }}>全行业合计</th>
              </tr>
            </thead>
            <tbody>
              {tagNames.map(tag => {
                let rowTotal = 0;
                return (
                  <tr key={tag}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>{tag}</td>
                    {brands.map(b => {
                      const item = contentMix.find(c => c.brand === b.id && c.month === curMonth && c.tag === tag);
                      const val = item ? item.count : 0;
                      rowTotal += val;
                      return (
                        <td key={b.id} style={{ textAlign: 'center', background: val > 100 ? '#f0fdf4' : 'transparent' }}>
                          {val > 0 ? <strong>{val}</strong> : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#1e6091' }}>{rowTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* 4. 品线战略对标与核心卖点定位 */}
      <DashboardSection
        eyebrow="BRAND LANDSCAPE"
        title="飞鹤与核心竞品品线战略对标与卖点解析"
        desc="源自源表板块六：沟通人群画像、一句话卖点定位与核心种草场景。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {productStrategies.map((s, idx) => {
            const b = brands.find(brand => brand.id === s.brand);
            return (
              <div key={s.line + idx} className="pastel-card pastel-blue" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px', color: b?.color || '#1e6091' }}>{b?.name} · {s.line}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{s.evidence}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>“{s.proposition}”</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  <b style={{ color: '#1e293b' }}>人群：</b>{s.audience}
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  <b style={{ color: '#1e293b' }}>核心场景：</b>{s.scenarios}
                </div>
              </div>
            );
          })}
        </div>
      </DashboardSection>

      {/* 5. 品牌近期重大动作与蒲公英上下游搜索词 */}
      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="ACTION SLA"
          title="品牌近期大动作时间轴 (代言/溯源/节点)"
          desc="源自板块八：各大品牌明星官宣、牧场溯源与重要营销战役回顾。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {actions.slice(0, 6).map((act, i) => {
              const b = brands.find(brand => brand.id === act.brand);
              return (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: b?.color || '#1e6091', minWidth: '46px' }}>{act.month}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
                      [{act.type}] {act.title}
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', lineHeight: 1.5 }}>{act.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="VOICE OF CUSTOMER"
          title="蒲公英品牌词上下游流转关系 (Top20 词表)"
          desc="源自飞鹤8月竞品搜索底表：用户在搜索该品牌词前后的真实联想词流转。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {searchFlow.slice(0, 3).map((sf, idx) => (
              <div key={sf.keyword + idx} style={{ padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '13px', color: '#1e6091' }}>关键词：{sf.keyword}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>品牌检索主词</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '4px' }}>
                  <span style={{ color: '#0d9488', fontWeight: 600 }}>上游词：</span>
                  {sf.upstream.slice(0, 6).join('、')}
                </div>
                <div style={{ fontSize: '11.5px', color: '#475569' }}>
                  <span style={{ color: '#8b5cf6', fontWeight: 600 }}>下游词：</span>
                  {sf.downstream.slice(0, 6).join('、')}
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
