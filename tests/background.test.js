import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey } from '../timer.js';

// Chrome API contract harness: persistent storage survives worker re-imports.
function chromeHarness(persisted = {}) {
  const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); }, fire(...args) { this.listeners.forEach(fn => fn(...args)); } });
  const alarms = new Map();
  const notifications = [];
  const badge = {};
  const menus = new Map();
  const chrome = {
    storage: { local: {
      async get(key) { return { [key]: structuredClone(persisted[key]) }; },
      async set(value) { Object.assign(persisted, structuredClone(value)); }
    } },
    action: {
      onClicked: event(),
      async setBadgeText({ text }) { badge.text = text; },
      async setBadgeBackgroundColor({ color }) { badge.color = color; },
      async setBadgeTextColor() {}, async setTitle({ title }) { badge.title = title; }
    },
    alarms: { onAlarm: event(), async get(name) { return alarms.get(name); }, async create(name, options) { alarms.set(name, { ...options, scheduledTime: options.when }); }, async clear(name) { return alarms.delete(name); } },
    notifications: { onClicked: event(), async create(id, data) { notifications.push({ id, data }); } },
    contextMenus: { onClicked: event(), async removeAll() { menus.clear(); }, create(data, callback) { menus.set(data.id, data); callback(); } },
    runtime: { id: 'test-extension', onInstalled: event(), onStartup: event(), onMessage: event(), async openOptionsPage() {} }
  };
  const message = data => new Promise(resolve => chrome.runtime.onMessage.listeners[0](data, { id: chrome.runtime.id }, resolve));
  return { chrome, persisted, alarms, notifications, badge, menus, message };
}

test('toolbar, restart recovery, concurrent alarms, reset, and settings integration', async () => {
  const realNow = Date.now;
  let now = new Date(2026, 8, 5, 10).getTime();
  Date.now = () => now;
  let h = chromeHarness();
  globalThis.chrome = h.chrome;
  try {
    await import(`../background.js?first=${Math.random()}`);
    h.chrome.runtime.onInstalled.fire();
    await h.message({ type: 'get' });
    assert.equal(h.menus.size, 3);
    assert.equal(h.badge.text, '');
    h.chrome.action.onClicked.fire();
    let result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.status, 'running');
    assert.equal(h.badge.text, '25m');
    assert.equal(h.alarms.get('chromodoro-tick').periodInMinutes, 0.5);
    now += 9 * 60000;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-tick' });
    await h.message({ type: 'get' });
    assert.equal(h.badge.text, '16m');
    h.chrome.action.onClicked.fire();
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.status, 'paused');
    assert.equal(h.alarms.size, 0);
    now += 60 * 60000;
    // New worker, persisted state, and no alarms after a Chrome restart.
    h = chromeHarness(h.persisted);
    globalThis.chrome = h.chrome;
    await import(`../background.js?second=${Math.random()}`);
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.remainingMs, 16 * 60000);
    h.chrome.action.onClicked.fire();
    result = await h.message({ type: 'get' });
    assert.equal(h.alarms.get('chromodoro-end').scheduledTime, now + 16 * 60000);
    const deadline = result.state.timer.endsAt;
    // Simulate a suspended worker plus cleared alarms while still running.
    h = chromeHarness(h.persisted);
    globalThis.chrome = h.chrome;
    await import(`../background.js?third=${Math.random()}`);
    await h.message({ type: 'get' });
    assert.equal(h.alarms.get('chromodoro-end').scheduledTime, deadline);
    now = deadline;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-end' });
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-tick' });
    const simultaneous = await Promise.all([h.message({ type: 'get' }), h.message({ type: 'get' })]);
    assert.equal(simultaneous[1].state.days[dayKey(now)].count, 1);
    assert.equal(h.notifications.length, 1);
    assert.equal(h.alarms.size, 0);
    assert.equal(h.badge.text, '✓');
    await h.message({ type: 'toggle' });
    result = await h.message({ type: 'reset' });
    assert.equal(result.state.timer, null);
    assert.equal(result.state.nextPhase, 'focus');
    assert.equal(result.state.days[dayKey(now)].count, 1);
    const oldSettings = result.state.settings;
    result = await h.message({ type: 'settings', settings: { ...oldSettings, focus: 0 } });
    assert.equal(result.ok, false);
    result = await h.message({ type: 'get' });
    assert.deepEqual(result.state.settings, oldSettings);
    // Queue keeps working after rejected input; rapid clicks cannot lose state.
    await Promise.all([h.message({ type: 'toggle' }), h.message({ type: 'toggle' })]);
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.status, 'paused');
  } finally {
    Date.now = realNow;
    delete globalThis.chrome;
  }
});
