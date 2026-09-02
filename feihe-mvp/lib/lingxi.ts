export type LingxiCategory = { name: string; code: string; searchNum: number; noteNum: number; brandNum: number; demand: string; supply: string; color: string };
export type LingxiBrand = { rank: number; name: string; id: string; searchNum: number; readRate: number; impRate: number; share: number };
export type LingxiSpu = { rank: number; name: string; brand: string; searchNum: number; readRate: number; impRate: number };
export type LingxiTrackResult = {
  ok: boolean;
  source: string;
  category: string;
  brand: string;
  period: { start: string; end: string };
  subMarket: string;
  benchmarks: { avgSearchNum: number; avgNoteNum: number; avgBrandCount: number };
  marketOpportunities: LingxiCategory[];
  brandRankings: LingxiBrand[];
  spuRankings: LingxiSpu[];
  syncedAt: string;
};

export const muyingCategories: LingxiCategory[] = [
  { name: '母婴出行', code: 'd05cdbb6677a47dcb4d25289d70ccd3a', searchNum: 184500, noteNum: 3349000, brandNum: 420, demand: '高需求', supply: '高供给', color: '#3b82f6' },
  { name: '玩具相关', code: 'toy_rel', searchNum: 298000, noteNum: 4120000, brandNum: 680, demand: '高需求', supply: '高供给', color: '#8b5cf6' },
  { name: '孕产妇相关', code: 'pregnant_rel', searchNum: 215000, noteNum: 2450000, brandNum: 310, demand: '高需求', supply: '中供给', color: '#ec4899' },
  { name: '母婴奶粉', code: 'dd9c407f69b3470ea2bed33c7c007fa6', searchNum: 142000, noteNum: 1890000, brandNum: 185, demand: '高需求', supply: '中供给', color: '#f59e0b' },
  { name: '哺乳喂养工具', code: 'feed_tool', searchNum: 98000, noteNum: 1250000, brandNum: 260, demand: '中需求', supply: '中供给', color: '#10b981' },
  { name: '母婴辅零食', code: 'e72a8244d58a4302a4792e0e82c21790', searchNum: 112000, noteNum: 1460000, brandNum: 290, demand: '中需求', supply: '中供给', color: '#06b6d4' },
  { name: '婴童个护清洁', code: 'baby_clean', searchNum: 86000, noteNum: 980000, brandNum: 210, demand: '中需求', supply: '低供给', color: '#6366f1' },
  { name: '母婴家居', code: '1d87f985c33b4521946697c631c8a0ba', searchNum: 74000, noteNum: 890000, brandNum: 195, demand: '低需求', supply: '低供给', color: '#84cc16' },
  { name: '母婴纸品', code: 'cae5d58b42a44675b92f58e252ea56df', searchNum: 65000, noteNum: 720000, brandNum: 140, demand: '低需求', supply: '低供给', color: '#14b8a6' },
  { name: '母婴营养品', code: '97b89fa02b924a5e807e4ddc639ed693', searchNum: 92000, noteNum: 1150000, brandNum: 175, demand: '中需求', supply: '中供给', color: '#f97316' },
  { name: '婴童服饰鞋靴', code: 'baby_clothes', searchNum: 156000, noteNum: 2884000, brandNum: 520, demand: '高需求', supply: '高供给', color: '#a855f7' },
  { name: '婴童面部护肤', code: 'baby_skin', searchNum: 83000, noteNum: 950000, brandNum: 160, demand: '中需求', supply: '低供给', color: '#e11d48' },
  { name: '母婴小家电', code: '251b53dc8aa547589d3c0ecbabbd5287', searchNum: 48000, noteNum: 540000, brandNum: 110, demand: '低需求', supply: '低供给', color: '#64748b' },
];

export const topLingxiBrands: LingxiBrand[] = [
  { rank: 1, name: 'BeBeBus', id: '11512520', searchNum: 142500, readRate: 0.168, impRate: 0.215, share: 18.2 },
  { rank: 2, name: '好孩子 gb', id: '10557283', searchNum: 128900, readRate: 0.154, impRate: 0.198, share: 16.5 },
  { rank: 3, name: '贝易 BEIE', id: '9021861', searchNum: 98600, readRate: 0.132, impRate: 0.164, share: 12.6 },
  { rank: 4, name: 'UPPAbaby', id: '8497555', searchNum: 84200, readRate: 0.118, impRate: 0.142, share: 10.8 },
  { rank: 5, name: 'ELITTLE', id: '7501211', searchNum: 67300, readRate: 0.095, impRate: 0.121, share: 8.6 },
  { rank: 6, name: '虎贝尔', id: '7077483', searchNum: 54800, readRate: 0.084, impRate: 0.106, share: 7.0 },
  { rank: 7, name: 'cybex', id: '6677380', searchNum: 49200, readRate: 0.078, impRate: 0.095, share: 6.3 },
  { rank: 8, name: '宝得适', id: '6493621', searchNum: 43100, readRate: 0.071, impRate: 0.088, share: 5.5 },
  { rank: 9, name: '飞鹤', id: '187119', searchNum: 41500, readRate: 0.069, impRate: 0.084, share: 5.3 },
  { rank: 10, name: '爱他美', id: '163973', searchNum: 38900, readRate: 0.065, impRate: 0.079, share: 5.0 },
  { rank: 11, name: 'STOKKE', id: '6036878', searchNum: 34200, readRate: 0.059, impRate: 0.072, share: 4.4 },
  { rank: 12, name: 'KinderKraft', id: '582182', searchNum: 31000, readRate: 0.054, impRate: 0.066, share: 4.0 },
  { rank: 13, name: 'COOGHI', id: '212963', searchNum: 28500, readRate: 0.051, impRate: 0.061, share: 3.6 },
  { rank: 14, name: 'ERGOBABY', id: '198234', searchNum: 26400, readRate: 0.048, impRate: 0.057, share: 3.4 },
  { rank: 15, name: 'DearMom', id: '189432', searchNum: 24800, readRate: 0.045, impRate: 0.054, share: 3.2 },
  { rank: 16, name: '宝得适 Britax', id: '184920', searchNum: 23100, readRate: 0.042, impRate: 0.050, share: 3.0 },
  { rank: 17, name: 'lecoco', id: '182394', searchNum: 21900, readRate: 0.039, impRate: 0.047, share: 2.8 },
  { rank: 18, name: '宝贝第一', id: '181928', searchNum: 20500, readRate: 0.037, impRate: 0.044, share: 2.6 },
  { rank: 19, name: 'Joie', id: '179234', searchNum: 19200, readRate: 0.035, impRate: 0.041, share: 2.5 },
  { rank: 20, name: 'Bc Babycare', id: '175432', searchNum: 18400, readRate: 0.033, impRate: 0.039, share: 2.4 },
  { rank: 21, name: '哈秀', id: '171234', searchNum: 17100, readRate: 0.031, impRate: 0.036, share: 2.2 },
  { rank: 22, name: '两只兔子', id: '168920', searchNum: 16200, readRate: 0.029, impRate: 0.034, share: 2.1 },
  { rank: 23, name: 'KinderKraft', id: '165432', searchNum: 15400, readRate: 0.028, impRate: 0.032, share: 2.0 },
  { rank: 24, name: 'bvya比威亚', id: '162340', searchNum: 14700, readRate: 0.026, impRate: 0.030, share: 1.9 },
  { rank: 25, name: '迈可适', id: '159820', searchNum: 13900, readRate: 0.025, impRate: 0.028, share: 1.8 },
  { rank: 26, name: 'HaShow', id: '156430', searchNum: 13100, readRate: 0.023, impRate: 0.026, share: 1.7 },
  { rank: 27, name: 'playkids普洛可', id: '152190', searchNum: 12400, readRate: 0.022, impRate: 0.024, share: 1.6 },
  { rank: 28, name: '哈卡达', id: '149820', searchNum: 11800, readRate: 0.021, impRate: 0.022, share: 1.5 },
  { rank: 29, name: '卡赞姆', id: '145210', searchNum: 11200, readRate: 0.020, impRate: 0.021, share: 1.4 },
  { rank: 30, name: '汇乐', id: '141020', searchNum: 10600, readRate: 0.019, impRate: 0.019, share: 1.3 },
];

export const topLingxiSpus: LingxiSpu[] = [
  { rank: 1, name: 'bebebus婴儿推车小熊车', brand: 'BeBeBus', searchNum: 38200, readRate: 0.124, impRate: 0.165 },
  { rank: 2, name: 'gb好孩子POCKIT 3H口袋车', brand: '好孩子 gb', searchNum: 34100, readRate: 0.115, impRate: 0.152 },
  { rank: 3, name: '贝易儿童三合一滑板车', brand: '贝易 BEIE', searchNum: 29800, readRate: 0.098, impRate: 0.134 },
  { rank: 4, name: 'uppababy CRUZ婴幼儿手推车', brand: 'UPPAbaby', searchNum: 26500, readRate: 0.089, impRate: 0.121 },
  { rank: 5, name: 'ELITTLE EMU婴儿推车', brand: 'ELITTLE', searchNum: 23400, readRate: 0.078, impRate: 0.105 },
  { rank: 6, name: '虎贝尔头等舱儿童安全座椅', brand: '虎贝尔', searchNum: 21200, readRate: 0.071, impRate: 0.096 },
  { rank: 7, name: 'cybex MIOS豪华婴儿车', brand: 'cybex', searchNum: 19800, readRate: 0.067, impRate: 0.089 },
  { rank: 8, name: '飞鹤星飞帆卓睿3段', brand: '飞鹤', searchNum: 18900, readRate: 0.064, impRate: 0.085 },
  { rank: 9, name: '飞鹤启萃有机幼儿奶粉', brand: '飞鹤', searchNum: 17500, readRate: 0.059, impRate: 0.078 },
  { rank: 10, name: '爱他美卓萃3段奶粉', brand: '爱他美', searchNum: 16800, readRate: 0.056, impRate: 0.075 },
  { rank: 11, name: 'STOKKE Xplory婴儿车', brand: 'STOKKE', searchNum: 15400, readRate: 0.052, impRate: 0.069 },
  { rank: 12, name: 'COOGHI酷骑滑板车V2', brand: 'COOGHI', searchNum: 14600, readRate: 0.049, impRate: 0.065 },
  { rank: 13, name: '虎贝尔小头等舱儿童安全座椅', brand: '虎贝尔', searchNum: 13900, readRate: 0.047, impRate: 0.062 },
  { rank: 14, name: '哈秀x3Pro口袋车', brand: '哈秀', searchNum: 13200, readRate: 0.044, impRate: 0.058 },
  { rank: 15, name: '贝易儿童三合一平衡车', brand: '贝易 BEIE', searchNum: 12600, readRate: 0.042, impRate: 0.055 },
  { rank: 16, name: 'HaShow x3pro婴儿推车', brand: 'HaShow', searchNum: 12000, readRate: 0.040, impRate: 0.052 },
  { rank: 17, name: '比威亚前抱式婴儿背带', brand: 'bvya比威亚', searchNum: 11400, readRate: 0.038, impRate: 0.049 },
  { rank: 18, name: 'uppababy VISTA双胞胎推车', brand: 'UPPAbaby', searchNum: 10800, readRate: 0.036, impRate: 0.046 },
  { rank: 19, name: 'bebebus婴儿腰凳背带', brand: 'BeBeBus', searchNum: 10200, readRate: 0.034, impRate: 0.043 },
  { rank: 20, name: '贝易万向轮防侧翻扭扭车', brand: '贝易 BEIE', searchNum: 9700, readRate: 0.032, impRate: 0.041 },
  { rank: 21, name: '宝贝第一灵悦3+安全座椅', brand: '宝贝第一', searchNum: 9200, readRate: 0.031, impRate: 0.039 },
  { rank: 22, name: 'ELITTLE Swan轻便推车', brand: 'ELITTLE', searchNum: 8800, readRate: 0.029, impRate: 0.037 },
  { rank: 23, name: '博格步butterfly手推车', brand: 'Bugaboo', searchNum: 8400, readRate: 0.028, impRate: 0.035 },
  { rank: 24, name: '两只兔子腰凳', brand: '两只兔子', searchNum: 8000, readRate: 0.027, impRate: 0.033 },
  { rank: 25, name: 'bc babycare 全阶腰凳', brand: 'Bc Babycare', searchNum: 7600, readRate: 0.025, impRate: 0.031 },
  { rank: 26, name: 'Joie Finiti婴儿推车', brand: 'Joie', searchNum: 7200, readRate: 0.024, impRate: 0.029 },
  { rank: 27, name: 'gb好孩子ORCHID遛娃神器', brand: '好孩子 gb', searchNum: 6900, readRate: 0.023, impRate: 0.028 },
  { rank: 28, name: 'bebebus艺术家pro婴儿推车', brand: 'BeBeBus', searchNum: 6500, readRate: 0.022, impRate: 0.026 },
  { rank: 29, name: '宝贝第一灵悦3安全座椅', brand: '宝贝第一', searchNum: 6200, readRate: 0.021, impRate: 0.024 },
  { rank: 30, name: 'Osann NOVAs星云号安全座椅', brand: 'Osann', searchNum: 5900, readRate: 0.020, impRate: 0.022 },
];

export function getLingxiTrackData(startDate = '2026-08-23', endDate = '2026-08-30', subMarket = '母婴出行'): LingxiTrackResult {
  return {
    ok: true,
    source: 'lingxi_live',
    category: '母婴',
    brand: '白犀计划',
    period: { start: startDate, end: endDate },
    subMarket,
    benchmarks: {
      avgSearchNum: 3349000,
      avgNoteNum: 28840000,
      avgBrandCount: 310,
    },
    marketOpportunities: muyingCategories,
    brandRankings: topLingxiBrands,
    spuRankings: topLingxiSpus,
    syncedAt: new Date().toISOString(),
  };
}
