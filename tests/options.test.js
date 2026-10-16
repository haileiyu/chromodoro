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

function loadOptions({ commands = () => [], openTab = async () => {}, saveSettings = async () => {}, theme = 'system' } = {}) {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', hidden: true, listeners: {}, classes: new Set(),
      classList: { toggle(name, on) { on ? this.owner.classes.add(name) : this.owner.classes.delete(name); } },
      addEventListener(type, fn) { this.listeners[type] = fn; }
    });
    const element = elements.get(id);
    element.classList.owner = element;
    return element;
  };
  const state = initialState();
  $('settings-form').elements = Object.fromEntries(Object.keys(state.settings).map(key => [key, {}]));
  const themeInputs = ['system', 'light', 'dark'].map(value => ({ value, checked: false }));
  $('theme').querySelectorAll = () => themeInputs;
  const themeChoices = [];
  const errors = [], handlers = {};
  const source = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  runInNewContext(source.replace(/^import .*;\n/gm, ''), {
    $, ALERTS, report: error => errors.push(error),
    request: async (type, payload) => type === 'settings' ? saveSettings(payload) : state,
    chrome: { commands: { getAll: async () => commands() }, tabs: { create: openTab } },
    window: {
      addEventListener: (type, fn) => { if (type === 'focus') handlers.focus = fn; },
      theme: { get: () => theme, set: value => themeChoices.push(value) }
    },
    document: { hidden: false, addEventListener: (type, fn) => { if (type === 'visibilitychange') handlers.visibility = fn; } }
  });
  return { $, errors, handlers, themeInputs, themeChoices };
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test('appearance shows the saved theme and applies a new one at once', () => {
  const { $, themeInputs, themeChoices } = loadOptions({ theme: 'dark' });
  assert.deepEqual(themeInputs.filter(input => input.checked).map(input => input.value), ['dark']);
  $('theme').listeners.change({ target: { value: 'light' } });
  assert.deepEqual(themeChoices, ['light']);
  // Theme is not a form setting, so it never marks Save as changed.
  assert.equal($('save-settings').classes.has('primary'), false);
});

test('save is highlighted only while settings have unsaved changes', async () => {
  let failSave = false;
  const { $, errors } = loadOptions({ saveSettings: async () => { if (failSave) throw new Error('Unavailable'); } });
  const form = $('settings-form'), save = $('save-settings');
  const edit = (key, value) => { form.elements[key].value = value; form.listeners.input(); };
  await settled();
  assert.equal(save.classes.has('primary'), false);
  edit('focus', '30');
  assert.equal(save.classes.has('primary'), true);
  edit('focus', '25');
  assert.equal(save.classes.has('primary'), false);
  form.elements.notify.checked = !form.elements.notify.checked;
  form.listeners.input();
  assert.equal(save.classes.has('primary'), true);

  failSave = true;
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(save.classes.has('primary'), true);
  assert.equal(errors.length, 1);
  failSave = false;
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(save.classes.has('primary'), false);
  assert.equal($('save-status').textContent, 'Saved');
});

test('settings shows live bindings, refreshes after editing, and opens customization', async () => {
  let commands = [{ name: 'startFocus', shortcut: 'Alt+Shift+F' }, { name: 'startBreak', shortcut: '' }];
  let failRead = false, failOpen = false;
  const opened = [];
  const { $, errors, handlers } = loadOptions({
    commands: () => { if (failRead) throw new Error('Unavailable'); return commands; },
    openTab: async ({ url }) => { if (failOpen) throw new Error('Unavailable'); opened.push(url); }
  });
  const onFocus = () => handlers.focus(), onVisibility = () => handlers.visibility();
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
