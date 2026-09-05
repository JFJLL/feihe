export type DailyRecord = {
  date: string;
  plan_spend: number;
  actual_spend: number;
  achieve_pct: number;
  feed_spend: number;
  feed_ctr: number;
  search_spend: number;
  search_ctr: number;
  xhm_cpuv: number;
  xhx_cpuv: number;
  notes_today: number;
  comments_today: number;
};

export type AngleProgress = {
  name: string;
  plan: number;
  actual: number;
  pct: number;
  month_plan: number;
  month_actual: number;
  month_pct: number;
};

export type NextStep = {
  id: number;
  content: string;
  owner: string;
  deadline: string;
  status: 'doing' | 'done' | 'todo';
  statusText: string;
};

function generateDailyData(): { map: Record<string, DailyRecord>; dates: string[] } {
  const map: Record<string, DailyRecord> = {};
  const dates: string[] = [];
  const start = new Date('2026-07-01T00:00:00Z');

  for (let i = 0; i < 67; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    dates.push(key);
    const isJuly = i < 31;
    const isAug = i >= 31 && i < 62;
    const plan = isJuly ? 38700 : isAug ? 26000 : 28000;
    const baseActual = isJuly ? 33100 + i * 30 : isAug ? 24000 + (i - 31) * 55 : 27000 + (i - 62) * 80;
    const actual = Math.round(baseActual + Math.sin(i * 0.7) * 400);
    const achieve = Math.round((actual / plan) * 1000) / 10;
    const feedCTR = isJuly
      ? 8.25 + i * 0.01 + Math.sin(i * 0.5) * 0.15
      : isAug
      ? 8.25 + (i - 31) * 0.018 + Math.sin(i * 0.5) * 0.2
      : 7.45 + (i - 62) * 0.03 + Math.sin(i * 0.5) * 0.1;
    const searchCTR = isJuly
      ? 5.0 + Math.sin(i * 0.8) * 0.35
      : isAug
      ? 5.0 - (i - 31) * 0.015 + Math.sin(i * 0.6) * 0.2
      : 6.85 + (i - 62) * 0.06 + Math.sin(i * 0.6) * 0.15;
    const xhmCPUV = isJuly
      ? 15.5 + i * 0.05 + Math.sin(i * 0.4) * 0.5
      : isAug
      ? 15.8 + Math.sin(i * 0.5) * 0.4
      : 15.2 + Math.sin(i * 0.5) * 0.3;
    const xhxCPUV = 5.0 + Math.sin(i * 0.6) * 0.3 + Math.cos(i * 0.3) * 0.1;
    const notes = i % 4 === 0 ? 4 : i % 4 === 1 ? 2 : i % 4 === 2 ? 3 : 1;
    const comments = 10 + (i % 15);

    map[key] = {
      date: key,
      plan_spend: plan,
      actual_spend: actual,
      achieve_pct: achieve,
      feed_spend: Math.round(actual * 0.306),
      feed_ctr: Math.round(feedCTR * 100) / 100,
      search_spend: Math.round(actual * 0.694),
      search_ctr: Math.round(searchCTR * 100) / 100,
      xhm_cpuv: Math.round(xhmCPUV * 100) / 100,
      xhx_cpuv: Math.round(xhxCPUV * 100) / 100,
      notes_today: notes,
      comments_today: comments,
    };
  }

  // 修正 8/24 及最新 8/30 基准值
  if (map['2026-08-24']) {
    map['2026-08-24'] = {
      date: '2026-08-24', plan_spend: 26000, actual_spend: 25395, achieve_pct: 97.7,
      feed_spend: 7771, feed_ctr: 8.79, search_spend: 17624, search_ctr: 4.56,
      xhm_cpuv: 15.79, xhx_cpuv: 5.1, notes_today: 2, comments_today: 18,
    };
  }
  if (map['2026-08-30']) {
    map['2026-08-30'] = {
      date: '2026-08-30', plan_spend: 26000, actual_spend: 148008.8, achieve_pct: 569.3,
      feed_spend: 62660, feed_ctr: 7.41, search_spend: 85348.8, search_ctr: 6.79,
      xhm_cpuv: 15.5, xhx_cpuv: 5.16, notes_today: 2, comments_today: 15,
    };
  }

  return { map, dates };
}

const generated = generateDailyData();
export const DAILY_DATA = generated.map;
export const ALL_DATES = generated.dates;
export const LATEST_DATE = '2026-09-05';

export const KFS_DATA = {
  budgetTotal: 4750000,
  items: [
    { label: 'S-SEM搜索推广', amount: 283.66, pct: 59.7, color: '#0284c7', bg: '#e0f2fe' },
    { label: 'F-信息流与视频流', amount: 159.06, pct: 33.4, color: '#16a34a', bg: '#dcfce7' },
    { label: 'K-达人采买', amount: 62.69, pct: 13.2, color: '#ea580c', bg: '#ffedd5' },
    { label: 'SEO技术优化', amount: 6.17, pct: 1.3, color: '#8b5cf6', bg: '#ede9fe' },
    { label: '其他运维/产品', amount: 2.12, pct: 0.5, color: '#64748b', bg: '#f1f5f9' },
  ],
};

export const CHANNEL_DATA = {
  total: 378539,
  items: [
    { label: '小红盟', amount: 276269, pct: 73, color: '#2563eb', bg: '#eff6ff' },
    { label: '小红星', amount: 71770, pct: 19, color: '#f59e0b', bg: '#fef3c7' },
    { label: '搜索优化达人', amount: 30500, pct: 8, color: '#10b981', bg: '#ecfdf5' },
  ],
};

export const TIER_DATA = {
  total: 194,
  items: [
    { label: '初级达人 (5k-5w)', count: 114, pct: 58.8, color: '#10b981' },
    { label: '素人达人 (0-5k)', count: 59, pct: 30.4, color: '#f59e0b' },
    { label: '腰部达人 (5w-50w)', count: 21, pct: 10.8, color: '#0284c7' },
    { label: '头部达人 (>50w)', count: 0, pct: 0, color: '#cbd5e1' },
  ],
};

export const ANGLE_DATA: AngleProgress[] = [
  {
    name: '单品直推 (本品升级/转奶tips/混合喂养)',
    plan: 41,
    actual: 34,
    pct: 82.9,
    month_plan: 18,
    month_actual: 15,
    month_pct: 83.3,
  },
  {
    name: '竞品1v1横测 (塞纳牧/a2至初/优萃宝爱)',
    plan: 29,
    actual: 23,
    pct: 79.3,
    month_plan: 12,
    month_actual: 10,
    month_pct: 83.3,
  },
  {
    name: '敏敏转奶与防敏 (敏宝上岸/轻敏感养体质)',
    plan: 22,
    actual: 20,
    pct: 90.9,
    month_plan: 10,
    month_actual: 9,
    month_pct: 90.0,
  },
  {
    name: '本品纵测 (双萃/卓睿/星飞帆)',
    plan: 16,
    actual: 12,
    pct: 75.0,
    month_plan: 7,
    month_actual: 5,
    month_pct: 71.4,
  },
  {
    name: '电商引流与活动机制 (0元试喝/买赠福利)',
    plan: 10,
    actual: 4,
    pct: 40.0,
    month_plan: 5,
    month_actual: 2,
    month_pct: 40.0,
  },
  {
    name: '竞品多品横测 (赛纳牧/莼悦/优萃宝爱)',
    plan: 8,
    actual: 4,
    pct: 50.0,
    month_plan: 4,
    month_actual: 2,
    month_pct: 50.0,
  },
  {
    name: '素人询问与选奶经验',
    plan: 7,
    actual: 5,
    pct: 71.4,
    month_plan: 4,
    month_actual: 3,
    month_pct: 75.0,
  },
];

export const LEARNING_ITEMS = [
  {
    title: 'K端交付稳步推进',
    desc: 'SEM达人完成率 72%（已发96/待发37）；搜索优化达人完成率 39%（已发26/待发40），需加速。',
    tag: '达人交付',
    color: '#0284c7',
  },
  {
    title: 'FS端投流高质放量',
    desc: 'F端CTR达 8.38%（超KPI 6%）；S端CTR 4.99%，正优化词包向 7%-8% 冲刺。',
    tag: '投流CTR',
    color: '#16a34a',
  },
  {
    title: '内容切角转化验证',
    desc: '单品直推(34篇)与竞品1v1(23篇)转化优异；防敏切角(20篇)互动率领先。',
    tag: '内容切角',
    color: '#ea580c',
  },
  {
    title: '评论维护结构失衡',
    desc: '社区UGC维护过半(51%)，但本品笔记维护仅4%，严重滞后需紧急补位。',
    tag: '互动预警',
    color: '#dc2626',
  },
];

export const NEXT_STEP_ITEMS: NextStep[] = [
  {
    id: 1,
    content: '标准化词包人群：统一规范竞品人群与拦截词包命名体系，提升运营精度。',
    owner: '投放组',
    deadline: '8/30',
    status: 'doing',
    statusText: '进行中',
  },
  {
    id: 2,
    content: '迭代高热拦截词：结合母婴大盘热点，扩充高热竞品词包与品类需求词，拉升搜索CTR。',
    owner: '投放组',
    deadline: '9/5',
    status: 'todo',
    statusText: '待开始',
  },
  {
    id: 3,
    content: '高爆笔记1v1搭建：优质有机搜索词与高转化笔记单独绑定搭建，提高投流ROI。',
    owner: '内容组',
    deadline: '9/10',
    status: 'todo',
    statusText: '待开始',
  },
  {
    id: 4,
    content: '本品笔记评论维护补位：紧急调配人力，将本品笔记维护从4%提升至30%以上。',
    owner: '社区组',
    deadline: '8/28',
    status: 'doing',
    statusText: '进行中',
  },
  {
    id: 5,
    content: '9月达人锁档下单：推进9月88位达人（73人二核通过）正式下单，优化定制Brief。',
    owner: 'BD组',
    deadline: '8/31',
    status: 'doing',
    statusText: '进行中',
  },
];

export const EXEC_SUMMARY_ITEMS = [
  {
    tag: '达标',
    type: 'success' as const,
    text: '消耗节奏稳定，当日实际消耗 ¥25,395 / 计划 ¥26,000，达成率 97.7%。',
  },
  {
    tag: '达标',
    type: 'success' as const,
    text: '信息流 CTR 8.79%，超 KPI 目标 6%，持续放量优质流量。',
  },
  {
    tag: '预警',
    type: 'danger' as const,
    text: '搜索侧 CTR 4.56%，低于 KPI 下限 7%，需紧急重组优化关键词词包。',
  },
  {
    tag: '关注',
    type: 'warn' as const,
    text: 'Q3 预算消耗 42.18%，时间进度 59.8%，消耗滞后约 17.6 个百分点。',
  },
];


