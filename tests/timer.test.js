import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, toggle, settle, remainingMs, badge, dayKey, validateSettings, DEFAULTS } from '../timer.js';

test('badge rounds up: 16m, 15m, then 1m in the final minute', () => {
  const s = initialState();
  toggle(s, 0, 'session');
  assert.equal(badge(s, 9 * 60000).text, '16m');
  assert.equal(badge(s, 10 * 60000).text, '15m');
  assert.equal(badge(s, 24 * 60000 + 59000).text, '1m');
});

test('pause/resume excludes paused time, including after serialization', () => {
  const s = initialState();
  toggle(s, 0, 'session');
  toggle(s, 9 * 60000);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(remainingMs(restored.timer, 86400000), 16 * 60000);
  assert.equal(settle(restored, 86400000), null);
  toggle(restored, 86400000);
  assert.equal(restored.timer.endsAt, 86400000 + 16 * 60000);
  assert.equal(restored.timer.id, 'session');
});

test('late and duplicate completion events record exactly once', () => {
  const s = initialState();
  toggle(s, 0, 'session');
  assert.equal(settle(s, 25 * 60000 - 1), null);
  assert.equal(settle(s, 86400000).id, 'session');
  assert.equal(settle(s, 86400000), null);
  assert.deepEqual(s.days[dayKey(25 * 60000)], { count: 1, minutes: 25 });
  assert.equal(s.nextPhase, 'shortBreak');
});

test('completion belongs to local deadline date after a midnight crossing', () => {
  const s = initialState();
  const start = new Date(2026, 8, 5, 23, 50).getTime();
  toggle(s, start, 'overnight');
  settle(s, new Date(2026, 8, 7, 10).getTime());
  assert.deepEqual(s.days, { '2026-09-06': { count: 1, minutes: 25 } });
});

test('four focus sessions unlock a long break; breaks never count', () => {
  const s = initialState();
  let now = new Date(2026, 8, 5, 10).getTime();
  for (let n = 1; n <= 4; n++) {
    toggle(s, now, `focus-${n}`);
    now = s.timer.endsAt;
    settle(s, now);
    assert.equal(s.nextPhase, n === 4 ? 'longBreak' : 'shortBreak');
    toggle(s, now, `break-${n}`);
    now = s.timer.endsAt;
    settle(s, now);
    assert.equal(s.nextPhase, 'focus');
    assert.equal(s.days[dayKey(now)].count, n);
  }
  assert.equal(s.days[dayKey(now)].minutes, 100);
});

test('changing settings preserves the current session duration', () => {
  const s = initialState();
  toggle(s, 0, 'session');
  s.settings = validateSettings({ ...DEFAULTS, focus: 50 });
  settle(s, 25 * 60000);
  assert.equal(s.days[dayKey(25 * 60000)].minutes, 25);
  s.nextPhase = 'focus';
  toggle(s, 25 * 60000, 'next');
  assert.equal(s.timer.durationMs, 50 * 60000);
});

test('rejects invalid settings including fractions and extreme durations', () => {
  for (const value of [0, -1, 1.5, 181, 'invalid', Infinity]) {
    assert.throws(() => validateSettings({ ...DEFAULTS, focus: value }));
  }
  assert.throws(() => validateSettings({ ...DEFAULTS, notifications: 'yes' }));
  assert.deepEqual(validateSettings(DEFAULTS), DEFAULTS);
});
