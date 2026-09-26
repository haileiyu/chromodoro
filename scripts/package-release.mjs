import { readFileSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const files = [
  'manifest.json', 'background.js', 'timer.js', 'toolbar-icon.js', 'sheets-sync.js',
  'page.js', 'styles.css', 'options.html', 'options.js', 'history.html', 'history.js',
  'alert.html', 'alert.js', 'google-apps-script/Code.gs', 'PRIVACY.md',
  ...[16, 32, 48, 128].map(size => `icons/icon${size}.png`)
];
const release = join(root, 'release');
mkdirSync(release, { recursive: true });
const target = join(release, `chromodoro-${manifest.version}.zip`);
const staging = mkdtempSync(join(tmpdir(), 'chromodoro-release-'));
try {
  for (const file of files) {
    const destination = join(staging, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, file), destination);
  }
  rmSync(target, { force: true });
  execFileSync('zip', ['-q', '-X', target, ...files], { cwd: staging });
  execFileSync('unzip', ['-t', target], { stdio: 'pipe' });
  console.log(`Created ${target} (${files.length} runtime and policy files)`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
