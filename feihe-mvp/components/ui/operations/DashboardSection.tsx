import React from 'react';

const sectionLabels: Record<string, [string, string]> = {
  'CONTENT STRATEGY': ['内容策略', 'blue'], 'FORMAT MIX': ['形式分析', 'teal'],
  'CREATOR EFFICIENCY': ['达人效率', 'purple'], 'GEOGRAPHY': ['地域分布', 'green'],
  'CONTENT RANKING': ['内容排行', 'blue'], 'MONTHLY SEARCH': ['竞品月报', 'purple'],
  'BRAND LANDSCAPE': ['竞争格局', 'blue'], 'SENTIMENT COMPOSITION': ['口碑结构', 'green'],
  'VOICE TREND': ['动态走势', 'blue'], 'TOPIC TAXONOMY': ['话题分析', 'teal'],
  'VOICE OF CUSTOMER': ['消费者洞察', 'purple'], 'ACTION SLA': ['行动闭环', 'amber'],
};

export function DashboardSection({
  eyebrow,
  title,
  desc,
  extra,
  children,
  className = '',
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [label, tone] = sectionLabels[eyebrow || ''] || [eyebrow, 'blue'];
  return (
    <section className={`ops-section-card ${className}`}>
      <div className="ops-section-card-head">
        <div className="ops-section-card-title-group">
          {label && <span className={`section-mini-tag tag-${tone}`}>{label}</span>}
          <h3>{title}</h3>
          {desc && <span className="ops-section-card-desc">{desc}</span>}
        </div>
        {extra && <div className="ops-section-card-extra">{extra}</div>}
      </div>
      {children}
    </section>
  );
}
