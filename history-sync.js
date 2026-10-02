import { dayKey } from './timer.js';

export const SYNC_ALARM = 'chromodoro-history-sync';
export const PREFIX = 'history.v1:';
const KEY = /^history\.v1:([a-f0-9-]{36}):(\d{4}-(?:0[1-9]|1[0-2]))$/;

export function cutoffMonth(now = Date.now()) {
  const date = new Date(now);
  date.setDate(1);
  date.setMonth(date.getMonth() - 23);
  return dayKey(date).slice(0, 7);
}

function keyFor(source, date) { return `${PREFIX}${source}:${date.slice(0, 7)}`; }

// Migrate only local history, before any remote records are read. The identity,
// ledger, and timer are saved together, so a worker restart cannot import twice.
export function prepareHistory(state) {
  if (state.history) return;
  state.history = { source: crypto.randomUUID(), records: {} };
  for (const [date, value] of Object.entries(state.days)) {
    const key = keyFor(state.history.source, date);
    (state.history.records[key] ??= {})[Number(date.slice(8))] = [value.count, value.minutes];
  }
}

export function recordCompletion(state, completion) {
  if (completion?.phase !== 'focus') return;
  const date = dayKey(completion.endedAt);
  const record = state.history.records[keyFor(state.history.source, date)] ??= {};
  const day = Number(date.slice(8));
  const previous = record[day] ?? [0, 0];
  record[day] = [previous[0] + 1, previous[1] + completion.minutes];
}

// Each installation is the sole writer of its monthly records. Maxima merge
// repeated, delayed, or out-of-order snapshots without replaying increments.
export function mergeRecords(history, incoming) {
  for (const [key, record] of Object.entries(incoming)) {
    const match = KEY.exec(key);
    if (!match || !record || typeof record !== 'object' || Array.isArray(record)) continue;
    const [year, month] = match[2].split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    for (const [day, pair] of Object.entries(record)) {
      if (!/^[1-9]\d?$/.test(day) || Number(day) > lastDay || !Array.isArray(pair) || pair.length !== 2 ||
          !Number.isSafeInteger(pair[0]) || pair[0] < 1 || !Number.isFinite(pair[1]) || pair[1] < 0) continue;
      const target = history.records[key] ??= {};
      const previous = target[day] ?? [0, 0];
      target[day] = [Math.max(previous[0], pair[0]), Math.max(previous[1], pair[1])];
    }
  }
}

export function historyDays(history) {
  const days = {};
  for (const [key, record] of Object.entries(history.records)) {
    const month = KEY.exec(key)?.[2];
    if (!month) continue;
    for (const [day, [count, minutes]] of Object.entries(record)) {
      const date = `${month}-${day.padStart(2, '0')}`;
      const total = days[date] ??= { count: 0, minutes: 0 };
      total.count += count;
      total.minutes += minutes;
    }
  }
  return days;
}

export function syncPlan(history, remote, now = Date.now()) {
  const cutoff = cutoffMonth(now);
  const updates = {};
  for (const [key, record] of Object.entries(history.records)) {
    const match = KEY.exec(key);
    if (match?.[1] !== history.source || match[2] < cutoff) continue;
    if (JSON.stringify(record) !== JSON.stringify(remote[key])) updates[key] = record;
  }
  const expired = Object.keys(remote).filter(key => {
    const match = KEY.exec(key);
    return match && match[2] < cutoff;
  });
  return { updates, expired };
}

// Chrome does not expose whether these writes have reached another device or
// whether account sync is enabled. "ready" means accepted by storage.sync only.
export function createHistorySync(chrome) {
  let nextAttempt = 0;
  return async (state, force = false) => {
    if (!force && Date.now() < nextAttempt) return;
    nextAttempt = Date.now() + 60000;
    try {
      const remote = await chrome.storage.sync.get(null);
      mergeRecords(state.history, remote);
      state.days = historyDays(state.history);
      // Archive received records before removing expired sync data or publishing.
      await chrome.storage.local.set({ state });
      const { updates, expired } = syncPlan(state.history, remote);
      if (expired.length) await chrome.storage.sync.remove(expired);
      if (Object.keys(updates).length) await chrome.storage.sync.set(updates);
      state.historySync = { status: 'ready' };
    } catch (error) {
      state.historySync = { status: /QUOTA_BYTES|MAX_ITEMS|storage.*full/i.test(error.message || '') ? 'limited' : 'pending' };
    }
    await chrome.storage.local.set({ state });
  };
}
