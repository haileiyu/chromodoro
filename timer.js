export const DEFAULTS = Object.freeze({ focus: 25, shortBreak: 5, longBreak: 15, longEvery: 4, notifications: true });
export const LABELS = Object.freeze({ focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' });

export function dayKey(time = Date.now()) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function initialState() {
  return { version: 1, settings: { ...DEFAULTS }, timer: null, nextPhase: 'focus', cycle: 0, days: {}, lastCompletion: null };
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
  const completion = { id: t.id, phase: t.phase, endedAt: t.endsAt };
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
  if (typeof input.notifications !== 'boolean') throw new Error('Choose whether notifications are enabled.');
  result.notifications = input.notifications;
  return result;
}

export function badge(state, now = Date.now()) {
  const t = state.timer;
  if (!t) return { text: state.lastCompletion ? '✓' : '', color: '#39745D', title: `Pomelo · Click to start ${LABELS[state.nextPhase].toLowerCase()}. Right-click for stats.` };
  const minutes = Math.max(1, Math.ceil(remainingMs(t, now) / 60000));
  const paused = t.status === 'paused';
  return { text: `${minutes}m`, color: paused ? '#77736B' : t.phase === 'focus' ? '#C34F35' : '#39745D', title: `Pomelo · ${LABELS[t.phase]} · ${minutes} min left${paused ? ' (paused)' : ''}. Click to ${paused ? 'resume' : 'pause'}. Right-click for stats.` };
}
