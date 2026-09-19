import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('history and options are separate pages, and every local file they load exists', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.options_ui.page, 'options.html');
  assert.match(read('background.js'), /getURL\('history\.html'\)/);
  for (const page of ['history.html', 'options.html', 'alert.html']) {
    const html = read(page);
    for (const [, path] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
      assert.ok(existsSync(new URL(path, root)), `${page} loads missing ${path}`);
    }
  }
  assert.ok(read('history.html').includes('id="heat-grid"') && !read('history.html').includes('settings-form'));
  assert.ok(read('options.html').includes('id="settings-form"') && !read('options.html').includes('heat-grid'));
});
