import { env } from 'cloudflare:workers';
import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { logAction } from '@/lib/ops';

export const dynamic='force-dynamic';
const text=(v:unknown)=>String(v??'').trim();
const runtime=()=>env as unknown as Record<string,string|undefined>;
const safeJson=(value:unknown,fallback:string)=>{try{return typeof value==='string'?JSON.stringify(JSON.parse(value)):JSON.stringify(value??JSON.parse(fallback))}catch{throw new Error('JSON 配置格式不正确')}};

const metricSeeds=[
  ['spend','消耗','元','sum','费用,花费,投放消耗,聚光消耗'],['impressions','曝光量','次','sum','曝光,展现'],['clicks','点击量','次','sum','点击'],
  ['ctr','点击率','%','ratio','CTR'],['cpc','点击成本','元','ratio','CPC'],['cpm','千次曝光成本','元','ratio','CPM'],
  ['interactions','互动量','次','sum','互动,赞藏评转'],['cpe','互动成本','元','ratio','CPE'],['reads','阅读量','次','sum','阅读'],
  ['cpr','阅读成本','元','ratio','CPR'],['seed_users','新增种草人数','人','sum','种草人数,新增种草'],['deep_seed_users','深度种草人数','人','sum','深度种草'],
  ['cpuv','种草成本','元','ratio','CPUV'],['gmv','成交金额','元','sum','GMV,成交额'],['roi','投入产出比','','ratio','ROI'],
  ['published_notes','发布笔记数','篇','sum','发布进度,笔记发布'],['positive_comments','正向评论','条','sum','正向口碑'],
  ['negative_comments','负向评论','条','sum','负面评论,负向舆情'],['supplier_visible_rate','供应商外显率','%','ratio','评论外显率']
];

async function seed(project:string){const d1=db(),now=new Date().toISOString();
  const existing=await d1.prepare('SELECT COUNT(*) AS count FROM metric_definitions WHERE project_id=?').bind(project).first<{count:number}>();
  if(!Number(existing?.count||0))await d1.batch(metricSeeds.map(([key,name,unit,aggregation,aliases])=>d1.prepare(`INSERT OR IGNORE INTO metric_definitions(id,project_id,key,name,unit,aggregation,aliases_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`${project}:${key}`,project,key,name,unit,aggregation,JSON.stringify(aliases.split(',')),now,now)));
  
  // Integrations: Keystone, IPSCG, Lingxi, Juguang
  await d1.prepare(`INSERT OR REPLACE INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at) VALUES(?,?,?,?,?,1,?,'连接正常',?,?)`).bind(`${project}:keystone`,project,'keystone','Keystone AI 模型网关','https://keystonehk.ai/v1',JSON.stringify({modelsPath:'/models',chatPath:'/chat/completions',textModel:'gpt-5.6-terra',imageModel:'gpt-image-2',purpose:'意图理解、ReportSpec 生成与生图'}),now,now).run();
  await d1.prepare(`INSERT OR REPLACE INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at) VALUES(?,?,?,?,?,1,?,'连接正常',?,?)`).bind(`${project}:ipscg`,project,'ipscg','IPSCG 素材抓取系统','http://117.78.5.18:8080/ips-api',JSON.stringify({purpose:'小红书关键词笔记抓取、竞品UGC样本、评论抓取',listPath:'/yimei/getKeywordTaskList',resultPath:'/yimei/selectKeywordResults'}),now,now).run();
  await d1.prepare(`INSERT OR REPLACE INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at) VALUES(?,?,?,?,?,1,?,'连接正常',?,?)`).bind(`${project}:lingxi`,project,'lingxi','小红书灵犀平台（白犀计划）','https://idea.xiaohongshu.com',JSON.stringify({purpose:'市场机会（市场供需/潜力）、母婴13细分赛道、品牌与SPU Top30',brand:'白犀计划',brandId:'548104',muyingCode:'2d73b2f6a5584885ac4ca78638b8aab3',status:'免落库实时直连'}),now,now).run();
  await d1.prepare(`INSERT OR REPLACE INTO integrations(id,project_id,provider,name,base_url,enabled,config_json,status,created_at,updated_at) VALUES(?,?,?,?,?,1,?,'连接正常',?,?)`).bind(`${project}:juguang`,project,'juguang','小红书聚光投放平台（代理商易美）','https://partner.xiaohongshu.com',JSON.stringify({purpose:'65个子账户消耗、曝光、点击、CTR、余额及明细',agent:'北京易美',subAccountCount:65,topAdvertiserId:10898747}),now,now).run();

  // Source Accounts
  const accountSeeds = [
    [`${project}:acc:feihe_search`, '10898747', '飞鹤-卓睿日常搜索-易美', 'sub_account', `${project}:juguang`, JSON.stringify({ brand: '飞鹤奶粉', todaySpend: 88839.73, balance: 649204.86, ctr: 0.068 })],
    [`${project}:acc:feihe_qicui`, '9021861', '飞鹤-婴配-启萃-日常-易美-F', 'sub_account', `${project}:juguang`, JSON.stringify({ brand: '飞鹤鲜萃系列', todaySpend: 27462.59, balance: 312681.03, ctr: 0.069 })],
    [`${project}:acc:feihe_grass`, '212963', '飞鹤-卓睿日常种草-易美', 'sub_account', `${project}:juguang`, JSON.stringify({ brand: '飞鹤奶粉', todaySpend: 10762.02, balance: 2613237.14, ctr: 0.113 })],
    [`${project}:acc:bebebus`, '11512520', 'BeBeBus-床品线', 'sub_account', `${project}:juguang`, JSON.stringify({ brand: 'BeBeBus母婴', todaySpend: 14170.17, balance: 105989.41, ctr: 0.085 })],
    [`${project}:acc:lingxi_baixi`, '548104', '小红书灵犀-白犀计划', 'brand_account', `${project}:lingxi`, JSON.stringify({ brand: '白犀计划', industry: '母婴', permissions: '全权限' })],
  ];
  await d1.batch(accountSeeds.map(([id, extId, name, type, intId, meta]) => d1.prepare(`INSERT OR REPLACE INTO source_accounts(id,project_id,integration_id,external_id,name,account_type,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id, project, intId, extId, name, type, '连接正常', meta, now, now)));

  // API Endpoints
  const endpointSeeds=[
    [`${project}:project_metrics`,'project_metrics','项目经营指标','GET','/api/dashboard','内部数据','按项目和时间范围读取发布、评论、内容与处置聚合指标',null],
    [`${project}:juguang_summary`,'juguang_summary','聚光投放消耗与指标汇总','GET','/api/ads/summary','投放数据','按项目聚合聚光 65 个子账户的消耗、曝光、点击、CTR 与余额',`${project}:juguang`],
    [`${project}:juguang_sub_page`,'juguang_sub_page','聚光代理商子账户接口','GET','/api/partner/agent/sub/page','投放接口','代理商后台分页拉取全部 65 个子账户投放明细',`${project}:juguang`],
    [`${project}:lingxi_track_live`,'lingxi_track_live','灵犀母婴大盘机会实时直连','GET','/api/lingxi/track','行业洞察','免落库实时直连母婴 13 大细分赛道供需四象限、品牌与 SPU Top30 排行',`${project}:lingxi`],
    [`${project}:lingxi_market`,'lingxi_market','灵犀市场供需与潜力','POST','/api/idea/trackV2/*','行业洞察','市场供需/市场潜力（母婴类目，白犀计划品牌）；实时按需拉取',`${project}:lingxi`],
    [`${project}:redtrend_search`,'redtrend_search','关键词笔记搜索','POST','/api/solar/content_square/searchNote','内容扫描','按关键词和日期范围发现本品/竞品 UGC 笔记',`${project}:redtrend`],
    [`${project}:redtrend_detail`,'redtrend_detail','笔记详情与封面','GET','/api/solar/note/{noteId}/detail?bizCode=','内容资产','抓取笔记首图并下载到项目 R2 资产库',`${project}:redtrend`],
    [`${project}:redtrend_l1`,'redtrend_l1','笔记主评论','GET','/api/solar/note/{noteId}/l1_comments','评论抓取','分页获取全部主评论',`${project}:redtrend`],
    [`${project}:redtrend_l2`,'redtrend_l2','楼中楼回复','GET','/api/solar/note/{noteId}/l2_comments','评论抓取','按主评论分页获取回复',`${project}:redtrend`],
    [`${project}:keystone_models`,'keystone_models','Keystone 模型能力','GET','/models','AI 网关','探测当前令牌可用模型',`${project}:keystone`],
    [`${project}:keystone_chat`,'keystone_chat','Keystone 文本推理','POST','/chat/completions','AI 网关','生成查询计划和决策摘要，仅输出结构化 JSON',`${project}:keystone`],
    [`${project}:ipscg_tasks`,'ipscg_tasks','IPSCG 抓取任务列表','GET','/yimei/getKeywordTaskList','外部抓取','列出素材系统的小红书关键词抓取任务',`${project}:ipscg`],
    [`${project}:ipscg_results`,'ipscg_results','IPSCG 笔记抓取结果','GET','/yimei/selectKeywordResults','外部抓取','按任务拉取小红书笔记样本（标题/内容/互动/标签）',`${project}:ipscg`],
  ];
  await d1.batch(endpointSeeds.map(([id,key,name,method,path,category,description,integrationId])=>d1.prepare(`INSERT OR REPLACE INTO api_endpoints(id,project_id,integration_id,key,name,method,path,category,description,parameter_schema,response_schema,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'{}','{}',1,?,?)`).bind(id,project,integrationId,key,name,method,path,category,description,now,now)));
  
  const fieldMap:Record<string,string>={
    spend:'ads.totals.spend',
    impressions:'ads.totals.impressions',
    clicks:'ads.totals.clicks',
    ctr:'ads.totals.ctr',
    interactions:'metrics.interactionCount',
    reads:'metrics.readCount',
    published_notes:'metrics.publishedCount',
    positive_comments:'metrics.positiveCount',
    negative_comments:'metrics.negativeCount',
    supplier_visible_rate:'metrics.supplier.visibleRate',
    cpm:'metrics.cpm',
    cpe:'metrics.cpe',
    cpr:'metrics.cpr'
  };
  await d1.batch(Object.entries(fieldMap).map(([key,field])=>d1.prepare(`INSERT OR REPLACE INTO metric_bindings(id,project_id,metric_id,endpoint_id,source_field,dimensions_json,transform_json,created_at,updated_at) VALUES(?,?,?,?,?,'["date","project_id"]','{}',?,?)`).bind(`${project}:binding:${key}`,project,`${project}:${key}`,`${project}:juguang_summary`,field,now,now)));
}

async function keystoneCapability(){
  const r=runtime(),key=r.KEYSTONE_API_KEY||process.env.KEYSTONE_API_KEY,rawBase=r.KEYSTONE_BASE_URL||process.env.KEYSTONE_BASE_URL||'https://keystonehk.ai/v1',base=rawBase.endsWith('/')?rawBase.slice(0,-1):rawBase,textModel=r.KEYSTONE_MODEL||process.env.KEYSTONE_MODEL||'gpt-5.6-terra',imageModel=r.KEYSTONE_IMAGE_MODEL||process.env.KEYSTONE_IMAGE_MODEL||'gpt-image-2';
  if(!key)return {configured:false,status:'未配置密钥',models:[],textModels:[],imageModels:[],textModel,imageModel,baseUrl:base};
  try{const response=await fetch(`${base}/models`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});const payload=await response.json() as {data?:Array<{id:string}>;error?:{message?:string};message?:string};if(!response.ok)throw new Error(payload.error?.message||payload.message||`HTTP ${response.status}`);const models=(payload.data||[]).map(x=>x.id),imageModels=models.filter(x=>/(image|video|sora|seedream|wan)/i.test(x)),textModels=models.filter(x=>!imageModels.includes(x)),textReady=models.includes(textModel),imageReady=models.includes(imageModel);return {configured:true,status:textReady?(imageReady?'文本与生图模型可用':'文本模型可用 · 生图配置已保留'):'指定文本模型不可用',models,textModels,imageModels,textModel,imageModel,baseUrl:base};}catch(error){return {configured:true,status:'连接失败',models:[],textModels:[],imageModels:[],textModel,imageModel,baseUrl:base,error:error instanceof Error?error.message:'连接失败'};}
}

export async function GET(request:Request){if(!(await apiUser()))return jsonError('请先登录',401);await ensureSchema();const project=projectId(new URL(request.url).searchParams.get('projectId'));await seed(project);const d1=db();
  const [accounts,endpoints,metrics,bindings,sources,integrations,runs,reports,assets,capability]=await Promise.all([
    d1.prepare(`SELECT id,project_id AS projectId,integration_id AS integrationId,external_id AS externalId,name,account_type AS accountType,status,metadata_json AS metadataJson,last_synced_at AS lastSyncedAt,last_error AS lastError,updated_at AS updatedAt FROM source_accounts WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,project_id AS projectId,integration_id AS integrationId,key,name,method,path,category,description,parameter_schema AS parameterSchema,response_schema AS responseSchema,enabled,last_tested_at AS lastTestedAt,last_error AS lastError,updated_at AS updatedAt FROM api_endpoints WHERE project_id=? ORDER BY category,name`).bind(project).all(),
    d1.prepare(`SELECT id,key,name,description,unit,aggregation,formula,format,aliases_json AS aliasesJson,updated_at AS updatedAt FROM metric_definitions WHERE project_id=? ORDER BY name`).bind(project).all(),
    d1.prepare(`SELECT b.id,b.metric_id AS metricId,m.name AS metricName,b.endpoint_id AS endpointId,e.name AS endpointName,b.source_id AS sourceId,s.name AS sourceName,b.source_field AS sourceField,b.dimensions_json AS dimensionsJson,b.transform_json AS transformJson,b.updated_at AS updatedAt FROM metric_bindings b LEFT JOIN metric_definitions m ON m.id=b.metric_id LEFT JOIN api_endpoints e ON e.id=b.endpoint_id LEFT JOIN data_sources s ON s.id=b.source_id WHERE b.project_id=? ORDER BY m.name`).bind(project).all(),
    d1.prepare(`SELECT id,name,type,kind,status,last_synced_at AS lastSyncedAt,last_row_count AS lastRowCount FROM data_sources WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,name,provider,base_url AS baseUrl,status,last_tested_at AS lastTestedAt,last_error AS lastError FROM integrations WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all(),
    d1.prepare(`SELECT id,prompt,status,engine,date_start AS dateStart,date_end AS dateEnd,progress,error,created_at AS createdAt,finished_at AS finishedAt FROM agent_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 10`).bind(project).all(),
    d1.prepare(`SELECT id,run_id AS runId,title,period_start AS periodStart,period_end AS periodEnd,status,created_at AS createdAt FROM report_versions WHERE project_id=? ORDER BY created_at DESC LIMIT 12`).bind(project).all(),
    d1.prepare(`SELECT id,file_name AS fileName,content_type AS contentType,size,status,summary_json AS summaryJson,created_at AS createdAt FROM uploaded_assets WHERE project_id=? ORDER BY created_at DESC LIMIT 20`).bind(project).all(),
    keystoneCapability(),
  ]);
  return Response.json({ok:true,accounts:accounts.results,endpoints:endpoints.results,metrics:metrics.results,bindings:bindings.results,sources:sources.results,integrations:integrations.results,runs:runs.results,reports:reports.results,assets:assets.results,keystone:capability});
}

export async function POST(request:Request){const user=await apiUser(true);if(!user)return jsonError('请先登录',401);try{const body=await request.json() as Record<string,unknown>;await ensureSchema();const project=projectId(body.projectId),action=text(body.action),entity=text(body.entity),id=text(body.id)||crypto.randomUUID(),now=new Date().toISOString(),d1=db();
  if(action==='delete'){
    const tables:Record<string,string>={account:'source_accounts',endpoint:'api_endpoints',metric:'metric_definitions',binding:'metric_bindings'};const table=tables[entity];if(!table)return jsonError('不支持的数据地图对象');
    if(entity==='metric')await d1.prepare('DELETE FROM metric_bindings WHERE project_id=? AND metric_id=?').bind(project,id).run();
    await d1.prepare(`DELETE FROM ${table} WHERE id=? AND project_id=?`).bind(id,project).run();await logAction('删除数据地图对象',entity,id,text(body.name),project);return Response.json({ok:true});
  }
  if(action==='probe_keystone'){const result=await keystoneCapability();const status=result.textModels.length?'连接正常':result.configured?'缺少文本模型':'未配置密钥';await d1.prepare(`UPDATE integrations SET status=?,last_tested_at=?,last_error=?,updated_at=? WHERE project_id=? AND provider='keystone'`).bind(status,now,result.error||'',now,project).run();return Response.json({ok:true,...result});}
  if(action!=='save')return jsonError('不支持的操作');
  if(entity==='account')await d1.prepare(`INSERT INTO source_accounts(id,project_id,integration_id,external_id,name,account_type,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET integration_id=excluded.integration_id,external_id=excluded.external_id,name=excluded.name,account_type=excluded.account_type,status=excluded.status,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at`).bind(id,project,text(body.integrationId)||null,text(body.externalId),text(body.name)||'新账户',text(body.accountType)||'sub_account',text(body.status)||'未检测',safeJson(body.metadataJson,'{}'),now,now).run();
  else if(entity==='endpoint')await d1.prepare(`INSERT INTO api_endpoints(id,project_id,integration_id,key,name,method,path,category,description,parameter_schema,response_schema,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET integration_id=excluded.integration_id,key=excluded.key,name=excluded.name,method=excluded.method,path=excluded.path,category=excluded.category,description=excluded.description,parameter_schema=excluded.parameter_schema,response_schema=excluded.response_schema,enabled=excluded.enabled,updated_at=excluded.updated_at`).bind(id,project,text(body.integrationId)||null,text(body.key)||`endpoint_${Date.now()}`,text(body.name)||'新接口',text(body.method)||'GET',text(body.path)||'/',text(body.category)||'数据查询',text(body.description),safeJson(body.parameterSchema,'{}'),safeJson(body.responseSchema,'{}'),body.enabled===false?0:1,now,now).run();
  else if(entity==='metric')await d1.prepare(`INSERT INTO metric_definitions(id,project_id,key,name,description,unit,aggregation,formula,format,aliases_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET key=excluded.key,name=excluded.name,description=excluded.description,unit=excluded.unit,aggregation=excluded.aggregation,formula=excluded.formula,format=excluded.format,aliases_json=excluded.aliases_json,updated_at=excluded.updated_at`).bind(id,project,text(body.key)||`metric_${Date.now()}`,text(body.name)||'新指标',text(body.description),text(body.unit),text(body.aggregation)||'sum',text(body.formula),text(body.format)||'number',safeJson(body.aliasesJson,'[]'),now,now).run();
  else if(entity==='binding')await d1.prepare(`INSERT INTO metric_bindings(id,project_id,metric_id,endpoint_id,source_id,source_field,dimensions_json,transform_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET metric_id=excluded.metric_id,endpoint_id=excluded.endpoint_id,source_id=excluded.source_id,source_field=excluded.source_field,dimensions_json=excluded.dimensions_json,transform_json=excluded.transform_json,updated_at=excluded.updated_at`).bind(id,project,text(body.metricId),text(body.endpointId)||null,text(body.sourceId)||null,text(body.sourceField),safeJson(body.dimensionsJson,'[]'),safeJson(body.transformJson,'{}'),now,now).run();
  else return jsonError('不支持的数据地图对象');
  await logAction(text(body.id)?'更新数据地图对象':'新增数据地图对象',entity,id,text(body.name)||text(body.key),project);return Response.json({ok:true,id});
}catch(error){return jsonError(error instanceof Error?error.message:'数据地图操作失败',500)}}
