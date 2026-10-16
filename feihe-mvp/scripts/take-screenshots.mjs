import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 5018;
const baseUrl = `http://127.0.0.1:${port}`;
const outDir1 = path.resolve('..', 'docs', 'frontend-product-closure-v1', 'screenshots');
const outDir2 = path.resolve('..', 'docs', 'platform-upgrade-v1', 'screenshots');

[outDir1, outDir2].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('Starting production server on port', port, '...');
const server = spawn('npx', ['vinext', 'start', '--port', String(port), '--hostname', '127.0.0.1'], {
  stdio: 'ignore',
  shell: true,
  detached: false,
});

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(baseUrl + '/');
      if (res.ok) {
        console.log('Server is ready!');
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Server timed out waiting to start');
}

const targets = [
  { file: '01-project-center.png', url: `${baseUrl}/`, size: '1440,960' },
  { file: '02-qicui-overview.png', url: `${baseUrl}/projects/qicui`, size: '1440,960' },
  { file: '03-general-workbench.png', url: `${baseUrl}/projects/internal-ops-activity`, size: '1440,960' },
  { file: '04-data-sources-settings.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=data-sources`, size: '1440,960' },
  { file: '05-member-management.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=members`, size: '1440,960' },
  { file: '06-project-profile.png', url: `${baseUrl}/projects/internal-ops-activity/settings?tab=profile`, size: '1440,960' },
  { file: '07-narrow-mobile-390.png', url: `${baseUrl}/projects/internal-ops-activity`, size: '390,844' },
];

try {
  await waitForServer();

  for (const t of targets) {
    console.log(`Capturing ${t.file} (${t.size})...`);
    const path1 = path.join(outDir1, t.file);
    const path2 = path.join(outDir2, t.file);
    const cmd = `"${chromePath}" --headless=new --disable-gpu --hide-scrollbars --window-size=${t.size} --screenshot="${path1}" "${t.url}"`;
    try {
      execSync(cmd, { stdio: 'ignore' });
      fs.copyFileSync(path1, path2);
      console.log(`✅ Saved ${t.file}`);
    } catch (err) {
      console.warn(`Failed to capture ${t.file}:`, err.message);
    }
  }
} finally {
  console.log('Stopping server...');
  try {
    process.kill(-server.pid);
  } catch {
    server.kill();
  }
  // On Windows, kill any remaining process on that port
  try {
    execSync(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /f /pid %a`, { stdio: 'ignore', shell: 'cmd.exe' });
  } catch {}
}

console.log('All screenshots captured successfully!');