import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { resolvePythonBinary, backupLiveDbWithApi } from './merge-candidate-to-live-20261026.mjs';

const isolatedTestDir = fs.mkdtempSync(path.join(os.tmpdir(), `test-backup-db-${Date.now()}-${Math.random().toString(36).slice(2)}-`));

after(() => {
  try {
    fs.rmSync(isolatedTestDir, { recursive: true, force: true });
  } catch {}
});

test('resolvePythonBinary: resolves Linux python3 and Windows python defaults', () => {
  // Linux default
  assert.equal(resolvePythonBinary(null, 'linux', {}), 'python3');
  // Darwin default
  assert.equal(resolvePythonBinary(null, 'darwin', {}), 'python3');
  // Windows default
  assert.equal(resolvePythonBinary(null, 'win32', {}), 'python');
});

test('resolvePythonBinary: honors environment variable overrides and precedence', () => {
  // PYTHON_BIN overrides platform default
  assert.equal(
    resolvePythonBinary(null, 'linux', { PYTHON_BIN: '/custom/bin/python3' }),
    '/custom/bin/python3'
  );

  // PYTHON overrides platform default
  assert.equal(
    resolvePythonBinary(null, 'linux', { PYTHON: 'python3.11' }),
    'python3.11'
  );

  // FEIHE_PYTHON overrides platform default
  assert.equal(
    resolvePythonBinary(null, 'win32', { FEIHE_PYTHON: 'C:\\Python\\python.exe' }),
    'C:\\Python\\python.exe'
  );

  // Precedence: PYTHON_BIN > PYTHON > FEIHE_PYTHON
  assert.equal(
    resolvePythonBinary(null, 'linux', {
      PYTHON_BIN: '/bin/priority-1',
      PYTHON: '/bin/priority-2',
      FEIHE_PYTHON: '/bin/priority-3',
    }),
    '/bin/priority-1'
  );

  // Explicit customBin option takes highest priority
  assert.equal(
    resolvePythonBinary('/explicit/custom/python', 'linux', { PYTHON_BIN: '/bin/priority-1' }),
    '/explicit/custom/python'
  );
});

test('backupLiveDbWithApi: successfully performs SQLite online backup and preserves data integrity', () => {
  const srcDbPath = path.join(isolatedTestDir, 'source.db');
  const dstDbPath = path.join(isolatedTestDir, 'nested', 'backup.db');

  // Create source SQLite database with sample records
  const srcDb = new DatabaseSync(srcDbPath);
  srcDb.exec(`
    CREATE TABLE test_data (
      id TEXT PRIMARY KEY,
      val TEXT NOT NULL
    );
    INSERT INTO test_data VALUES ('row-1', 'alpha'), ('row-2', 'beta');
  `);
  srcDb.close();

  // Perform backup
  backupLiveDbWithApi(srcDbPath, dstDbPath);

  // Verify backup exists
  assert(fs.existsSync(dstDbPath), 'Destination backup file must exist');

  // Verify backup contents and integrity
  const dstDb = new DatabaseSync(dstDbPath, { readOnly: true });
  const integrity = dstDb.prepare('PRAGMA integrity_check').all();
  assert.equal(integrity[0]?.integrity_check, 'ok');

  const rows = dstDb.prepare('SELECT id, val FROM test_data ORDER BY id').all();
  assert.deepEqual(rows.map(r => ({ id: r.id, val: r.val })), [
    { id: 'row-1', val: 'alpha' },
    { id: 'row-2', val: 'beta' }
  ]);
  dstDb.close();
});

test('backupLiveDbWithApi: propagates error when source database does not exist', () => {
  const nonExistentSrc = path.join(isolatedTestDir, 'does-not-exist.db');
  const dstDbPath = path.join(isolatedTestDir, 'missing-src-backup.db');

  assert.throws(
    () => backupLiveDbWithApi(nonExistentSrc, dstDbPath),
    /SQLite online backup failed: source database does not exist/
  );
  assert.equal(fs.existsSync(dstDbPath), false, 'Destination backup file must not be created on failure');
});

test('backupLiveDbWithApi: propagates error when python binary is invalid or missing', () => {
  const srcDbPath = path.join(isolatedTestDir, 'source-for-invalid-bin.db');
  const dstDbPath = path.join(isolatedTestDir, 'invalid-bin-backup.db');

  const srcDb = new DatabaseSync(srcDbPath);
  srcDb.exec('CREATE TABLE dummy (x INT);');
  srcDb.close();

  assert.throws(
    () => backupLiveDbWithApi(srcDbPath, dstDbPath, { pythonBin: '__non_existent_python_binary_404__' }),
    /SQLite online backup failed .* using "__non_existent_python_binary_404__"/
  );
  assert.equal(fs.existsSync(dstDbPath), false, 'Destination backup file must not be created on failure');
});

test('backupLiveDbWithApi: propagates error when source file is corrupted and does not mask failure', () => {
  const corruptSrcPath = path.join(isolatedTestDir, 'corrupt-source.db');
  const dstDbPath = path.join(isolatedTestDir, 'corrupt-backup.db');

  // Write corrupt non-SQLite data
  fs.writeFileSync(corruptSrcPath, 'THIS_IS_DEFINITELY_NOT_A_SQLITE_DATABASE_HEADER');

  assert.throws(
    () => backupLiveDbWithApi(corruptSrcPath, dstDbPath),
    /SQLite online backup failed[\s\S]*file is not a database/
  );
});

test('backupLiveDbWithApi: rejects same source and destination path including Windows case differences', () => {
  const srcDbPath = path.join(isolatedTestDir, 'source-same-path.db');

  const srcDb = new DatabaseSync(srcDbPath);
  srcDb.exec('CREATE TABLE sample (id INT);');
  srcDb.close();

  // Exact same path
  assert.throws(
    () => backupLiveDbWithApi(srcDbPath, srcDbPath),
    /source and destination paths cannot be the same/
  );

  // Relative vs absolute pointing to same path
  const relPath = path.relative(process.cwd(), srcDbPath);
  assert.throws(
    () => backupLiveDbWithApi(srcDbPath, relPath),
    /source and destination paths cannot be the same/
  );

  // Windows case insensitivity rejection (e.g. UPPERCASE drive / filename)
  const caseVariantDst = srcDbPath.toUpperCase();
  assert.throws(
    () => backupLiveDbWithApi(srcDbPath, caseVariantDst, { platform: 'win32' }),
    /source and destination paths cannot be the same/
  );
});
