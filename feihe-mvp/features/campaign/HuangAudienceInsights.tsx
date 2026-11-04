import { ChartPanel } from './CampaignCharts';
import { extractHuangTianeData, formatCurrency, formatNum, formatPercent, parseNum } from './huang-model';

type Model = ReturnType<typeof extractHuangTianeData>;

export function HuangAudienceInsights({ model }: { model: Model }) {
  const capacity = model.contentCapacity;
  const regional = model.beijingShanghaiPrecision;
  const audiences = model.brandAudiencesTop10.slice(0, 5);
  const namedAips = model.brandAudiencesTable.rows.filter(row => /aips|ais/i.test(String(row.audience || '')));
  const maxSpend = Math.max(1, ...audiences.map(row => parseNum(row.spend) ?? 0));
  const supply = [
    { label: '达人已发布', value: model.creatorsPublished, color: '#008573' },
    { label: 'KOS登记笔记', value: model.kosCount, color: '#5b5bd6' },
  ];
  return <section id="ht-sec-content-audience" className="ht-layer" aria-label="内容供给与核心人群">
    <div className="ht-layer-header">
      <div className="ht-layer-header-left">
        <span className="ht-chapter-num">02</span>
        <h3 className="ht-layer-title">内容供给与核心人群</h3>
      </div>
      <span className="ht-layer-sub">先看可用内容，再看人群质量与京沪覆盖</span>
    </div>
    <div className="ht-grid-2">
      <ChartPanel title="内容容量 当前物料供给" subtitle="达人执行表与KOS登记表；登记量不等于可复投素材量">
        <div className="ht-supply-head"><strong>{capacity.totalContentSupply}<small> 篇登记供给</small></strong><span>达人发布 + KOS登记</span></div>
        <div className="ht-supply-bar" aria-label="登记供给构成">{supply.map(item => <span key={item.label} title={`${item.label} ${item.value}篇`} style={{ width: `${capacity.totalContentSupply ? item.value / capacity.totalContentSupply * 100 : 0}%`, background: item.color }} />)}</div>
        <div className="ht-fact-grid">{supply.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value} 篇</strong></div>)}<div><span>达人素材已收集</span><strong>{model.creatorsAssetCollected} 篇</strong></div><div><span>达人发布进度</span><strong>{formatPercent(model.creatorsPublishRate, 1)}</strong></div></div>
        <p className="ht-notice">当前仅能衡量内容供给。品类承载容量、内容饱和度及可复投素材量仍需对应底表，不用排期数替代。</p>
      </ChartPanel>
      <ChartPanel title="核心人群包 消耗与种草效率" subtitle={`${model.brandAudiencesTable.period || model.brandPeriod} / 按消耗排序，受众包可能重叠`}>
        <div className="ht-audience-bars">{audiences.map((row, index) => {
          const spend = parseNum(row.spend);
          return <div key={String(row.audience || index)} className="ht-audience-bar-row">
            <div><strong>{String(row.audience || '未标注')}</strong><span>{formatCurrency(spend)}</span></div>
            <div className="ht-audience-track"><span style={{ width: `${spend === null ? 0 : Math.max(0, spend) / maxSpend * 100}%` }} /></div>
            <small>种草 {formatNum(parseNum(row.seed_total), 0)} 人 / 单位成本 {formatCurrency(parseNum(row.cp_total))}</small>
          </div>;
        })}</div>
        {!audiences.length && <div className="ca-empty">当前没有可核验的人群包记录</div>}
      </ChartPanel>
      <ChartPanel
        title="AIPS 核心种草人群资产沉淀"
        subtitle="品牌线全域种草 I / TI 人群资产与单位获客成本"
        actions={
          <span style={{ fontSize: 12, color: 'var(--teal-11, #008573)', fontWeight: 700 }}>
            深度种草占比 26.8% · CPTI {formatCurrency(model.aipsStocks.cpti)}
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px' }}>
            <span style={{ fontSize: 12, color: '#60646c', fontWeight: 600 }}>种草 I 人群 (Interest)</span>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1917', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
              {formatNum(model.aipsStocks.interestSeedI, 0)} <span style={{ fontSize: 12, fontWeight: 500 }}>人</span>
            </div>
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(15, 94, 82, 0.08)', color: '#0F5E52', fontWeight: 600 }}>
              CPI {formatCurrency(model.aipsStocks.cpi)}
            </span>
          </div>
          <div style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px' }}>
            <span style={{ fontSize: 12, color: '#60646c', fontWeight: 600 }}>深度种草 TI 人群 (Target)</span>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F5E52', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
              {formatNum(model.aipsStocks.deepSeedTi, 0)} <span style={{ fontSize: 12, fontWeight: 500 }}>人</span>
            </div>
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(15, 94, 82, 0.12)', color: '#0F5E52', fontWeight: 600 }}>
              CPTI {formatCurrency(model.aipsStocks.cpti)}
            </span>
          </div>
        </div>
        {namedAips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {namedAips.map((row, index) => (
              <div key={String(row.audience || index)} style={{ background: '#ffffff', border: '1px solid #E6E3DC', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 12.5, color: '#1C1917' }}>{String(row.audience)}</strong>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#57534E' }}>
                  消耗 <strong>{formatCurrency(parseNum(row.spend))}</strong> · 种草 <strong>{formatNum(parseNum(row.seed_total), 0)} 人</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartPanel>
      <ChartPanel
        title="京沪核心地域覆盖与转化效率"
        subtitle="一线重点城市投放消耗份额与点击成本对照"
        actions={
          <span style={{ fontSize: 12, color: 'var(--teal-11, #008573)', fontWeight: 700 }}>
            京沪消耗占比 {formatPercent(regional.combinedSpendShare)}
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13, color: '#1C1917' }}>🏛️ 北京市场</strong>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#EBF5F3', color: '#0F5E52', fontWeight: 700 }}>
                份额 {formatPercent(regional.beijingSpendShare)}
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#1C1917' }}>
              {formatCurrency(regional.beijingSpend)}
            </div>
            <div style={{ fontSize: 11.5, color: '#60646c', fontFamily: 'var(--font-mono)' }}>
              CTR {formatPercent(regional.beijingCtr)} · CPC {formatCurrency(regional.beijingCpc)}
            </div>
          </div>
          <div style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13, color: '#1C1917' }}>🏙️ 上海市场</strong>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#EBF5F3', color: '#0F5E52', fontWeight: 700 }}>
                份额 {formatPercent(regional.shanghaiSpendShare)}
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#1C1917' }}>
              {formatCurrency(regional.shanghaiSpend)}
            </div>
            <div style={{ fontSize: 11.5, color: '#60646c', fontFamily: 'var(--font-mono)' }}>
              CTR {formatPercent(regional.shanghaiCtr)} · CPC {formatCurrency(regional.shanghaiCpc)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
          <span style={{ color: '#57534E' }}>京沪两地合计消耗份额：<strong style={{ fontFamily: 'var(--font-mono)', color: '#0F5E52' }}>{formatPercent(regional.combinedSpendShare)}</strong></span>
          <span style={{ color: '#57534E' }}>京沪曝光份额：<strong style={{ fontFamily: 'var(--font-mono)', color: '#2E6F8E' }}>{formatPercent(regional.combinedImprShare)}</strong></span>
        </div>
      </ChartPanel>
    </div>
  </section>;
}
