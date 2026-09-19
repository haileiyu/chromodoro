import { initialState, migrate, settle, toggle, badge, validateSettings, LABELS } from './timer.js';

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
  migrate(state);
  const completion = settle(state);
  // Save completion before an action that might fail validation.
  if (completion) await chrome.storage.local.set({ state });
  if (action) action(state);
  if (JSON.stringify(state) !== before) await chrome.storage.local.set({ state });
  await syncChrome(state);
  if (completion) await announce(state, completion);
  return state;
}

// Never let a failed alert take the timer down with it: the session is already banked.
async function announce(state, completion) {
  const focus = completion.phase === 'focus';
  // Independent, so either can fail or be switched off without touching the other.
  if (state.settings.notify) {
    try {
      await chrome.notifications.create(`chromodoro-${completion.id}`, {
        type: 'basic', iconUrl: 'icons/icon128.png',
        title: focus ? 'One Pomodoro, nicely done.' : 'Break complete. Ready when you are.',
        message: focus ? 'Your focus session is saved. Click the Chromodoro icon to start your break.' : 'Click the Chromodoro icon to start your next focus session.'
      });
    } catch (error) { console.warn('Notification unavailable:', error); }
  }
  if (state.settings.newTab) {
    try {
      // chrome.tabs.create needs no "tabs" permission for an extension page of our own.
      await chrome.tabs.create({ url: chrome.runtime.getURL('alert.html'), active: true });
    } catch (error) { console.warn('Alert tab unavailable:', error); }
  }
}

async function setupMenus() {
  await chrome.contextMenus.removeAll();
  for (const [id, title] of [['startFocus', 'Start focusing'], ['startBreak', 'Start break'], ['history', 'Pomodoro history']]) {
    await new Promise((resolve, reject) => {
      chrome.contextMenus.create({ id, title, contexts: ['action'] }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve();
      });
    });
  }
}

const reset = state => { state.timer = null; state.nextPhase = 'focus'; state.lastCompletion = null; };
// Both replace whatever is running. That is deliberate: with no reset control left,
// they are also how a session gets abandoned. settle() has already banked anything that
// finished, so what gets dropped is unfinished time, which never counts. state.cycle is
// untouched, so the long-break schedule only ever moves on completed focus sessions.
const startFocus = state => {
  state.timer = null;
  state.nextPhase = 'focus';
  toggle(state);
};
const startBreak = state => {
  state.timer = null;
  // Take the break the cycle has queued; with focus queued there is none due, so a short one.
  if (state.nextPhase === 'focus') state.nextPhase = 'shortBreak';
  toggle(state);
};
const run = action => enqueue(() => transact(action));
// Settings are the options page, which Chrome lists as Options in this same menu;
// history is its own page so the two items do not open the same thing. Like
// openOptionsPage, an open history tab is focused rather than duplicated, which matters
// most for notification clicks. getContexts finds our own pages without "tabs".
const openHistory = async () => {
  const url = chrome.runtime.getURL('history.html');
  const [open] = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
  if (!open) return chrome.tabs.create({ url });
  await chrome.tabs.update(open.tabId, { active: true });
  await chrome.windows.update(open.windowId, { focused: true });
};

chrome.action.onClicked.addListener(() => { void run(state => toggle(state)); });
chrome.alarms.onAlarm.addListener(alarm => { if ([END, TICK].includes(alarm.name)) void run(); });
chrome.runtime.onInstalled.addListener(() => { void enqueue(async () => { await setupMenus(); await transact(); }); });
chrome.runtime.onStartup.addListener(() => { void enqueue(async () => { await setupMenus(); await transact(); }); });
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'startFocus') void run(startFocus);
  if (info.menuItemId === 'startBreak') void run(startBreak);
  if (info.menuItemId === 'history') void openHistory();
});
chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith('chromodoro-')) void openHistory();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (!['get', 'toggle', 'reset', 'phase', 'settings', 'startFocus', 'startBreak'].includes(message?.type)) return false;
  run(state => {
    if (message.type === 'toggle') toggle(state);
    if (message.type === 'reset') reset(state);
    if (message.type === 'startFocus') startFocus(state);
    if (message.type === 'startBreak') startBreak(state);
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
