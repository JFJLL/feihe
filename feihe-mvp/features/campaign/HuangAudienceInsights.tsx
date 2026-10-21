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
    { label: '达人已发布', value: model.creatorsPublished, color: '#2c7168' },
    { label: 'KOS登记笔记', value: model.kosCount, color: '#8273a3' },
  ];
  return <section className="ht-layer" aria-label="内容容量与核心人群">
    <div className="ht-layer-header">
      <h3 className="ht-layer-title">内容供给与核心人群</h3>
      <span className="ht-layer-sub">先看可用内容，再看人群质量与京沪覆盖</span>
    </div>
    <div className="ht-grid-2">
      <ChartPanel title="内容容量 · 当前物料供给" subtitle="达人执行表与KOS登记表；登记量不等于可复投素材量">
        <div className="ht-supply-head"><strong>{capacity.totalContentSupply}<small> 篇登记供给</small></strong><span>达人发布 + KOS登记</span></div>
        <div className="ht-supply-bar" aria-label="登记供给构成">{supply.map(item => <span key={item.label} title={`${item.label} ${item.value}篇`} style={{ width: `${capacity.totalContentSupply ? item.value / capacity.totalContentSupply * 100 : 0}%`, background: item.color }} />)}</div>
        <div className="ht-fact-grid">{supply.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value} 篇</strong></div>)}<div><span>达人素材已收集</span><strong>{model.creatorsAssetCollected} 篇</strong></div><div><span>达人发布进度</span><strong>{formatPercent(model.creatorsPublishRate, 1)}</strong></div></div>
        <p className="ht-notice">当前仅能衡量内容供给。品类承载容量、内容饱和度及可复投素材量仍需对应底表，不用排期数替代。</p>
      </ChartPanel>
      <ChartPanel title="核心人群包 · 消耗与种草效率" subtitle={`${model.brandAudiencesTable.period || model.brandPeriod} · 按消耗排序，受众包可能重叠`}>
        <div className="ht-audience-bars">{audiences.map((row, index) => {
          const spend = parseNum(row.spend);
          return <div key={String(row.audience || index)} className="ht-audience-bar-row">
            <div><strong>{String(row.audience || '未标注')}</strong><span>{formatCurrency(spend)}</span></div>
            <div className="ht-audience-track"><span style={{ width: `${spend === null ? 0 : Math.max(0, spend) / maxSpend * 100}%` }} /></div>
            <small>种草 {formatNum(parseNum(row.seed_total), 0)} 人 · 单位成本 {formatCurrency(parseNum(row.cp_total))}</small>
          </div>;
        })}</div>
        {!audiences.length && <div className="ca-empty">当前没有可核验的人群包记录</div>}
      </ChartPanel>
      <ChartPanel title="AIPS 流转 · 已有数据与缺口" subtitle="品牌线原表提供种草 I / TI 指标，不能据此重建 AIPS 全链路">
        <div className="ht-fact-grid ht-fact-grid-large">
          <div><span>种草 I 人群</span><strong>{formatNum(model.aipsStocks.interestSeedI, 0)}<small> 人</small></strong><span>CPI {formatCurrency(model.aipsStocks.cpi)}</span></div>
          <div><span>深度种草 TI 人群</span><strong>{formatNum(model.aipsStocks.deepSeedTi, 0)}<small> 人</small></strong><span>CPTI {formatCurrency(model.aipsStocks.cpti)}</span></div>
        </div>
        {namedAips.length > 0 && <div className="ht-aips-packages">{namedAips.map((row, index) => <div key={String(row.audience || index)}><strong>{String(row.audience)}</strong><span>消耗 {formatCurrency(parseNum(row.spend))} · 种草 {formatNum(parseNum(row.seed_total), 0)} 人</span></div>)}<small>这是原表命名的人群包投放表现，不是阶段流转人数。</small></div>}
        <div className="ht-data-gap"><strong>阶段流转率：待补同口径数据</strong><p>需要各阶段去重人数、同一人群的前后期迁移数及统计日期。曝光与播放是行为次数，不作为 A/P 人群人数；TI 也不等于购买人数。</p></div>
        <small className="ca-scale-note">来源：品牌线汇总表。现有指标保留原表定义，不将独立指标相除生成流转率。</small>
      </ChartPanel>
      <ChartPanel title="京沪流量 · 地域覆盖与点击效率" subtitle="省份投放表；地域流量不等于京沪目标人群包命中量">
        <div className="ht-table-wrap"><table className="ht-table ht-precision-table"><thead><tr><th>地域</th><th>消耗</th><th>消耗份额</th><th>CTR</th><th>CPC</th></tr></thead><tbody>
          <tr><th>北京</th><td>{formatCurrency(regional.beijingSpend)}</td><td>{formatPercent(regional.beijingSpendShare)}</td><td>{formatPercent(regional.beijingCtr)}</td><td>{formatCurrency(regional.beijingCpc)}</td></tr>
          <tr><th>上海</th><td>{formatCurrency(regional.shanghaiSpend)}</td><td>{formatPercent(regional.shanghaiSpendShare)}</td><td>{formatPercent(regional.shanghaiCtr)}</td><td>{formatCurrency(regional.shanghaiCpc)}</td></tr>
        </tbody></table></div>
        <div className="ht-fact-grid"><div><span>京沪消耗份额</span><strong>{formatPercent(regional.combinedSpendShare)}</strong></div><div><span>京沪曝光份额</span><strong>{formatPercent(regional.combinedImprShare)}</strong></div></div>
        <div className="ht-data-gap"><strong>人群包渗透率 / 流量精准率：待补</strong><p>渗透率需“包内去重触达人数 ÷ 人群包规模”；精准率需“命中目标包的去重人数 ÷ 全部去重触达人数”。当前地域表没有这些分子和分母。</p></div>
      </ChartPanel>
    </div>
  </section>;
}
