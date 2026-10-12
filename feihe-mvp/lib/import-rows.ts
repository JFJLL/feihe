import { db, ensureSchema } from './db';
import { noteIdFrom } from './store';
import { projectId } from './projects';
import { validBrand } from './brand-validation';
import { saveDataset } from './datasets';

export type ImportKind = 'owned' | 'supplier' | 'dataset' | 'general';
export type ImportRow = Record<string, unknown>;
const value = (row: ImportRow, names: string[]) => { for (const name of names) if (row[name] != null) return String(row[name]); return ''; };
const number = (row: ImportRow, names: string[]) => { const result = Number(value(row, names).replace(/[,￥¥%]/g, '')); return Number.isFinite(result) ? result : 0; };

export async function importRows(
  kind: ImportKind,
  input: ImportRow[],
  replaceSupplier = true,
  project = '',
  sourceId = 'default_supplier',
  sourceName = '通用业务数据'
) {
  const rows = input;
  await ensureSchema();
  const d1 = db();
  const currentProject = projectId(project, false);
  if (!currentProject) throw new Error('缺少项目 ID (projectId 必填)');

  if (kind === 'dataset' || kind === 'general') {
    const dataset = await saveDataset(currentProject, sourceId, sourceName, rows);
    return { imported: dataset.rowCount, skipped: 0, total: rows.length };
  }

  let imported = 0;
  let skipped = 0;
  const statements: Array<{ run(): Promise<unknown> }> = [];

  for (const [index, row] of rows.entries()) {
    if (kind === 'owned') {
      const rawId = value(row, ['笔记ID', '笔记id', '笔记Id', 'ID', '笔记链接']);
      const id = noteIdFrom(rawId || value(row, ['笔记链接']));
      if (!/^[0-9a-f]{24}$/i.test(id)) { skipped += 1; continue; }

      // Public shared note facts
      statements.push(d1.prepare(`INSERT INTO notes(id,url,author,title,source_type,pipeline,level,product_scope,published_at,status)
        VALUES(?,?,?,?,'owned','commercial','P3','本品',?,'待抓取') ON CONFLICT(id) DO UPDATE SET
        url=CASE WHEN excluded.url!='' THEN excluded.url ELSE notes.url END,author=CASE WHEN excluded.author!='' THEN excluded.author ELSE notes.author END,title=CASE WHEN excluded.title!='' THEN excluded.title ELSE notes.title END,published_at=COALESCE(excluded.published_at,notes.published_at),source_type='owned'`)
        .bind(id, value(row, ['笔记链接', '链接']), value(row, ['博主昵称', '达人昵称', '昵称']), value(row, ['标题', '笔记标题']), value(row, ['发布时间\n（按时间排序！！！！）', '发布时间']) || null));

      statements.push(d1.prepare(`INSERT INTO project_notes(id,project_id,note_id,source_type,pipeline,level,product_scope,status,added_at)
        VALUES(?,?,?,'owned','commercial','P3','本品','待抓取',?) ON CONFLICT(id) DO UPDATE SET source_type='owned'`)
        .bind(`${currentProject}:${id}`, currentProject, id, new Date().toISOString()));

      // Project-isolated private profile attributes
      statements.push(d1.prepare(`INSERT INTO note_project_profiles(
        id, project_id, note_id, category1, category2, cooperation, promoted, note_type, note_price, picture_price, video_price, product_scope, brand, updated_at, created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        category1=excluded.category1, category2=excluded.category2, cooperation=excluded.cooperation, promoted=excluded.promoted, note_type=excluded.note_type, note_price=excluded.note_price, picture_price=excluded.picture_price, video_price=excluded.video_price, brand=excluded.brand, updated_at=excluded.updated_at`)
        .bind(`${currentProject}:${id}`, currentProject, id, value(row,['一级分类','一级场景']), value(row,['二级分类','二级场景']), /^(1|是|true)$/i.test(value(row,['合作笔记','是否合作']))?1:0, /^(1|是|true)$/i.test(value(row,['是否投流','投流']))?1:0, value(row,['笔记类型','内容形式']), number(row,['笔记价格','达人总费用']), number(row,['图文价格']), number(row,['视频价格']), '本品', validBrand(value(row,['品牌','产品'])), new Date().toISOString(), new Date().toISOString()));

      // Legacy table compatibility
      statements.push(d1.prepare(`INSERT INTO note_profiles(note_id,cover_url,content,category1,category2,cooperation,promoted,note_type,note_price,exposure,read_count,interaction_count,like_count,favorite_count,share_count,fans_count,creator_level,picture_price,video_price,province,city,gender,read_median,interaction_median,brand,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET
        category1=excluded.category1,category2=excluded.category2,cooperation=excluded.cooperation,promoted=excluded.promoted,note_type=excluded.note_type,note_price=excluded.note_price,exposure=excluded.exposure,read_count=excluded.read_count,interaction_count=excluded.interaction_count,like_count=excluded.like_count,favorite_count=excluded.favorite_count,share_count=excluded.share_count,fans_count=excluded.fans_count,creator_level=excluded.creator_level,picture_price=excluded.picture_price,video_price=excluded.video_price,province=excluded.province,city=excluded.city,gender=excluded.gender,read_median=excluded.read_median,interaction_median=excluded.interaction_median,brand=COALESCE(NULLIF(excluded.brand,''),note_profiles.brand),updated_at=excluded.updated_at`)
        .bind(id,value(row,['封面','封面链接']),value(row,['正文','笔记正文','内容']),value(row,['一级分类','一级场景']),value(row,['二级分类','二级场景']),/^(1|是|true)$/i.test(value(row,['合作笔记','是否合作']))?1:0,/^(1|是|true)$/i.test(value(row,['是否投流','投流']))?1:0,value(row,['笔记类型','内容形式']),number(row,['笔记价格','达人总费用']),number(row,['曝光']),number(row,['阅读']),number(row,['互动']),number(row,['点赞']),number(row,['收藏']),number(row,['分享']),number(row,['粉丝数','达人粉丝数']),value(row,['量级','达人层级']),number(row,['图文价格']),number(row,['视频价格']),value(row,['省份','省']),value(row,['城市','市']),value(row,['性别']),number(row,['阅读中位数']),number(row,['互动中位数']),validBrand(value(row,['品牌','产品'])),new Date().toISOString()));
    } else if (kind === 'supplier') {
      const url = value(row, ['笔记链接', '链接']);
      const id = noteIdFrom(url || value(row, ['笔记ID', '笔记id']));
      const content = value(row, ['评论话术', '评论内容', '话术']);
      if (!/^[0-9a-f]{24}$/i.test(id) || !content) { skipped += 1; continue; }
      const externalKey = `${currentProject}:${sourceId}:${id}:${value(row, ['序号']) || index + 1}:${content.slice(0, 32)}`;
      const visibility = value(row, ['内部审核', '外显状态']) || '待核验';
      statements.push(d1.prepare(`INSERT INTO supplier_comments(project_id,source_id,external_key,note_id,note_url,creator,planned_content,comment_format,visibility)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(external_key) DO UPDATE SET note_url=excluded.note_url,creator=excluded.creator,planned_content=excluded.planned_content,comment_format=excluded.comment_format,visibility=excluded.visibility`)
        .bind(currentProject, sourceId, externalKey, id, url, value(row,['博主昵称','昵称']), content, value(row,['评论形式','形式']), visibility));
    }
    imported += 1;
  }

  if (kind === 'supplier' && replaceSupplier) {
    if (imported === 0) {
      return { imported: 0, skipped: rows.length };
    }
    // Only delete records for this specific project AND this specific sourceId!
    statements.unshift(d1.prepare('DELETE FROM supplier_comments WHERE project_id=? AND source_id=?').bind(currentProject, sourceId));
  }

  if (statements.length > 0) {
    try {
            for (let i = 0; i < statements.length; i += 80) {
        await d1.batch(statements.slice(i, i + 80));
      }
          } catch (error) {
            throw error;
    }
  }

  return { imported, skipped, total: rows.length };
}
