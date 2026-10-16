import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../theme.js', import.meta.url), 'utf8');

function loadTheme({ stored = null, systemDark = false, blocked = false } = {}) {
  const items = new Map(stored ? [['theme', stored]] : []);
  const listeners = {};
  const media = { matches: systemDark, addEventListener: (type, fn) => { listeners.media = fn; } };
  const storage = {
    getItem: key => { if (blocked) throw new Error('blocked'); return items.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error('blocked'); items.set(key, value); },
    removeItem: key => { if (blocked) throw new Error('blocked'); items.delete(key); }
  };
  const window = {};
  const root = { dataset: {} };
  runInNewContext(source, {
    window, localStorage: storage, matchMedia: () => media,
    document: { documentElement: root },
    addEventListener: (type, fn) => { listeners[type] = fn; }
  });
  return { theme: window.theme, root, items, media, listeners };
}

test('system follows the device until a theme is chosen', () => {
  const t = loadTheme({ systemDark: true });
  assert.equal(t.theme.get(), 'system');
  assert.equal(t.root.dataset.theme, 'dark');
  t.media.matches = false;
  t.listeners.media();
  assert.equal(t.root.dataset.theme, 'light');
});

test('a chosen theme overrides the device, persists, and can be cleared', () => {
  const t = loadTheme({ systemDark: true });
  t.theme.set('light');
  assert.equal(t.root.dataset.theme, 'light');
  assert.equal(t.items.get('theme'), 'light');
  assert.equal(loadTheme({ stored: 'light', systemDark: true }).root.dataset.theme, 'light');
  t.theme.set('system');
  assert.equal(t.items.has('theme'), false);
  assert.equal(t.root.dataset.theme, 'dark');
});

test('other tabs pick up a change, and bad or blocked storage falls back safely', () => {
  const t = loadTheme();
  t.items.set('theme', 'dark');
  t.listeners.storage({ key: 'theme' });
  assert.equal(t.root.dataset.theme, 'dark');
  assert.equal(loadTheme({ stored: 'purple' }).theme.get(), 'system');
  const blocked = loadTheme({ blocked: true });
  assert.equal(blocked.root.dataset.theme, 'light');
  blocked.theme.set('dark');
  assert.equal(blocked.root.dataset.theme, 'dark');
});
