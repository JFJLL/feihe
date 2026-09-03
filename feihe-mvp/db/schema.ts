import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), name: text('name').notNull(), spu: text('spu').notNull().default(''),
  brand: text('brand').notNull().default(''), category: text('category').notNull().default(''),
  description: text('description').notNull().default(''), status: text('status').notNull().default('进行中'),
  color: text('color').notNull().default('#1769d5'), startAt: text('start_at'), endAt: text('end_at'),
  createdBy: text('created_by').notNull().default(''), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});

export const projectNotes = sqliteTable('project_notes', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), noteId: text('note_id').notNull(),
  sourceType: text('source_type').notNull().default('scan'), pipeline: text('pipeline').notNull().default('value_scan'),
  level: text('level').notNull().default('P3'), productScope: text('product_scope').notNull().default('本品'),
  status: text('status').notNull().default('待抓取'), lastFetchedAt: text('last_fetched_at'),
  commentTotal: integer('comment_total').notNull().default(0), positiveCount: integer('positive_count').notNull().default(0),
  negativeCount: integer('negative_count').notNull().default(0), questionCount: integer('question_count').notNull().default(0),
  brandMentionTop5: real('brand_mention_top5').notNull().default(0), addedAt: text('added_at').notNull(),
}, (table) => [index('idx_project_notes_project').on(table.projectId), index('idx_project_notes_note').on(table.noteId)]);

export const projectPipelines = sqliteTable('project_pipelines', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), key: text('key').notNull(), name: text('name').notNull(),
  targetCount: integer('target_count').notNull(), deliveredCount: integer('delivered_count').notNull().default(0),
  budget: real('budget').notNull().default(0), spent: real('spent').notNull().default(0),
}, (table) => [index('idx_project_pipelines_project').on(table.projectId)]);

export const projectSettings = sqliteTable('project_settings', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), key: text('key').notNull(),
  value: text('value').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_project_settings_project').on(table.projectId)]);

export const dataSources = sqliteTable('data_sources', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), type: text('type').notNull().default('feishu_sheet'),
  name: text('name').notNull(), spreadsheet: text('spreadsheet').notNull().default(''), sheetId: text('sheet_id').notNull().default(''),
  range: text('range').notNull().default('A1:AZ5000'), kind: text('kind').notNull().default('owned'),
  syncFrequency: text('sync_frequency').notNull().default('manual'), status: text('status').notNull().default('未连接'),
  lastSyncedAt: text('last_synced_at'), lastRowCount: integer('last_row_count').notNull().default(0),
  mappingJson: text('mapping_json').notNull().default('{}'), lastError: text('last_error').notNull().default(''),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_data_sources_project').on(table.projectId)]);

export const integrations = sqliteTable('integrations', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), provider: text('provider').notNull(),
  name: text('name').notNull(), baseUrl: text('base_url').notNull().default(''), enabled: integer('enabled').notNull().default(1),
  configJson: text('config_json').notNull().default('{}'), status: text('status').notNull().default('未检测'),
  lastTestedAt: text('last_tested_at'), lastError: text('last_error').notNull().default(''),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_integrations_project_provider').on(table.projectId, table.provider)]);

export const reviewRules = sqliteTable('review_rules', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), name: text('name').notNull(),
  keywords: text('keywords').notNull().default(''), sentiment: text('sentiment').notNull().default('中立'),
  category: text('category').notNull().default('自定义规则'), action: text('action').notNull().default('保留观察'),
  priority: integer('priority').notNull().default(100), enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_review_rules_project_priority').on(table.projectId, table.priority)]);

export const savedReports = sqliteTable('saved_reports', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), title: text('title').notNull(),
  periodStart: text('period_start'), periodEnd: text('period_end'), status: text('status').notNull().default('草稿'),
  summaryJson: text('summary_json').notNull().default('{}'), createdBy: text('created_by').notNull().default(''),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_saved_reports_project_updated').on(table.projectId, table.updatedAt)]);

export const sourceAccounts = sqliteTable('source_accounts', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), integrationId:text('integration_id'),
  externalId:text('external_id').notNull().default(''), name:text('name').notNull(), accountType:text('account_type').notNull().default('sub_account'),
  status:text('status').notNull().default('未检测'), metadataJson:text('metadata_json').notNull().default('{}'), lastSyncedAt:text('last_synced_at'),
  lastError:text('last_error').notNull().default(''), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
}, (table)=>[index('idx_source_accounts_project').on(table.projectId,table.updatedAt)]);

export const apiEndpoints = sqliteTable('api_endpoints', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), integrationId:text('integration_id'), key:text('key').notNull(),
  name:text('name').notNull(), method:text('method').notNull().default('GET'), path:text('path').notNull(), category:text('category').notNull().default('数据查询'),
  description:text('description').notNull().default(''), parameterSchema:text('parameter_schema').notNull().default('{}'), responseSchema:text('response_schema').notNull().default('{}'),
  enabled:integer('enabled').notNull().default(1), lastTestedAt:text('last_tested_at'), lastError:text('last_error').notNull().default(''),
  createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
}, (table)=>[index('idx_api_endpoints_project_key').on(table.projectId,table.key)]);

export const metricDefinitions = sqliteTable('metric_definitions', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), key:text('key').notNull(), name:text('name').notNull(),
  description:text('description').notNull().default(''), unit:text('unit').notNull().default(''), aggregation:text('aggregation').notNull().default('sum'),
  formula:text('formula').notNull().default(''), format:text('format').notNull().default('number'), aliasesJson:text('aliases_json').notNull().default('[]'),
  createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
}, (table)=>[index('idx_metric_definitions_project_key').on(table.projectId,table.key)]);

export const metricBindings = sqliteTable('metric_bindings', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), metricId:text('metric_id').notNull(), endpointId:text('endpoint_id'), sourceId:text('source_id'),
  sourceField:text('source_field').notNull(), dimensionsJson:text('dimensions_json').notNull().default('[]'), transformJson:text('transform_json').notNull().default('{}'),
  createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
}, (table)=>[index('idx_metric_bindings_project_metric').on(table.projectId,table.metricId)]);

export const uploadedAssets = sqliteTable('uploaded_assets', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), fileName:text('file_name').notNull(), contentType:text('content_type').notNull().default(''),
  size:integer('size').notNull().default(0), r2Key:text('r2_key').notNull(), status:text('status').notNull().default('已上传'),
  summaryJson:text('summary_json').notNull().default('{}'), createdBy:text('created_by').notNull().default(''), createdAt:text('created_at').notNull(),
}, (table)=>[index('idx_uploaded_assets_project_created').on(table.projectId,table.createdAt)]);

export const agentRuns = sqliteTable('agent_runs', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), prompt:text('prompt').notNull(), status:text('status').notNull().default('排队中'),
  engine:text('engine').notNull().default('规则引擎'), dateStart:text('date_start'), dateEnd:text('date_end'), queryPlanJson:text('query_plan_json').notNull().default('{}'),
  reportSpecJson:text('report_spec_json').notNull().default('{}'), progress:integer('progress').notNull().default(0), error:text('error').notNull().default(''),
  createdBy:text('created_by').notNull().default(''), createdAt:text('created_at').notNull(), finishedAt:text('finished_at'),
}, (table)=>[index('idx_agent_runs_project_created').on(table.projectId,table.createdAt)]);

export const agentSteps = sqliteTable('agent_steps', {
  id:integer('id').primaryKey({autoIncrement:true}), runId:text('run_id').notNull(), stepOrder:integer('step_order').notNull(), name:text('name').notNull(),
  status:text('status').notNull().default('待执行'), detail:text('detail').notNull().default(''), startedAt:text('started_at'), finishedAt:text('finished_at'),
}, (table)=>[index('idx_agent_steps_run_order').on(table.runId,table.stepOrder)]);

export const reportVersions = sqliteTable('report_versions', {
  id:text('id').primaryKey(), projectId:text('project_id').notNull(), runId:text('run_id'), title:text('title').notNull(), periodStart:text('period_start'),
  periodEnd:text('period_end'), status:text('status').notNull().default('草稿'), reportSpecJson:text('report_spec_json').notNull().default('{}'),
  html:text('html').notNull().default(''), sourceManifestJson:text('source_manifest_json').notNull().default('{}'), createdBy:text('created_by').notNull().default(''),
  createdAt:text('created_at').notNull(),
}, (table)=>[index('idx_report_versions_project_created').on(table.projectId,table.createdAt)]);

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  url: text('url').notNull().default(''),
  author: text('author').notNull().default(''),
  title: text('title').notNull().default(''),
  sourceType: text('source_type').notNull().default('scan'),
  pipeline: text('pipeline').notNull().default('value_scan'),
  level: text('level').notNull().default('P3'),
  productScope: text('product_scope').notNull().default('本品'),
  publishedAt: text('published_at'),
  lastFetchedAt: text('last_fetched_at'),
  commentTotal: integer('comment_total').notNull().default(0),
  positiveCount: integer('positive_count').notNull().default(0),
  negativeCount: integer('negative_count').notNull().default(0),
  questionCount: integer('question_count').notNull().default(0),
  brandMentionTop5: real('brand_mention_top5').notNull().default(0),
  status: text('status').notNull().default('待抓取'),
}, (table) => [index('idx_notes_pipeline').on(table.pipeline)]);

export const noteProfiles = sqliteTable('note_profiles', {
  noteId: text('note_id').primaryKey(),
  coverUrl: text('cover_url').notNull().default(''),
  content: text('content').notNull().default(''),
  category1: text('category1').notNull().default(''),
  category2: text('category2').notNull().default(''),
  cooperation: integer('cooperation').notNull().default(0),
  promoted: integer('promoted').notNull().default(0),
  noteType: text('note_type').notNull().default(''),
  notePrice: real('note_price').notNull().default(0),
  exposure: integer('exposure').notNull().default(0),
  readCount: integer('read_count').notNull().default(0),
  interactionCount: integer('interaction_count').notNull().default(0),
  likeCount: integer('like_count').notNull().default(0),
  favoriteCount: integer('favorite_count').notNull().default(0),
  shareCount: integer('share_count').notNull().default(0),
  fansCount: integer('fans_count').notNull().default(0),
  creatorLevel: text('creator_level').notNull().default(''),
  picturePrice: real('picture_price').notNull().default(0),
  videoPrice: real('video_price').notNull().default(0),
  province: text('province').notNull().default(''),
  city: text('city').notNull().default(''),
  gender: text('gender').notNull().default(''),
  readMedian: integer('read_median').notNull().default(0),
  interactionMedian: integer('interaction_median').notNull().default(0),
  brand: text('brand').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_note_profiles_brand').on(table.brand)]);

export const noteCovers = sqliteTable('note_covers', {
  id: text('id').primaryKey(),
  noteId: text('note_id').notNull(),
  projectId: text('project_id').notNull(),
  sourceUrl: text('source_url').notNull().default(''),
  r2Key: text('r2_key').notNull().default(''),
  contentType: text('content_type').notNull().default(''),
  status: text('status').notNull().default('待抓取'),
  fetchedAt: text('fetched_at'),
  lastError: text('last_error').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_note_covers_project_status').on(table.projectId, table.status), index('idx_note_covers_project_note').on(table.projectId, table.noteId)]);

export const commentSnapshots = sqliteTable('comment_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().default('qicui'),
  noteId: text('note_id').notNull(),
  capturedAt: text('captured_at').notNull(),
  l1Count: integer('l1_count').notNull(),
  l2Count: integer('l2_count').notNull(),
  totalCount: integer('total_count').notNull(),
  positiveCount: integer('positive_count').notNull(),
  negativeCount: integer('negative_count').notNull(),
  questionCount: integer('question_count').notNull(),
  irrelevantCount: integer('irrelevant_count').notNull(),
}, (table) => [index('idx_snapshots_note_time').on(table.noteId, table.capturedAt)]);

export const keyComments = sqliteTable('key_comments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().default('qicui'),
  noteId: text('note_id').notNull(),
  parentId: text('parent_id'),
  content: text('content').notNull(),
  author: text('author').notNull().default(''),
  createdAt: text('created_at'),
  sentiment: text('sentiment').notNull(),
  category: text('category').notNull(),
  action: text('action').notNull(),
  treatmentStatus: text('treatment_status').notNull().default('待处理'),
  treatmentMethod: text('treatment_method'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  disappearedAt: text('disappeared_at'),
  replyCount: integer('reply_count').notNull().default(0),
}, (table) => [
  index('idx_key_comments_action_status').on(table.action, table.treatmentStatus),
  index('idx_key_comments_note_id').on(table.noteId),
]);

export const supplierComments = sqliteTable('supplier_comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().default('qicui'),
  externalKey: text('external_key').notNull().unique(),
  noteId: text('note_id').notNull(),
  noteUrl: text('note_url').notNull().default(''),
  creator: text('creator').notNull().default(''),
  plannedContent: text('planned_content').notNull(),
  commentFormat: text('comment_format').notNull().default(''),
  visibility: text('visibility').notNull().default('待核验'),
  matchedContent: text('matched_content'),
  verifiedAt: text('verified_at'),
}, (table) => [index('idx_supplier_note_visibility').on(table.noteId, table.visibility)]);

export const pipelines = sqliteTable('pipelines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetCount: integer('target_count').notNull(),
  deliveredCount: integer('delivered_count').notNull().default(0),
  budget: real('budget').notNull().default(0),
  spent: real('spent').notNull().default(0),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().default('qicui'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('运行中'),
  progress: integer('progress').notNull().default(0),
  total: integer('total').notNull().default(0),
  succeeded: integer('succeeded').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  message: text('message').notNull().default(''),
  createdAt: text('created_at').notNull(),
  finishedAt: text('finished_at'),
}, (table) => [index('idx_jobs_created_at').on(table.createdAt)]);

export const actionLogs = sqliteTable('action_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull().default('qicui'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull().default(''),
  targetId: text('target_id').notNull().default(''),
  detail: text('detail').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_action_logs_created_at').on(table.createdAt)]);

export const noteReviewBatches = sqliteTable('note_review_batches', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), dateKey: text('date_key').notNull(), countsJson: text('counts_json').notNull().default('{}'), createdAt: text('created_at').notNull(),
});

export const reviewActionItems = sqliteTable('review_action_items', {
  id: integer('id').primaryKey({autoIncrement:true}), batchId: text('batch_id').notNull(), projectId: text('project_id').notNull(), dateKey: text('date_key').notNull(), link: text('link').notNull().default(''), blogger: text('blogger').notNull().default(''), action: text('action').notNull(), reason: text('reason').notNull().default(''), sampleJson: text('sample_json').notNull().default('[]'), status: text('status').notNull().default(''), createdAt: text('created_at').notNull(),
});
