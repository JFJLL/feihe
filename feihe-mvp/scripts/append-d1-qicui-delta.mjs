#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith('--')) {
      let key = item.slice(2);
      let val = null;
      const eqIdx = key.indexOf('=');
      if (eqIdx !== -1) {
        val = key.slice(eqIdx + 1);
        key = key.slice(0, eqIdx);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        val = argv[++i];
      } else {
        val = 'true';
      }
      flags[key] = val;
    }
  }
  return {
    sourceD1: flags['source-d1'] ? path.resolve(flags['source-d1']) : path.resolve(appRoot, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite'),
    target: flags.target ? path.resolve(flags.target) : path.resolve(appRoot, 'data/local.db'),
    projectId: flags['project-id'] || 'qicui',
    dryRun: flags['dry-run'] === 'true' || flags['dry-run'] === true || (!flags.apply && !flags.execute),
    backup: flags['no-backup'] !== 'true' && flags['no-backup'] !== true,
  };
}

export function computeBusinessDataHash(db, projectId) {
  const hash = crypto.createHash('sha256');
  const checks = [
    { table: 'business_daily_reports', sql: 'SELECT id, business_day, status, fingerprint FROM business_daily_reports WHERE project_id=? ORDER BY id' },
    { table: 'business_captures', sql: 'SELECT id, source_key, fingerprint FROM business_captures WHERE project_id=? ORDER BY id' },
    { table: 'business_source_heads', sql: 'SELECT source_key, capture_id FROM business_source_heads WHERE project_id=? ORDER BY source_key' },
    { table: 'business_comment_deliveries', sql: 'SELECT count(*) as c FROM business_comment_deliveries WHERE project_id=?' },
    { table: 'business_note_archives', sql: 'SELECT count(*) as c FROM business_note_archives WHERE project_id=?' },
    { table: 'competitor_notes', sql: 'SELECT count(*) as c FROM competitor_notes WHERE project_id=?' },
  ];
  for (const c of checks) {
    try {
      const rows = db.prepare(c.sql).all(projectId);
      hash.update(`${c.table}:${JSON.stringify(rows)}`);
    } catch {
      hash.update(`${c.table}:missing`);
    }
  }
  return hash.digest('hex');
}

export function appendD1QicuiDelta(options) {
  const { sourceD1, target, projectId, dryRun, backup } = options;

  if (!fs.existsSync(sourceD1)) {
    throw new Error(`D1 source database does not exist: ${sourceD1}`);
  }
  if (!fs.existsSync(target)) {
    throw new Error(`Target database does not exist: ${target}`);
  }

  console.log(`[D1 APPEND] Project ID: ${projectId}`);
  console.log(`[D1 APPEND] Source D1 (Read-Only): ${sourceD1}`);
  console.log(`[D1 APPEND] Target Main DB:       ${target}`);
  if (dryRun) console.log(`[D1 APPEND] Mode: DRY RUN (Zero disk writes to target; pass --apply to execute)\n`);

  // Step 1: Backup target before any writes if not dryRun
  let backupPath = null;
  if (!dryRun && backup) {
    const timestamp = Math.floor(Date.now() / 1000);
    backupPath = `${target}.backup.${timestamp}`;
    const bDb = new DatabaseSync(target, { readOnly: true });
    bDb.exec(`VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);
    bDb.close();
    console.log(`[D1 APPEND] Target pre-append consistent backup created at: ${backupPath}\n`);
  }

  // Step 2: Open Source strictly readonly, and target (or dryRun replica)
  const d1Db = new DatabaseSync(sourceD1, { readOnly: true });
  let dryRunTmp = null;
  let targetDb;
  if (dryRun) {
    dryRunTmp = path.join(os.tmpdir(), `d1-append-dryrun-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const bDb = new DatabaseSync(target, { readOnly: true });
    bDb.exec(`VACUUM INTO '${dryRunTmp.replace(/\\/g, '/')}'`);
    bDb.close();
    targetDb = new DatabaseSync(dryRunTmp);
  } else {
    targetDb = new DatabaseSync(target);
  }

  try {
    // Compute business hash before append to guarantee zero business drift
    const preBusinessHash = computeBusinessDataHash(targetDb, projectId);

    const stats = {
      dryRun,
      backupPath,
      preBusinessHash,
      postBusinessHash: null,
      tables: {},
      conflicts: [],
    };

    if (!dryRun) {
      targetDb.exec('BEGIN IMMEDIATE;');
    }

    try {
      // Define explicit columns and PK mapping (strictly NO SELECT *)
      const TABLE_DEFINITIONS = [
        {
          table: 'notes',
          pkCols: ['id'],
          cols: [
            'id', 'url', 'author', 'title', 'source_type', 'pipeline', 'level',
            'product_scope', 'published_at', 'last_fetched_at', 'comment_total',
            'positive_count', 'negative_count', 'question_count', 'brand_mention_top5', 'status'
          ],
          sourceQuery: `
            SELECT id, url, author, title, source_type, pipeline, level, product_scope,
                   published_at, last_fetched_at, comment_total, positive_count, negative_count,
                   question_count, brand_mention_top5, status
            FROM notes
            WHERE id IN (SELECT note_id FROM project_notes WHERE project_id = ?)
            ORDER BY id
          `,
          queryParams: [projectId],
        },
        {
          table: 'project_notes',
          pkCols: ['id'],
          cols: [
            'id', 'project_id', 'note_id', 'source_type', 'pipeline', 'level',
            'product_scope', 'status', 'last_fetched_at', 'comment_total',
            'positive_count', 'negative_count', 'question_count', 'brand_mention_top5', 'added_at'
          ],
          sourceQuery: `
            SELECT id, project_id, note_id, source_type, pipeline, level, product_scope,
                   status, last_fetched_at, comment_total, positive_count, negative_count,
                   question_count, brand_mention_top5, added_at
            FROM project_notes
            WHERE project_id = ?
            ORDER BY id
          `,
          queryParams: [projectId],
        },
        {
          table: 'note_profiles',
          pkCols: ['note_id'],
          cols: [
            'note_id', 'cover_url', 'content', 'category1', 'category2', 'cooperation',
            'promoted', 'note_type', 'note_price', 'exposure', 'read_count',
            'interaction_count', 'like_count', 'favorite_count', 'share_count',
            'fans_count', 'creator_level', 'picture_price', 'video_price',
            'province', 'city', 'gender', 'read_median', 'interaction_median',
            'brand', 'updated_at', 'source_metrics_json'
          ],
          sourceQuery: `
            SELECT note_id, cover_url, content, category1, category2, cooperation,
                   promoted, note_type, note_price, exposure, read_count, interaction_count,
                   like_count, favorite_count, share_count, fans_count, creator_level,
                   picture_price, video_price, province, city, gender, read_median,
                   interaction_median, brand, updated_at, source_metrics_json
            FROM note_profiles
            WHERE note_id IN (SELECT note_id FROM project_notes WHERE project_id = ?)
            ORDER BY note_id
          `,
          queryParams: [projectId],
        },
        {
          table: 'note_project_profiles',
          pkCols: ['id'],
          cols: [
            'id', 'project_id', 'note_id', 'cooperation', 'promoted', 'note_type',
            'note_price', 'picture_price', 'video_price', 'category1', 'category2',
            'product_scope', 'brand', 'notes_remarks', 'review_status', 'created_at', 'updated_at'
          ],
          sourceQuery: `
            SELECT id, project_id, note_id, cooperation, promoted, note_type,
                   note_price, picture_price, video_price, category1, category2,
                   product_scope, brand, notes_remarks, review_status, created_at, updated_at
            FROM note_project_profiles
            WHERE project_id = ?
            ORDER BY id
          `,
          queryParams: [projectId],
        },
        {
          table: 'note_covers',
          pkCols: ['id'],
          cols: [
            'id', 'note_id', 'project_id', 'source_url', 'r2_key', 'content_type',
            'status', 'fetched_at', 'last_error', 'updated_at'
          ],
          sourceQuery: `
            SELECT id, note_id, project_id, source_url, r2_key, content_type,
                   status, fetched_at, last_error, updated_at
            FROM note_covers
            WHERE project_id = ? AND source_url != ''
            ORDER BY id
          `,
          queryParams: [projectId],
        },
        {
          table: 'feishu_sheet_snapshots',
          pkCols: ['project_id', 'sheet_id'],
          cols: ['project_id', 'sheet_id', 'payload_json', 'report_json', 'fingerprint'],
          sourceQuery: `
            SELECT project_id, sheet_id, payload_json, report_json, fingerprint
            FROM feishu_sheet_snapshots
            WHERE project_id = ?
            ORDER BY sheet_id
          `,
          queryParams: [projectId],
        },
      ];
      for (const def of TABLE_DEFINITIONS) {
        const sourceRows = d1Db.prepare(def.sourceQuery).all(...def.queryParams);
        const pkWhere = def.pkCols.map(c => `"${c}" = ?`).join(' AND ');
        const checkStmt = targetDb.prepare(`SELECT ${def.cols.map(c => `"${c}"`).join(', ')} FROM "${def.table}" WHERE ${pkWhere}`);
        const colList = def.cols.map(c => `"${c}"`).join(', ');
        const placeholderList = def.cols.map(() => '?').join(', ');
        const insertStmt = targetDb.prepare(`INSERT INTO "${def.table}" (${colList}) VALUES (${placeholderList})`);
        let inserted = 0;
        let unchanged = 0;
        let conflicts = 0;
        for (const sRow of sourceRows) {
          const pkValues = def.pkCols.map(c => sRow[c]);
          const tRow = checkStmt.get(...pkValues);
          if (tRow) {
            const differingCols = [];
            for (const col of def.cols) {
              if (tRow[col] !== sRow[col]) {
                differingCols.push(col);
              }
            }
            if (differingCols.length === 0) {
              unchanged++;
            } else {
              conflicts++;
              stats.conflicts.push({
                table: def.table,
                pk: pkValues.join(':'),
                differingCols,
                action: 'kept_target_preserved',
                reason: 'Target already has record with differing values; target preserved, D1 alternative ignored',
              });
            }
          } else {
            if (!dryRun) {
              const values = def.cols.map(c => sRow[c]);
              insertStmt.run(...values);
            }
            inserted++;
          }
        }
        stats.tables[def.table] = {
          sourceCandidateRows: sourceRows.length,
          inserted,
          unchanged,
          conflicts,
        };
      }
      const postBusinessHash = computeBusinessDataHash(targetDb, projectId);
      stats.postBusinessHash = postBusinessHash;
      if (preBusinessHash !== postBusinessHash) {
        throw new Error(`Business data mutation detected during D1 append! Pre: ${preBusinessHash}, Post: ${postBusinessHash}`);
      }
      stats.unionCounts = {
        notes: targetDb.prepare('SELECT count(*) as c FROM notes').get().c,
        project_notes: targetDb.prepare('SELECT count(*) as c FROM project_notes WHERE project_id=?').get(projectId).c,
        note_profiles: targetDb.prepare('SELECT count(*) as c FROM note_profiles').get().c,
        note_project_profiles: targetDb.prepare('SELECT count(*) as c FROM note_project_profiles WHERE project_id=?').get(projectId).c,
        note_covers: targetDb.prepare('SELECT count(*) as c FROM note_covers WHERE project_id=?').get(projectId).c,
        feishu_sheet_snapshots: targetDb.prepare('SELECT count(*) as c FROM feishu_sheet_snapshots WHERE project_id=?').get(projectId).c,
        business_daily_reports: targetDb.prepare('SELECT count(*) as c FROM business_daily_reports WHERE project_id=?').get(projectId).c,
        business_captures: targetDb.prepare('SELECT count(*) as c FROM business_captures WHERE project_id=?').get(projectId).c,
      };
      const confRep = targetDb.prepare(`SELECT fingerprint FROM business_daily_reports WHERE project_id=? AND status='confirmed'`).get(projectId);
      stats.confirmedFingerprint = confRep?.fingerprint || null;
      stats.confirmedFingerprintMatch = confRep?.fingerprint === 'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e';
      if (!stats.confirmedFingerprintMatch) {
        throw new Error(`Confirmed report fingerprint corrupted during append!`);
      }
      if (!dryRun) {
        targetDb.exec('COMMIT;');
      }
    } catch (err) {
      if (!dryRun) {
        try { targetDb.exec('ROLLBACK;'); } catch {}
      }
      throw err;
    }
    return stats;
  } finally {
    d1Db.close();
    targetDb.close();
    if (dryRunTmp && fs.existsSync(dryRunTmp)) {
      try { fs.unlinkSync(dryRunTmp); } catch {}
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const args = parseArgs();
    const result = appendD1QicuiDelta(args);
    console.log('=== D1 APPEND SUMMARY ===');
    for (const [t, s] of Object.entries(result.tables)) {
      console.log(`- ${t.padEnd(25)} source=${String(s.sourceCandidateRows).padStart(5)}  inserted=${String(s.inserted).padStart(5)}  unchanged=${String(s.unchanged).padStart(5)}  conflicts=${String(s.conflicts).padStart(3)}`);
    }
    if (result.conflicts.length > 0) {
      console.log(`\n=== CONFLICT RESOLUTION (Preserved Target) ===`);
      for (const c of result.conflicts.slice(0, 10)) {
        console.log(`- [${c.table}:${c.pk}] differing: [${c.differingCols.join(', ')}] -> ${c.reason}`);
      }
      if (result.conflicts.length > 10) console.log(`  ... and ${result.conflicts.length - 10} more conflicts recorded.`);
    }
    console.log(`\n=== FINAL UNION COUNTS ===`);
    for (const [k, v] of Object.entries(result.unionCounts)) {
      console.log(`- ${k.padEnd(25)}: ${v}`);
    }
    console.log(`- Confirmed Report Verified: ${result.confirmedFingerprintMatch} (FP: ${result.confirmedFingerprint?.slice(0, 16)}...)`);
    console.log(`- Business Data Hash Match:  ${result.preBusinessHash === result.postBusinessHash} (${result.preBusinessHash.slice(0, 16)}...)`);
    console.log(`\n[D1 APPEND SUCCESS] Operation completed successfully.`);
  } catch (err) {
    console.error(`\n[D1 APPEND ERROR] ${err.message}`);
    process.exit(1);
  }
}
