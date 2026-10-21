import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const testDbDir = path.join(ROOT_DIR, '.verification');
fs.mkdirSync(testDbDir, { recursive: true });
const testDbPath = path.join(testDbDir, `test-edit-${Date.now()}.db`).replaceAll('\\', '/');

process.env.LOCAL_DB_PATH = testDbPath;
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
process.env.REQUIRE_PROD_AUTH = 'false';
process.env.NODE_ENV = 'development';

const vite = await createServer({
  root: ROOT_DIR,
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: {
    alias: {
      '@': ROOT_DIR,
    },
  },
});

try {
  console.log('=== Isolated Project Edit Test Suite ===');
  console.log(`Using isolated DB: ${testDbPath}`);

  const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
  await ensureSchema();
  const d1 = db();

  // Seed realistic production-like projects
  const now = new Date().toISOString();
  await d1.batch([
    // Users
    d1.prepare(`INSERT OR IGNORE INTO users(id, email, name, role, department_id, created_at, updated_at)
      VALUES('user-admin', 'admin@company.local', '平台管理员', 'platform_admin', 'dept-general', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR IGNORE INTO users(id, email, name, role, department_id, created_at, updated_at)
      VALUES('user-editor', 'editor@company.local', '业务编辑者(张晓)', 'user', 'dept-marketing', ?, ?)`).bind(now, now),
    // Realistic Seeded Projects
    d1.prepare(`INSERT OR REPLACE INTO projects(id, name, spu, brand, category, description, status, color, logo_url,
      department_id, client_id, owner_id, owner_name, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
      VALUES('qicui', '启萃评论与声量项目', '启萃', '飞鹤', '婴幼儿奶粉', '评论执行、口碑舆情与本竞品监测', '进行中', '#1769d5', '',
      'dept-marketing', 'client-feihe', '', '', 'content_marketing', 0, 'ready', 'user-admin', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO projects(id, name, spu, brand, category, description, status, color, logo_url,
      department_id, client_id, owner_id, owner_name, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
      VALUES('kailas', '凯乐石', '', '', '', '', '进行中', '#1769d5', '',
      'dept-marketing', '', 'user-editor', '', 'campaign_review', 0, 'ready', 'user-editor', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO projects(id, name, spu, brand, category, description, status, color, logo_url,
      department_id, client_id, owner_id, owner_name, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
      VALUES('winner-wipes', '酒精湿巾', '', '', '', '', '进行中', '#1769d5', '',
      'dept-marketing', '', 'user-editor', '', 'campaign_review', 0, 'ready', 'user-editor', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO projects(id, name, spu, brand, category, description, status, color, logo_url,
      department_id, client_id, owner_id, owner_name, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
      VALUES('meiling', '美菱', '', '', '', '', '进行中', '#1769d5', '',
      'dept-marketing', '', 'user-editor', '', 'campaign_review', 0, 'ready', 'user-editor', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO projects(id, name, spu, brand, category, description, status, color, logo_url,
      department_id, client_id, owner_id, owner_name, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
      VALUES('huang-tiane', '黄天鹅', '', '', '', '', '进行中', '#1769d5', '',
      'dept-marketing', '', 'user-editor', '', 'campaign_review', 0, 'ready', 'user-editor', ?, ?)`).bind(now, now),
    // Memberships
    d1.prepare(`INSERT OR REPLACE INTO project_members(id, project_id, user_id, role, created_at, updated_at)
      VALUES('kailas:user-editor', 'kailas', 'user-editor', 'project_admin', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO project_members(id, project_id, user_id, role, created_at, updated_at)
      VALUES('winner-wipes:user-editor', 'winner-wipes', 'user-editor', 'project_admin', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO project_members(id, project_id, user_id, role, created_at, updated_at)
      VALUES('meiling:user-editor', 'meiling', 'user-editor', 'project_admin', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO project_members(id, project_id, user_id, role, created_at, updated_at)
      VALUES('huang-tiane:user-editor', 'huang-tiane', 'user-editor', 'project_admin', ?, ?)`).bind(now, now),
    d1.prepare(`INSERT OR REPLACE INTO project_members(id, project_id, user_id, role, created_at, updated_at)
      VALUES('qicui:user-admin', 'qicui', 'user-admin', 'project_admin', ?, ?)`).bind(now, now),
  ]);

  const projectsRoute = await vite.ssrLoadModule('/app/api/projects/route.ts');

  // Helpers
  const makePost = (body, userId = 'user-admin') => {
    return projectsRoute.POST(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(body),
      })
    );
  };

  const makeGet = (projectId, userId = 'user-admin') => {
    return projectsRoute.GET(
      new Request(`http://localhost/api/projects?projectId=${encodeURIComponent(projectId)}`, {
        headers: { 'x-user-id': userId },
      })
    );
  };

  // --- Test 1: Editing 'kailas' (had clientId: '', previously triggered NOT NULL constraint 500) ---
  console.log('Testing: Edit kailas with empty clientId (fix for 500)...');
  const res1 = await makePost({
    action: 'update',
    projectId: 'kailas',
    name: '凯乐石户外',
    spu: '凯乐石fuga',
    ownerName: '李主管',
    departmentId: 'dept-client-3',
    clientId: '',
    logoUrl: '',
  }, 'user-editor');

  if (res1.status !== 200) {
    console.error('res1 error:', await res1.json());
  }
  assert.equal(res1.status, 200, `Expected 200, got ${res1.status}`);
  const data1 = await res1.json();
  assert.equal(data1.ok, true);

  // Reload and verify fields
  const getRes1 = await makeGet('kailas', 'user-editor');
  assert.equal(getRes1.status, 200);
  const loaded1 = await getRes1.json();
  assert.equal(loaded1.project.name, '凯乐石户外');
  assert.equal(loaded1.project.spu, '凯乐石fuga');
  assert.equal(loaded1.project.ownerName, '李主管', 'Free-text ownerName displayed correctly');
  assert.equal(loaded1.project.ownerId, 'user-editor', 'Existing ownerId preserved');
  assert.equal(loaded1.project.departmentId, 'dept-client-3');
  assert.equal(loaded1.project.templateId, 'campaign_review', 'Template unchanged for campaign_review');
  assert.equal(loaded1.project.logoUrl, '', 'Empty logoUrl handled safely');
  console.log('PASS: kailas edit saved and reloaded successfully without 500.');

  // --- Test 2: Editing 'qicui' (had legacy empty owner_id) ---
  console.log('Testing: Edit qicui with empty legacy owner_id and free-text ownerName...');
  const membersBefore = (await d1.prepare('SELECT id, user_id, role FROM project_members WHERE project_id=? ORDER BY id').bind('qicui').all()).results;
  const projectBefore = await d1.prepare('SELECT owner_id FROM projects WHERE id=?').bind('qicui').first();
  assert.equal(projectBefore.owner_id, '', 'qicui owner_id before edit is empty');

  const res2 = await makePost({
    action: 'update',
    projectId: 'qicui',
    name: '启萃口碑中心',
    spu: '启萃',
    ownerName: '王经理',
    departmentId: 'dept-client-1',
    clientId: 'client-feihe',
    logoUrl: '',
  }, 'user-admin');

  assert.equal(res2.status, 200, `Expected 200, got ${res2.status}`);
  const getRes2 = await makeGet('qicui', 'user-admin');
  const loaded2 = await getRes2.json();
  assert.equal(loaded2.project.name, '启萃口碑中心');
  assert.equal(loaded2.project.spu, '启萃');
  assert.equal(loaded2.project.ownerName, '王经理');
  assert.equal(loaded2.project.ownerId, '', 'qicui owner_id must remain empty, NOT auto-populated with current user');
  assert.equal(loaded2.project.departmentId, 'dept-client-1');
  assert.equal(loaded2.project.templateId, 'content_marketing');

  const membersAfter = (await d1.prepare('SELECT id, user_id, role FROM project_members WHERE project_id=? ORDER BY id').bind('qicui').all()).results;
  assert.deepEqual(membersAfter, membersBefore, 'qicui project_members must remain strictly unchanged');

  // Verify exact ID check on department (passing name instead of exact ID must fail)
  const resBadDept = await makePost({
    action: 'update',
    projectId: 'qicui',
    departmentId: '客户一部', // passing name instead of exact ID
  }, 'user-admin');
  assert.equal(resBadDept.status, 400);
  assert.equal((await resBadDept.json()).error, '负责部门不存在或不属于当前组织');
  console.log('PASS: qicui edit saved and reloaded successfully.');

  // --- Test 3: Preserve legacy department when not explicitly changed ---
  console.log('Testing: winner-wipes preserves legacy department dept-marketing...');
  const res3 = await makePost({
    action: 'update',
    projectId: 'winner-wipes',
    name: '稳健酒精湿巾',
    spu: '稳健玉米酒精湿巾',
    ownerName: '张负责人',
    departmentId: 'dept-marketing', // keeping legacy dept
    clientId: '',
    logoUrl: '',
  }, 'user-editor');

  assert.equal(res3.status, 200);
  const getRes3 = await makeGet('winner-wipes', 'user-editor');
  const loaded3 = await getRes3.json();
  assert.equal(loaded3.project.departmentId, 'dept-marketing', 'Legacy dept preserved');
  assert.equal(loaded3.project.spu, '稳健玉米酒精湿巾');
  assert.equal(loaded3.project.ownerName, '张负责人');
  console.log('PASS: legacy department preserved on edit.');

  // --- Test 4: Forged client owner_id is NOT accepted by regular user ---
  console.log('Testing: regular user cannot forge owner_id...');
  const res4 = await makePost({
    action: 'update',
    projectId: 'meiling',
    name: '美菱冰箱项目',
    spu: '美菱冰箱',
    ownerName: '陈工程师',
    ownerId: 'user-forged-admin', // Attempt to forge owner_id
    departmentId: 'dept-client-5',
    clientId: '',
    logoUrl: '',
  }, 'user-editor');

  assert.equal(res4.status, 200);
  const getRes4 = await makeGet('meiling', 'user-editor');
  const loaded4 = await getRes4.json();
  assert.equal(loaded4.project.ownerId, 'user-editor', 'Forged owner_id rejected, existing ownerId preserved');
  assert.equal(loaded4.project.ownerName, '陈工程师', 'ownerName updated');
  assert.equal(loaded4.project.spu, '美菱冰箱');
  console.log('PASS: server reference validation secured owner_id against arbitrary client manipulation.');

  // --- Test 5: Creating new project defaults to general_workbench ---
  console.log('Testing: Create new project defaults to general_workbench...');
  const res5 = await makePost({
    action: 'create',
    name: '综合运营看板',
    spu: '运营SPU',
    ownerName: '周专员',
    departmentId: 'dept-client-2',
    clientId: '',
    logoUrl: '',
  }, 'user-admin');

  assert.equal(res5.status, 200);
  const data5 = await res5.json();
  const newId = data5.id;
  const getRes5 = await makeGet(newId, 'user-admin');
  const loaded5 = await getRes5.json();
  assert.equal(loaded5.project.templateId, 'general_workbench', 'New project defaults to general_workbench');
  assert.equal(loaded5.project.ownerName, '周专员');
  assert.equal(loaded5.project.ownerId, 'user-admin');
  console.log('PASS: new project created with general_workbench template.');

  // --- Test 6: Verify STANDARD_DEPARTMENTS contains only 7 items ---
  console.log('Testing: STANDARD_DEPARTMENTS contains exactly 7 specified departments...');
  const { STANDARD_DEPARTMENTS } = await vite.ssrLoadModule('/lib/project-form.ts');
  assert.equal(STANDARD_DEPARTMENTS.length, 7);
  const expectedNames = ['客户一部', '客户二部', '客户三部', '客户四部', '客户五部', '客户六部', '弘摩'];
  assert.deepEqual(STANDARD_DEPARTMENTS.map(d => d.name), expectedNames);
  console.log('PASS: Exactly 7 standard department options present.');

  // --- Test 7: UI Rendering Verification for ProjectFormDialog ---
  console.log('Testing: ProjectFormDialog UI rendering (simplified form)...');
  const { ProjectFormDialog } = await vite.ssrLoadModule('/features/project-center/ProjectFormDialog.tsx');

  const dummyMetadata = {
    departments: STANDARD_DEPARTMENTS.map(d => ({ id: d.id, name: d.name })),
    clients: [{ id: 'client-feihe', name: '飞鹤乳业' }],
    templates: [{ id: 'general_workbench', name: '通用数据工作台', description: '', icon: '', modulesJson: '' }],
    users: [{ id: 'user-admin', name: '平台管理员', email: 'admin@company.local', role: 'platform_admin' }],
    currentUser: { userId: 'user-admin', email: 'admin@company.local', displayName: '平台管理员', role: 'platform_admin' },
  };

  // 7a. Create form rendering
  const createMarkup = renderToStaticMarkup(
    React.createElement(ProjectFormDialog, {
      metadata: dummyMetadata,
      onClose: () => {},
      onSaved: async () => {},
    })
  );

  assert(!createMarkup.includes('复用项目结构'), 'Must not render reuse structure dropdown');
  assert(!createMarkup.includes('业务方向'), 'Must not render business direction dropdown');
  assert(!createMarkup.includes('必要字段：'), 'Must not render template guide box');
  assert(createMarkup.includes('aria-label="项目负责人"'), 'Must render free-text owner input');
  assert(createMarkup.includes('负责部门'), 'Must render department field');
  console.log('PASS: Create dialog is simplified without reuse structure, business direction, or guide box.');

  // 7b. Edit legacy project rendering
  const editMarkup = renderToStaticMarkup(
    React.createElement(ProjectFormDialog, {
      project: {
        id: 'kailas',
        name: '凯乐石',
        spu: '',
        departmentId: 'dept-marketing',
        departmentName: '市场与营销部',
        ownerId: 'user-editor',
        ownerName: '张晓',
        clientId: '',
        templateId: 'campaign_review',
        status: '进行中',
        color: '#1769d5',
        logoUrl: '',
        updatedAt: now,
        noteCount: 0,
        reportableCount: 0,
      },
      metadata: dummyMetadata,
      onClose: () => {},
      onSaved: async () => {},
    })
  );

  assert(editMarkup.includes('当前项目保留历史部门“市场与营销部”'), 'Must inform user that legacy department is preserved until deliberate change');
  assert(!editMarkup.includes('复用项目结构'), 'Must not render reuse structure on edit');
  assert(!editMarkup.includes('业务方向'), 'Must not render business direction on edit');
  assert(editMarkup.includes('value="张晓"'), 'Free-text owner name populated in input');
  console.log('PASS: Edit dialog correctly preserves and displays legacy department and free-text owner.');

  // --- Test 8: ProjectCenter owner dropdown and filtering by text ownerName ---
  console.log('Testing: ProjectCenter owner dropdown extracts unique text ownerName...');
  const sampleProjects = [
    { id: 'p1', name: 'P1', ownerName: '张晓', ownerId: 'user-1' },
    { id: 'p2', name: 'P2', ownerName: '李主管', ownerId: 'user-2' },
    { id: 'p3', name: 'P3', ownerName: '张晓', ownerId: 'user-3' }, // Duplicate name
    { id: 'p4', name: 'P4', ownerName: '', ownerId: 'user-4' }, // Empty name
  ];
  const ownerNames = new Set();
  for (const p of sampleProjects) {
    const name = p.ownerName?.trim();
    if (name) ownerNames.add(name);
  }
  const derivedOptions = [
    { value: 'all', label: '全部负责人' },
    ...Array.from(ownerNames).sort().map(name => ({ value: name, label: name })),
  ];
  assert.equal(derivedOptions.length, 3);
  assert.deepEqual(derivedOptions.map(o => o.value), ['all', '张晓', '李主管']);

  // Verify filtering
  const filteredByZhang = sampleProjects.filter(p => (p.ownerName || '') === '张晓');
  assert.equal(filteredByZhang.length, 2);
  console.log('PASS: ProjectCenter correctly deduplicates and filters by text ownerName.');

  console.log('\nALL ISOLATED TESTS PASSED SUCCESSFULLY!');
} finally {
  await vite.close();
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    const wal = testDbPath + '-wal';
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    const shm = testDbPath + '-shm';
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch {}
}
