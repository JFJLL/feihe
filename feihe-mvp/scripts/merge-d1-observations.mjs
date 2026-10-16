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

export function computeProtectedDataHash(db, projectId) {
  const hash = crypto.createHash('sha256');
  const checks = [
    // 1. note_profiles manual & commercial protected columns
    {
      name: 'note_profiles_manual',
      sql: `SELECT note_id, content, category1, category2, cooperation, promoted, note_type,
                   note_price, picture_price, video_price, province, city, gender, creator_level, brand
            FROM note_profiles
            WHERE note_id IN (SELECT note_id FROM project_notes WHERE project_id=?)
            ORDER BY note_id`
    },
    // 2. notes operational & manual protected columns
    {
      name: 'notes_protected',
      sql: `SELECT id, status, pipeline, level, title, source_type, product_scope
            FROM notes
            WHERE id IN (SELECT note_id FROM project_notes WHERE project_id=?)
            ORDER BY id`
    },
    // 3. note_project_profiles full protected columns
    {
      name: 'note_project_profiles_protected',
      sql: `SELECT id, project_id, note_id, cooperation, promoted, note_type, note_price,
                   picture_price, video_price, category1, category2, product_scope, brand,
                   notes_remarks, review_status
            FROM note_project_profiles
            WHERE project_id=?
            ORDER BY id`
    },
    // 4. business daily reports & captures
    {
      name: 'business_daily_reports',
      sql: `SELECT id, business_day, status, confirmed_by, fingerprint FROM business_daily_reports WHERE project_id=? ORDER BY id`
    },
    {
      name: 'business_captures',
      sql: `SELECT id, source_key, fingerprint FROM business_captures WHERE project_id=? ORDER BY id`
    },
    {
      name: 'business_comment_deliveries',
      sql: `SELECT count(*) as c FROM business_comment_deliveries WHERE project_id=?`
    },
  ];

  for (const c of checks) {
    try {
      const rows = db.prepare(c.sql).all(projectId);
      hash.update(`${c.name}:${JSON.stringify(rows)}`);
    } catch (e) {
      hash.update(`${c.name}:missing`);
    }
  }
  return hash.digest('hex');
}

export function mergeD1Observations(options) {
  const { sourceD1, target, projectId, dryRun, backup } = options;

  if (!fs.existsSync(sourceD1)) {
    throw new Error(`Source D1 database does not exist: ${sourceD1}`);
  }
  if (!fs.existsSync(target)) {
    throw new Error(`Target database does not exist: ${target}`);
  }

  console.log(`[D1 OBSERVATION MERGE] Project ID: ${projectId}`);
  console.log(`[D1 OBSERVATION MERGE] Source D1 (Read-Only): ${sourceD1}`);
  console.log(`[D1 OBSERVATION MERGE] Target DB:              ${target}`);
  if (dryRun) console.log(`[D1 OBSERVATION MERGE] Mode: DRY RUN (Zero disk writes to target)\n`);

  // Step 1: Backup target before any writes
  let backupPath = null;
  if (!dryRun && backup) {
    const timestamp = Math.floor(Date.now() / 1000);
    backupPath = `${target}.backup.${timestamp}`;
    const bDb = new DatabaseSync(target, { readOnly: true });
    bDb.exec(`VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);
    bDb.close();
    console.log(`[D1 OBSERVATION MERGE] Target consistent snapshot backup created at: ${backupPath}\n`);
  }

  // Step 2: Open Source readonly and target (or dryRun replica)
  const d1Db = new DatabaseSync(sourceD1, { readOnly: true });
  let dryRunTmp = null;
  let targetDb;
  if (dryRun) {
    dryRunTmp = path.join(os.tmpdir(), `d1-obs-dryrun-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const bDb = new DatabaseSync(target, { readOnly: true });
    bDb.exec(`VACUUM INTO '${dryRunTmp.replace(/\\/g, '/')}'`);
    bDb.close();
    targetDb = new DatabaseSync(dryRunTmp);
  } else {
    targetDb = new DatabaseSync(target);
  }

  try {
    // Pre-merge hash of all protected/manual columns
    const preProtectedHash = computeProtectedDataHash(targetDb, projectId);

    const stats = {
      dryRun,
      backupPath,
      preProtectedHash,
      postProtectedHash: null,
      eligibleNotesCount: 0,
      updatedProfilesCount: 0,
      columnUpdates: {
        cover_url: 0,
        exposure: 0,
        read_count: 0,
        interaction_count: 0,
        like_count: 0,
        favorite_count: 0,
        share_count: 0,
        fans_count: 0,
        read_median: 0,
        interaction_median: 0,
      },
      notesCommentTotalUpdates: 0,
      noteCoversUpdated: 0,
      skippedInvalidObservations: 0,
      skippedDueToOlderTimestamp: 0,
    };

    if (!dryRun) {
      targetDb.exec('BEGIN IMMEDIATE;');
    }

    try {
      // Scope: strictly notes referenced by project qicui
      const qicuiNotes = targetDb.prepare(`
        SELECT note_id FROM project_notes WHERE project_id = ?
      `).all(projectId).map(r => r.note_id);

      stats.eligibleNotesCount = qicuiNotes.length;

      // Prepare statements for column-by-column update on note_profiles
      const getMainProfileStmt = targetDb.prepare(`
        SELECT note_id, cover_url, exposure, read_count, interaction_count,
               like_count, favorite_count, share_count, fans_count,
               read_median, interaction_median, updated_at
        FROM note_profiles
        WHERE note_id = ?
      `);

      const getD1ProfileStmt = d1Db.prepare(`
        SELECT note_id, cover_url, exposure, read_count, interaction_count,
               like_count, favorite_count, share_count, fans_count,
               read_median, interaction_median, updated_at
        FROM note_profiles
        WHERE note_id = ?
      `);

      const allowedNumericCols = [
        'exposure', 'read_count', 'interaction_count',
        'like_count', 'favorite_count', 'share_count',
        'fans_count', 'read_median', 'interaction_median'
      ];

      for (const noteId of qicuiNotes) {
        const mainProf = getMainProfileStmt.get(noteId);
        const d1Prof = getD1ProfileStmt.get(noteId);
        if (!mainProf || !d1Prof) continue;

        // Validate source timestamp
        const d1Time = d1Prof.updated_at ? Date.parse(d1Prof.updated_at) : NaN;
        const mainTime = mainProf.updated_at ? Date.parse(mainProf.updated_at) : NaN;
        const d1TimestampValid = Number.isFinite(d1Time);
        const d1IsNewer = d1TimestampValid && (!Number.isFinite(mainTime) || d1Time > mainTime);

        const updates = {};

        // 1. Check cover_url (HTTP/HTTPS URL)
        if (d1Prof.cover_url && typeof d1Prof.cover_url === 'string' && /^https?:\/\//i.test(d1Prof.cover_url.trim())) {
          const validD1Cover = d1Prof.cover_url.trim();
          const mainCoverEmpty = !mainProf.cover_url || mainProf.cover_url.trim() === '';
          if (mainCoverEmpty || (d1IsNewer && mainProf.cover_url !== validD1Cover)) {
            updates.cover_url = validD1Cover;
            stats.columnUpdates.cover_url++;
          }
        }

        // 2. Check numeric observation columns (must be finite, non-negative numbers)
        if (d1IsNewer) {
          for (const col of allowedNumericCols) {
            const d1Val = d1Prof[col];
            const mainVal = mainProf[col];
            if (d1Val !== null && d1Val !== undefined) {
              const numVal = Number(d1Val);
              if (Number.isFinite(numVal) && numVal >= 0) {
                if (mainVal === null || mainVal === undefined || numVal !== Number(mainVal)) {
                  updates[col] = numVal;
                  stats.columnUpdates[col]++;
                }
              } else {
                stats.skippedInvalidObservations++;
              }
            }
          }
        } else if (!d1IsNewer && d1TimestampValid) {
          stats.skippedDueToOlderTimestamp++;
        }

        // Execute column-by-column update if any verified observation changed
        const updateKeys = Object.keys(updates);
        if (updateKeys.length > 0) {
          stats.updatedProfilesCount++;
          if (d1TimestampValid) {
            updates.updated_at = d1Prof.updated_at;
            updateKeys.push('updated_at');
          }

          const setSql = updateKeys.map(k => `"${k}" = ?`).join(', ');
          const values = updateKeys.map(k => updates[k]);

          if (!dryRun) {
            targetDb.prepare(`UPDATE note_profiles SET ${setSql} WHERE note_id = ?`).run(...values, noteId);
          }
        }
      }

      // Also sync cover records into note_covers for notes where cover_url was populated
      if (!dryRun) {
        const syncCovers = targetDb.prepare(`
          INSERT OR IGNORE INTO note_covers (id, note_id, project_id, source_url, r2_key, content_type, status, fetched_at, last_error, updated_at)
          SELECT ? || ':' || np.note_id, np.note_id, ?, np.cover_url, '', 'image/jpeg', 'URL已获取', np.updated_at, '', np.updated_at
          FROM note_profiles np
          WHERE np.note_id IN (SELECT note_id FROM project_notes WHERE project_id = ?)
            AND np.cover_url != '' AND np.cover_url IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM note_covers nc WHERE nc.project_id = ? AND nc.note_id = np.note_id)
        `).run(projectId, projectId, projectId, projectId);
        stats.noteCoversUpdated = syncCovers.changes;
      }

      // Post-merge hash audit: protected columns must be 100% UNCHANGED
      const postProtectedHash = computeProtectedDataHash(targetDb, projectId);
      stats.postProtectedHash = postProtectedHash;

      if (preProtectedHash !== postProtectedHash) {
        throw new Error(`Protected manual/business data mutation detected! Pre: ${preProtectedHash}, Post: ${postProtectedHash}`);
      }
      stats.protectedDataHashMatch = preProtectedHash === postProtectedHash;

      // Audit confirmed daily report fingerprint
      const confRep = targetDb.prepare(`SELECT fingerprint FROM business_daily_reports WHERE project_id=? AND status='confirmed'`).get(projectId);
      stats.confirmedReportFingerprint = confRep?.fingerprint || null;
      stats.confirmedFingerprintMatch = confRep?.fingerprint === 'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e';

      if (!stats.confirmedFingerprintMatch) {
        throw new Error(`Confirmed report fingerprint corrupted during observation merge!`);
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

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const args = parseArgs();
    const result = mergeD1Observations(args);

    console.log('=== D1 OBSERVATION MERGE AUDIT SUMMARY ===');
    console.log(`Eligible Qicui Notes:             ${result.eligibleNotesCount}`);
    console.log(`Updated Note Profiles:            ${result.updatedProfilesCount}`);
    console.log(`Note Covers Backfilled:           ${result.noteCoversUpdated}`);
    console.log(`Skipped (Older D1 Timestamp):     ${result.skippedDueToOlderTimestamp}`);
    console.log(`Skipped (Invalid/Negative Val):   ${result.skippedInvalidObservations}`);

    console.log('\n=== COLUMN-BY-COLUMN UPDATES ===');
    for (const [col, cnt] of Object.entries(result.columnUpdates)) {
      console.log(`- ${col.padEnd(25)}: ${cnt} rows updated`);
    }

    console.log('\n=== INTEGRITY & PROTECTION AUDIT ===');
    console.log(`- Protected Data Hash Match:      ${result.protectedDataHashMatch} (${result.preProtectedHash.slice(0, 16)}...)`);
    console.log(`- Confirmed Report Verified:      ${result.confirmedFingerprintMatch} (FP: ${result.confirmedReportFingerprint?.slice(0, 16)}...)`);

    console.log(`\n[SUCCESS] Observation merge finished cleanly.`);
  } catch (err) {
    console.error(`\n[ERROR] ${err.message}`);
    process.exit(1);
  }
}
