export const DEFAULTS = Object.freeze({ focus: 25, shortBreak: 5, longBreak: 15, longEvery: 4, notify: true, newTab: false });
export const ALERTS = Object.freeze(['notify', 'newTab']);
export const LABELS = Object.freeze({ focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' });

export function dayKey(time = Date.now()) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const HEATMAP_WEEKS = 53;

// Sunday-first columns ending with the week containing `now`. Dates are built by
// mutating a noon anchor, so a DST shift can never skip or repeat a day.
export function heatmapDays(now = Date.now(), weeks = HEATMAP_WEEKS) {
  const anchor = new Date(now);
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() - anchor.getDay() - (weeks - 1) * 7);
  const start = anchor.getDate();
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(anchor);
    date.setDate(start + i);
    return date;
  });
}

// Fixed buckets, not quartiles of the user's own max: a Pomodoro is a fixed unit
// of work, so a shade means the same thing in every month and for every user.
export function heatmapLevel(count) {
  return count ? (count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4) : 0;
}

export function initialState() {
  return { version: 2, settings: { ...DEFAULTS }, timer: null, nextPhase: 'focus', cycle: 0, days: {}, lastCompletion: null };
}

// Version 1 stored settings.notifications as a boolean; version 2 replaced it with
// settings.alert, which can also open a tab. Runs on every load, so an install that
// never opens the settings page is still migrated.
export function migrate(state) {
  const settings = state.settings;
  if (typeof settings.notifications === 'boolean') {
    settings.notify = settings.notifications;
    delete settings.notifications;
  }
  for (const key of ALERTS) if (typeof settings[key] !== 'boolean') settings[key] = DEFAULTS[key];
  state.version = 2;
  return state;
}

export function remainingMs(timer, now = Date.now()) {
  if (!timer) return 0;
  return Math.max(0, timer.status === 'running' ? timer.endsAt - now : timer.remainingMs);
}

// The deadline is authoritative. A late alarm never adds time or counts twice.
// The record belongs to the deadline's local date, even if Chrome wakes tomorrow.
export function settle(state, now = Date.now()) {
  const t = state.timer;
  if (!t || t.status !== 'running' || t.endsAt > now) return null;
  const completion = { id: t.id, phase: t.phase, endedAt: t.endsAt, minutes: t.durationMs / 60000 };
  if (t.phase === 'focus') {
    const key = dayKey(t.endsAt);
    const day = state.days[key] ?? { count: 0, minutes: 0 };
    state.days[key] = { count: day.count + 1, minutes: day.minutes + t.durationMs / 60000 };
    state.cycle += 1;
    state.nextPhase = state.cycle % state.settings.longEvery === 0 ? 'longBreak' : 'shortBreak';
  } else {
    state.nextPhase = 'focus';
  }
  state.timer = null;
  state.lastCompletion = completion;
  return completion;
}

export function toggle(state, now = Date.now(), id = crypto.randomUUID()) {
  const t = state.timer;
  if (!t) {
    const durationMs = state.settings[state.nextPhase] * 60000;
    state.timer = { id, phase: state.nextPhase, status: 'running', durationMs, remainingMs: durationMs, endsAt: now + durationMs };
    state.lastCompletion = null;
  } else if (t.status === 'running') {
    t.remainingMs = remainingMs(t, now);
    t.endsAt = null;
    t.status = 'paused';
  } else {
    t.endsAt = now + t.remainingMs;
    t.status = 'running';
  }
}

export function validateSettings(input) {
  const result = {};
  for (const [key, max] of [['focus', 180], ['shortBreak', 60], ['longBreak', 90], ['longEvery', 12]]) {
    const n = Number(input[key]);
    if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`${key} must be a whole number between 1 and ${max}.`);
    result[key] = n;
  }
  for (const key of ALERTS) {
    if (typeof input[key] !== 'boolean') throw new Error('Choose what happens when a session ends.');
    result[key] = input[key];
  }
  return result;
}

export function badge(state, now = Date.now()) {
  const t = state.timer;
  if (!t) return { text: state.lastCompletion ? '✓' : '', color: '#39745D', title: `Chromodoro · Click to start ${LABELS[state.nextPhase].toLowerCase()}. Right-click for stats.` };
  const minutes = Math.max(1, Math.ceil(remainingMs(t, now) / 60000));
  const paused = t.status === 'paused';
  return { text: `${minutes}m`, color: paused ? '#77736B' : t.phase === 'focus' ? '#C34F35' : '#39745D', title: `Chromodoro · ${LABELS[t.phase]} · ${minutes} min left${paused ? ' (paused)' : ''}. Click to ${paused ? 'resume' : 'pause'}. Right-click for stats.` };
}
