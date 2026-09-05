import { initialState, settle, toggle, badge, validateSettings, LABELS } from './timer.js';

const END = 'chromodoro-end';
const TICK = 'chromodoro-tick';
let queue = Promise.resolve();

// Serialize read/modify/write across toolbar clicks, alarms, and settings tabs.
function enqueue(task) {
  const result = queue.then(task);
  queue = result.catch(error => console.error('Chromodoro:', error));
  return result;
}

async function syncChrome(state) {
  const view = badge(state);
  await Promise.all([
    chrome.action.setBadgeText({ text: view.text }),
    chrome.action.setBadgeBackgroundColor({ color: view.color }),
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' }),
    chrome.action.setTitle({ title: view.title })
  ]);
  if (state.timer?.status === 'running') {
    const [end, tick] = await Promise.all([chrome.alarms.get(END), chrome.alarms.get(TICK)]);
    if (!end || end.scheduledTime !== state.timer.endsAt) await chrome.alarms.create(END, { when: state.timer.endsAt });
    if (!tick) await chrome.alarms.create(TICK, { periodInMinutes: 0.5 });
  } else {
    await Promise.all([chrome.alarms.clear(END), chrome.alarms.clear(TICK)]);
  }
}

async function transact(action) {
  const stored = await chrome.storage.local.get('state');
  const state = stored.state ?? initialState();
  const before = JSON.stringify(stored.state);
  const completion = settle(state);
  // Save completion before an action that might fail validation.
  if (completion) await chrome.storage.local.set({ state });
  if (action) action(state);
  if (JSON.stringify(state) !== before) await chrome.storage.local.set({ state });
  await syncChrome(state);
  if (completion && state.settings.notifications) {
    try {
      await chrome.notifications.create(`chromodoro-${completion.id}`, {
        type: 'basic', iconUrl: 'icons/icon128.png',
        title: completion.phase === 'focus' ? 'One Pomodoro, nicely done.' : 'Break complete. Ready when you are.',
        message: completion.phase === 'focus' ? 'Your focus session is saved. Click the Chromodoro icon to start your break.' : 'Click the Chromodoro icon to start your next focus session.'
      });
    } catch (error) { console.warn('Notification unavailable:', error); }
  }
  return state;
}

async function setupMenus() {
  await chrome.contextMenus.removeAll();
  for (const [id, title] of [['dashboard', 'Stats & settings'], ['toggle', 'Start / pause / resume'], ['reset', 'Reset timer (discard this session)']]) {
    await new Promise((resolve, reject) => {
      chrome.contextMenus.create({ id, title, contexts: ['action'] }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve();
      });
    });
  }
}

const reset = state => { state.timer = null; state.nextPhase = 'focus'; state.lastCompletion = null; };
const run = action => enqueue(() => transact(action));

chrome.action.onClicked.addListener(() => { void run(state => toggle(state)); });
chrome.alarms.onAlarm.addListener(alarm => { if ([END, TICK].includes(alarm.name)) void run(); });
chrome.runtime.onInstalled.addListener(() => { void enqueue(async () => { await setupMenus(); await transact(); }); });
chrome.runtime.onStartup.addListener(() => { void enqueue(async () => { await setupMenus(); await transact(); }); });
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'dashboard') void chrome.runtime.openOptionsPage();
  if (info.menuItemId === 'toggle') void run(state => toggle(state));
  if (info.menuItemId === 'reset') void run(reset);
});
chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith('chromodoro-')) void chrome.runtime.openOptionsPage();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (!['get', 'toggle', 'reset', 'phase', 'settings'].includes(message?.type)) return false;
  run(state => {
    if (message.type === 'toggle') toggle(state);
    if (message.type === 'reset') reset(state);
    if (message.type === 'phase') {
      if (state.timer) throw new Error('Reset the current timer before changing sessions.');
      if (!Object.hasOwn(LABELS, message.phase)) throw new Error('Unknown session type.');
      state.nextPhase = message.phase;
      state.lastCompletion = null;
    }
    if (message.type === 'settings') {
      state.settings = validateSettings(message.settings);
      if (!state.timer && state.lastCompletion?.phase === 'focus') state.nextPhase = state.cycle % state.settings.longEvery === 0 ? 'longBreak' : 'shortBreak';
    }
  }).then(state => sendResponse({ ok: true, state }), error => sendResponse({ ok: false, error: error.message }));
  return true;
});

// Every worker wake repairs alarms if Chrome cleared them. No in-memory timer.
void run();
