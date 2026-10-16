import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 5022;
const baseUrl = `http://127.0.0.1:${port}`;
const outDir = path.resolve(import.meta.dirname, '..', '..', 'docs', 'frontend-v2-remediation', 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Starting production server on port', port, '...');
const server = spawn('npx', ['vinext', 'start', '--port', String(port), '--hostname', '127.0.0.1'], {
  stdio: 'ignore',
  shell: true,
  cwd: path.resolve('D:/download/pic-vec/feihe-platform-v3/feihe-mvp'),
});

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(baseUrl + '/');
      if (res.ok) {
        console.log('Server is ready!');
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Server timed out waiting to start');
}

const targets = [
  { file: '01-project-center-create.png', url: `${baseUrl}/`, size: '1440,960' },
  { file: '02-onboarding-wizard-deeplinks.png', url: `${baseUrl}/projects/internal-ops-activity`, size: '1440,960' },
  { file: '03-data-sources-inspect-mapping.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=data-sources`, size: '1440,960' },
  { file: '04-general-workbench-501rows-metrics.png', url: `${baseUrl}/projects/internal-ops-activity`, size: '1440,960' },
  { file: '05-data-detail-table-pagination.png', url: `${baseUrl}/projects/internal-ops-activity`, size: '1440,960' },
  { file: '06-member-management-matrix.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=members`, size: '1440,960' },
  { file: '07-project-profile-unified.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=profile`, size: '1440,960' },
  { file: '08-qicui-marketing-cockpit.png', url: `${baseUrl}/projects/qicui`, size: '1440,960' },
  { file: '09-mobile-viewport-390.png', url: `${baseUrl}/projects/internal-ops-activity`, size: '390,844' },
  { file: '10-mobile-viewport-390-sources.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=data-sources`, size: '390,844' },
];

try {
  await waitForServer();

  for (const t of targets) {
    console.log(`Capturing ${t.file} (${t.size})...`);
    const dest = path.join(outDir, t.file);
    const cmd = `"${chromePath}" --headless=new --disable-gpu --hide-scrollbars --window-size=${t.size} --screenshot="${dest}" "${t.url}"`;
    try {
      execSync(cmd, { stdio: 'ignore' });
      console.log(`✅ Saved ${t.file}`);
    } catch (err) {
      console.warn(`Failed to capture ${t.file}:`, err.message);
    }
  }
} finally {
  console.log('Stopping server...');
  try {
    server.kill();
  } catch {}
  try {
    execSync(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /f /pid %a`, { stdio: 'ignore', shell: 'cmd.exe' });
  } catch {}
}

console.log('All remediation screenshots captured successfully!');
