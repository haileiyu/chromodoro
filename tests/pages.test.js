import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('history and options are separate pages, and every local file they load exists', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.options_ui.page, 'options.html');
  for (const [size, path] of Object.entries(manifest.action.default_icon)) {
    assert.equal(path, `icons/idle${size}.png`);
    assert.ok(existsSync(new URL(path, root)), `Missing default icon ${path}`);
    assert.ok(existsSync(new URL(`icons/icon${size}.png`, root)));
  }
  assert.match(read('background.js'), /getURL\('history\.html'\)/);
  for (const page of ['history.html', 'options.html', 'alert.html']) {
    const html = read(page);
    for (const [, path] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
      assert.ok(existsSync(new URL(path, root)), `${page} loads missing ${path}`);
    }
  }
  // Every script and stylesheet a page loads must also ship in the release zip.
  const release = read('scripts/package-release.mjs');
  for (const page of ['history.html', 'options.html', 'alert.html', 'privacy.html']) {
    for (const [, path] of read(page).matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)) {
      assert.ok(release.includes(`'${path}'`), `${page} loads ${path}, which the release does not package`);
    }
    // Set before first paint, so a dark page never flashes white.
    assert.ok(read(page).indexOf('<script src="theme.js"></script>') < read(page).indexOf('styles.css'), `${page} must load theme.js first`);
  }
  assert.ok(read('history.html').includes('id="heat-grid"') && !read('history.html').includes('settings-form'));
  assert.ok(read('options.html').includes('id="settings-form"') && !read('options.html').includes('heat-grid'));
});
