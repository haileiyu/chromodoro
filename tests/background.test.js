import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, initialState } from '../timer.js';
import { PREFIX } from '../history-sync.js';

// Canvas and bitmap decoding are supplied by Chrome in the worker.
globalThis.createImageBitmap = async () => ({ close() {} });
globalThis.OffscreenCanvas = class {
  getContext() {
    return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([195, 79, 53, 255]) }) };
  }
};
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => url.startsWith('chrome-extension://')
  ? Promise.resolve({ blob: async () => new Blob() }) : nativeFetch(url, options);

// Chrome API contract harness: persistent storage survives worker re-imports.
function chromeHarness(persisted = {}, synced = {}) {
  const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); }, fire(...args) { this.listeners.forEach(fn => fn(...args)); } });
  const alarms = new Map();
  const notifications = [];
  const badge = {};
  const menus = new Map();
  const tabs = [];
  const focused = [];
  const chrome = {
    commands: { onCommand: event() },
    storage: { onChanged: event(), sync: {
      async get() { return structuredClone(synced); },
      async set(value) { Object.assign(synced, structuredClone(value)); },
      async remove(keys) { for (const key of keys) delete synced[key]; }
    }, local: {
      async get(key) { return { [key]: structuredClone(persisted[key]) }; },
      async set(value) { Object.assign(persisted, structuredClone(value)); },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete persisted[key]; }
    } },
    action: {
      onClicked: event(),
      async setIcon(icon) { badge.icon = icon; },
      async setBadgeText({ text }) { badge.text = text; },
      async setBadgeBackgroundColor({ color }) { badge.color = color; },
      async setBadgeTextColor() {}, async setTitle({ title }) { badge.title = title; }
    },
    alarms: { onAlarm: event(), async get(name) { return alarms.get(name); }, async create(name, options) { alarms.set(name, { ...options, scheduledTime: options.when }); }, async clear(name) { return alarms.delete(name); } },
    notifications: { onClicked: event(), async create(id, data) { notifications.push({ id, data }); } },
    contextMenus: {
      onClicked: event(),
      async removeAll() { menus.clear(); },
      create(data, callback) { menus.set(data.id, data); callback(); }
    },
    tabs: {
      async create(properties) { tabs.push({ ...properties, id: tabs.length + 1 }); return tabs.at(-1); },
      async update(id, properties) { focused.push({ id, ...properties }); }
    },
    windows: { async update(id, properties) { focused.push({ windowId: id, ...properties }); } },
    runtime: {
      id: 'test-extension', getURL: path => `chrome-extension://test/${path}`,
      async getContexts({ documentUrls }) { return tabs.filter(tab => documentUrls.includes(tab.url)).map(tab => ({ contextType: 'TAB', tabId: tab.id, windowId: 1, documentUrl: tab.url })); }, onInstalled: event(), onStartup: event(), onMessage: event(), async openOptionsPage() {} }
  };
  const message = data => new Promise(resolve => chrome.runtime.onMessage.listeners[0](data, { id: chrome.runtime.id }, resolve));
  return { chrome, persisted, synced, alarms, notifications, badge, menus, tabs, focused, message };
}

test('keyboard commands replace sessions and serialize with completion alarms', async () => {
  const realNow = Date.now;
  let now = new Date(2026, 9, 6, 9).getTime();
  Date.now = () => now;
  const h = chromeHarness();
  globalThis.chrome = h.chrome;
  const command = async name => {
    h.chrome.commands.onCommand.fire(name);
    return (await h.message({ type: 'get' })).state;
  };
  try {
    await import(`../background.js?commands=${Math.random()}`);
    let state = await command('startFocus');
    assert.equal(state.timer.phase, 'focus');
    assert.equal(state.timer.status, 'running');
    assert.equal(h.badge.text, '25m');
    now += 60000;
    state = await command('startFocus');
    assert.equal(state.timer.endsAt, now + 25 * 60000);
    assert.deepEqual(state.days, {});

    await h.message({ type: 'toggle' }); // A shortcut also replaces a paused session.
    state = await command('startBreak');
    assert.equal(state.timer.phase, 'shortBreak');
    assert.equal(state.timer.status, 'running');
    assert.equal(state.timer.durationMs, 5 * 60000);
    assert.deepEqual(state.days, {});
    assert.equal(h.notifications.length, 0);
    await h.message({ type: 'settings', settings: { ...state.settings, longEvery: 1 } });
    state = await command('startFocus');
    assert.equal(state.timer.phase, 'focus');
    now = state.timer.endsAt;

    // The command reaches the queue before overdue alarms: bank focus exactly once.
    h.chrome.commands.onCommand.fire('startBreak');
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-end' });
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-tick' });
    state = (await h.message({ type: 'get' })).state;
    assert.equal(state.timer.phase, 'longBreak');
    assert.equal(state.timer.durationMs, 15 * 60000);
    assert.equal(state.cycle, 1);
    assert.equal(state.days[dayKey(now)].count, 1);
    assert.equal(h.notifications.length, 1);
    assert.equal(h.alarms.get('chromodoro-end').scheduledTime, state.timer.endsAt);
    const before = structuredClone(state);
    state = await command('unknown');
    assert.deepEqual(state, before);

    // Commands are registered again when the worker wakes with a saved timer.
    const restarted = chromeHarness(h.persisted);
    globalThis.chrome = restarted.chrome;
    await import(`../background.js?commands-restart=${Math.random()}`);
    restarted.chrome.commands.onCommand.fire('startFocus');
    state = (await restarted.message({ type: 'get' })).state;
    assert.equal(state.timer.phase, 'focus');
    assert.equal(state.timer.status, 'running');
    assert.equal(state.cycle, 1);
    assert.equal(state.days[dayKey(now)].count, 1);
  } finally {
    Date.now = realNow;
    delete globalThis.chrome;
  }
});

test('upgrading removes old backup credentials and retry alarm without losing history', async () => {
  const savedState = { ...initialState(), days: { '2026-09-20': { count: 2, minutes: 50 } } };
  const h = chromeHarness({ state: savedState, sheetsSync: { token: 'old-secret' }, sheetsSource: 'old-id' });
  h.alarms.set('chromodoro-sheets', { periodInMinutes: 5 });
  globalThis.chrome = h.chrome;
  try {
    await import(`../background.js?upgrade=${Math.random()}`);
    const result = await h.message({ type: 'get' });
    assert.deepEqual(result.state.days, savedState.days);
    assert.equal(h.persisted.sheetsSync, undefined);
    assert.equal(h.persisted.sheetsSource, undefined);
    assert.equal(h.alarms.has('chromodoro-sheets'), false);
    assert.equal(h.chrome.runtime.onMessage.listeners[0]({ type: 'sheetsConnect' }, { id: h.chrome.runtime.id }, () => {}), false);
  } finally {
    delete globalThis.chrome;
  }
});

test('remote history updates merge while the active timer and break cycle stay local', async () => {
  const h = chromeHarness();
  globalThis.chrome = h.chrome;
  const remoteKey = `${PREFIX}00000000-0000-4000-8000-000000000002:${dayKey().slice(0, 7)}`;
  const day = Number(dayKey().slice(8));
  try {
    await import(`../background.js?sync=${Math.random()}`);
    const before = (await h.message({ type: 'startFocus' })).state;
    h.synced[remoteKey] = { [day]: [3, 90] };
    h.chrome.storage.onChanged.fire({ [remoteKey]: { newValue: h.synced[remoteKey] } }, 'sync');
    let result = await h.message({ type: 'get' });
    assert.deepEqual(result.state.timer, before.timer);
    assert.equal(result.state.cycle, 0);
    assert.deepEqual(result.state.days[dayKey()], { count: 3, minutes: 90 });
    h.chrome.storage.onChanged.fire({ [remoteKey]: { newValue: h.synced[remoteKey] } }, 'sync');
    result = await h.message({ type: 'syncHistory' });
    assert.equal(result.state.days[dayKey()].count, 3);
    assert.equal(h.notifications.length, 0);
    assert.equal(result.state.historySync.status, 'ready');
  } finally { delete globalThis.chrome; }
});

test('failed sync does not prevent completion alerts; the retry alarm publishes exactly once', async () => {
  const state = initialState();
  state.timer = { id: 'offline-focus', phase: 'focus', status: 'running', endsAt: Date.now() - 1, durationMs: 25 * 60000 };
  const h = chromeHarness({ state });
  const originalSet = h.chrome.storage.sync.set;
  h.chrome.storage.sync.set = async () => { throw new Error('QUOTA_BYTES exceeded'); };
  globalThis.chrome = h.chrome;
  try {
    await import(`../background.js?retry=${Math.random()}`);
    let result = await h.message({ type: 'get' });
    assert.equal(result.state.days[dayKey()].count, 1);
    assert.equal(result.state.historySync.status, 'limited');
    assert.equal(h.notifications.length, 1);
    h.chrome.storage.sync.set = originalSet;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-history-sync' });
    result = await h.message({ type: 'get' });
    assert.equal(result.state.historySync.status, 'ready');
    assert.equal(result.state.days[dayKey()].count, 1);
    assert.equal(h.notifications.length, 1);
    assert.deepEqual(Object.values(h.synced)[0], { [Number(dayKey().slice(8))]: [1, 25] });
  } finally { delete globalThis.chrome; }
});

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
    assert.deepEqual([...h.menus.values()].map(item => item.title), ['Start focusing', 'Start break', 'Pomodoro history']);
    // History is its own page; settings stay on the options page Chrome links as Options.
    // openHistory is not on the state queue, so let its promises settle before looking.
    const settled = () => new Promise(resolve => setTimeout(resolve, 0));
    h.chrome.contextMenus.onClicked.fire({ menuItemId: 'history' });
    await settled();
    assert.equal(h.tabs.length, 1);
    assert.match(h.tabs[0].url, /\/history\.html$/);
    // A second click, or a notification click, focuses that tab instead of adding one.
    h.chrome.contextMenus.onClicked.fire({ menuItemId: 'history' });
    h.chrome.notifications.onClicked.fire('chromodoro-x');
    await settled();
    assert.equal(h.tabs.length, 1);
    assert.deepEqual(h.focused.filter(entry => entry.active).map(entry => entry.id), [1, 1]);
    assert.equal(h.focused.filter(entry => entry.focused).length, 2);
    assert.equal(h.badge.text, '');
    assert.ok(h.badge.icon.imageData);
    h.chrome.action.onClicked.fire();
    let result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.status, 'running');
    assert.equal(h.badge.text, '25m');
    assert.equal(h.badge.icon.path[16], 'icons/icon16.png');
    assert.equal(h.alarms.get('chromodoro-tick').periodInMinutes, 0.5);
    now += 9 * 60000;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-tick' });
    await h.message({ type: 'get' });
    assert.equal(h.badge.text, '16m');
    h.chrome.action.onClicked.fire();
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.status, 'paused');
    assert.ok(h.badge.icon.imageData);
    assert.equal(h.badge.color, '#77736B');
    assert.deepEqual([...h.alarms.keys()], ['chromodoro-history-sync']);
    now += 60 * 60000;
    // New worker, persisted state, and no alarms after a Chrome restart.
    h = chromeHarness(h.persisted);
    globalThis.chrome = h.chrome;
    await import(`../background.js?second=${Math.random()}`);
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.remainingMs, 16 * 60000);
    assert.ok(h.badge.icon.imageData);
    h.chrome.action.onClicked.fire();
    result = await h.message({ type: 'get' });
    assert.equal(h.alarms.get('chromodoro-end').scheduledTime, now + 16 * 60000);
    assert.equal(h.badge.icon.path[16], 'icons/icon16.png');
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
    assert.deepEqual([...h.alarms.keys()], ['chromodoro-history-sync']);
    assert.equal(h.badge.text, '');
    assert.equal(h.badge.color, '#77736B');
    assert.ok(h.badge.icon.imageData);
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

test('start focusing skips a break or restarts focus, and leaves the long-break cycle intact', async () => {
  const realNow = Date.now;
  let now = new Date(2026, 8, 5, 9).getTime();
  Date.now = () => now;
  const h = chromeHarness();
  globalThis.chrome = h.chrome;
  const finishFocus = async () => {
    now += 25 * 60000;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-end' });
    return h.message({ type: 'get' });
  };
  try {
    await import(`../background.js?skip=${Math.random()}`);
    h.chrome.runtime.onInstalled.fire();
    await h.message({ type: 'get' });
    await h.message({ type: 'toggle' });
    let result = await finishFocus();
    assert.equal(result.state.nextPhase, 'shortBreak');

    // One right-click replaces the queued break with a running focus session.
    h.chrome.contextMenus.onClicked.fire({ menuItemId: 'startFocus' });
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.phase, 'focus');
    assert.equal(result.state.timer.status, 'running');
    assert.equal(result.state.lastCompletion, null);
    assert.equal(result.state.cycle, 1);
    assert.equal(result.state.days[dayKey(now)].count, 1);
    assert.equal(h.badge.text, '25m');
    assert.equal(h.alarms.get('chromodoro-end').scheduledTime, now + 25 * 60000);

    // Mid-focus it restarts: the unfinished ten minutes are dropped, not banked.
    now += 10 * 60000;
    result = await h.message({ type: 'startFocus' });
    assert.equal(result.ok, true);
    assert.equal(result.state.timer.endsAt, now + 25 * 60000);
    assert.equal(result.state.cycle, 1);
    assert.equal(result.state.days[dayKey(now)].count, 1);

    // Skipping a break that is already running discards break time and records nothing.
    result = await finishFocus();
    assert.equal(result.state.cycle, 2);
    await h.message({ type: 'toggle' });
    now += 2 * 60000;
    result = await h.message({ type: 'startFocus' });
    assert.equal(result.state.timer.phase, 'focus');
    assert.equal(result.state.cycle, 2);
    assert.equal(result.state.days[dayKey(now)].count, 2);
    assert.equal(h.notifications.length, 2);

    // Skipped breaks do not disturb the long break owed after four focus sessions.
    result = await finishFocus();
    assert.equal(result.state.nextPhase, 'shortBreak');
    await h.message({ type: 'startFocus' });
    result = await finishFocus();
    assert.equal(result.state.cycle, 4);
    assert.equal(result.state.nextPhase, 'longBreak');
    assert.equal(result.state.days[dayKey(now)].count, 4);
  } finally {
    Date.now = realNow;
    delete globalThis.chrome;
  }
});

test('the notification and new tab alerts are independent settings', async () => {
  const realNow = Date.now;
  let now = new Date(2026, 8, 6, 9).getTime();
  Date.now = () => now;
  const h = chromeHarness();
  globalThis.chrome = h.chrome;
  const finish = async () => {
    await h.message({ type: 'toggle' });
    now = (await h.message({ type: 'get' })).state.timer.endsAt;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-end' });
    return h.message({ type: 'get' });
  };
  const setAlerts = (base, notify, newTab) => h.message({ type: 'settings', settings: { ...base, notify, newTab } });
  try {
    await import(`../background.js?alerts=${Math.random()}`);
    h.chrome.runtime.onInstalled.fire();
    const base = (await h.message({ type: 'get' })).state.settings;
    assert.deepEqual([base.notify, base.newTab], [true, true]);

    await setAlerts(base, false, true);
    await finish();
    assert.equal(h.tabs.length, 1);
    assert.equal(h.notifications.length, 0);
    assert.match(h.tabs[0].url, /alert\.html$/);
    assert.equal(h.tabs[0].active, true);

    await setAlerts(base, true, true);
    await finish();
    assert.equal(h.tabs.length, 2);
    assert.equal(h.notifications.length, 1);

    await setAlerts(base, false, false);
    const quiet = await finish();
    assert.equal(h.tabs.length, 2);
    assert.equal(h.notifications.length, 1);
    // Silence is only about the alert: the Pomodoro itself is still banked.
    assert.equal(quiet.state.days[dayKey(now)].count, 2);
  } finally {
    Date.now = realNow;
    delete globalThis.chrome;
  }
});

test('start break takes the break that is due, and abandons a live focus session', async () => {
  const realNow = Date.now;
  let now = new Date(2026, 8, 19, 9).getTime();
  Date.now = () => now;
  const h = chromeHarness();
  globalThis.chrome = h.chrome;
  try {
    await import(`../background.js?break=${Math.random()}`);
    h.chrome.runtime.onInstalled.fire();
    await h.message({ type: 'get' });

    // Nothing completed yet, so no long break is owed: a short one, from the menu itself.
    h.chrome.contextMenus.onClicked.fire({ menuItemId: 'startBreak' });
    let result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.phase, 'shortBreak');
    assert.equal(result.state.timer.status, 'running');
    assert.equal(result.state.timer.durationMs, 5 * 60000);

    // Mid-focus: the unfinished session is dropped, nothing is recorded or announced.
    await h.message({ type: 'startFocus' });
    now += 10 * 60000;
    result = await h.message({ type: 'startBreak' });
    assert.equal(result.state.timer.phase, 'shortBreak');
    assert.deepEqual(result.state.days, {});
    assert.equal(result.state.cycle, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.tabs.length, 0);

    // After a completed focus session with a long break owed, it is the long one.
    await h.message({ type: 'settings', settings: { ...result.state.settings, longEvery: 1 } });
    now = (await h.message({ type: 'startFocus' })).state.timer.endsAt;
    h.chrome.alarms.onAlarm.fire({ name: 'chromodoro-end' });
    result = await h.message({ type: 'get' });
    assert.equal(result.state.nextPhase, 'longBreak');
    h.chrome.contextMenus.onClicked.fire({ menuItemId: 'startBreak' });
    result = await h.message({ type: 'get' });
    assert.equal(result.state.timer.phase, 'longBreak');
    assert.equal(result.state.timer.durationMs, 15 * 60000);
    assert.equal(result.state.cycle, 1);
    assert.equal(result.state.days[dayKey(now)].count, 1);
  } finally {
    Date.now = realNow;
    delete globalThis.chrome;
  }
});
