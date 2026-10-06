import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { initialState, ALERTS } from '../timer.js';

test('shortcut defaults are Chrome-only with explicit Mac bindings', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  for (const [name, key] of [['startFocus', '8'], ['startBreak', '9']]) {
    const command = manifest.commands[name];
    assert.equal(command.suggested_key.default, `Ctrl+Shift+${key}`);
    assert.equal(command.suggested_key.mac, `Command+Shift+${key}`);
    assert.notEqual(command.global, true);
  }
});

test('settings shows live bindings, refreshes after editing, and opens customization', async () => {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', hidden: true, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    });
    return elements.get(id);
  };
  const state = initialState();
  $('settings-form').elements = Object.fromEntries(Object.keys(state.settings).map(key => [key, {}]));
  let commands = [{ name: 'startFocus', shortcut: 'Alt+Shift+F' }, { name: 'startBreak', shortcut: '' }];
  let failRead = false, failOpen = false, onFocus, onVisibility;
  const opened = [], errors = [];
  const source = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  runInNewContext(source.replace(/^import .*;\n/gm, ''), {
    $, ALERTS, request: async () => state, report: error => errors.push(error),
    chrome: {
      commands: { async getAll() { if (failRead) throw new Error('Unavailable'); return commands; } },
      tabs: { async create({ url }) { if (failOpen) throw new Error('Unavailable'); opened.push(url); } }
    },
    window: { addEventListener: (type, fn) => { if (type === 'focus') onFocus = fn; } },
    document: { hidden: false, addEventListener: (type, fn) => { if (type === 'visibilitychange') onVisibility = fn; } }
  });
  const settled = () => new Promise(resolve => setImmediate(resolve));
  await settled();
  assert.equal($('shortcut-focus').textContent, 'Alt+Shift+F');
  assert.equal($('shortcut-break').textContent, 'Not assigned');
  assert.equal($('settings-form').elements.focus.value, 25);
  await $('customize-shortcuts').listeners.click();
  assert.deepEqual(opened, ['chrome://extensions/shortcuts']);
  commands = [{ name: 'startBreak', shortcut: 'Ctrl+Shift+B' }];
  onVisibility();
  await settled();
  assert.equal($('shortcut-focus').textContent, 'Not assigned');
  assert.equal($('shortcut-break').textContent, 'Ctrl+Shift+B');

  failRead = true;
  await onFocus();
  assert.equal($('shortcut-focus').textContent, 'Unavailable');
  assert.equal($('shortcut-break').textContent, 'Unavailable');
  failRead = false;
  await onFocus();
  assert.equal($('shortcut-break').textContent, 'Ctrl+Shift+B');
  failOpen = true;
  await $('customize-shortcuts').listeners.click();
  assert.equal($('shortcut-error').hidden, false);
  assert.match($('shortcut-error').textContent, /chrome:\/\/extensions\/shortcuts/);
  failOpen = false;
  await $('customize-shortcuts').listeners.click();
  assert.equal($('shortcut-error').hidden, true);
  assert.deepEqual(errors, []);
});
