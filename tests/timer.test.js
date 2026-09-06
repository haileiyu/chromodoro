import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, toggle, settle, remainingMs, badge, dayKey, validateSettings, migrate, DEFAULTS, heatmapDays, heatmapLevel, HEATMAP_WEEKS } from '../timer.js';

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
  for (const key of ['notify', 'newTab']) {
    assert.throws(() => validateSettings({ ...DEFAULTS, [key]: 'yes' }));
    assert.throws(() => validateSettings({ ...DEFAULTS, [key]: undefined }));
  }
  assert.deepEqual(validateSettings(DEFAULTS), DEFAULTS);
});

test('heatmap window is 53 whole Sunday-first weeks with no day skipped or repeated', () => {
  // Anchored across the US autumn DST change, where naive 86400000ms stepping drifts.
  const now = new Date(2026, 10, 4, 9).getTime();
  const days = heatmapDays(now);
  const keys = days.map(dayKey);
  assert.equal(days.length, HEATMAP_WEEKS * 7);
  assert.equal(days[0].getDay(), 0);
  assert.equal(days.at(-1).getDay(), 6);
  assert.ok(keys.includes(dayKey(now)));
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys, [...keys].sort());
  // Distinct and ascending over an exact 370-day span leaves no room for a gap.
  assert.equal(Math.round((days.at(-1) - days[0]) / 86400000), HEATMAP_WEEKS * 7 - 1);
  for (const date of days) assert.equal(date.getHours(), 12);
});

test('heatmap columns are week-aligned: today advances daily, the window turns over on Sunday', () => {
  const at = (day, hour) => heatmapDays(new Date(2026, 8, day, hour).getTime()).map(dayKey);
  // Tue and Wed of one week share a window; only today's position inside it moves.
  const tuesday = at(8, 10);
  assert.deepEqual(tuesday, at(9, 10));
  assert.equal(tuesday.indexOf('2026-09-09') - tuesday.indexOf('2026-09-08'), 1);
  // Both are still in the final column, so a rebuild must reveal the newly past day.
  assert.equal(tuesday.at(-1), '2026-09-12');
  const saturday = at(12, 23);
  const sunday = at(13, 0);
  assert.notDeepEqual(saturday, sunday);
  assert.equal(Math.round((new Date(`${sunday[0]}T12:00`) - new Date(`${saturday[0]}T12:00`)) / 86400000), 7);
});

test('heatmap levels are fixed buckets, not scaled to the busiest day', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 40].map(heatmapLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('version 1 settings.notifications migrates to the notify and newTab flags', () => {
  const legacy = on => ({ version: 1, settings: { focus: 25, shortBreak: 5, longBreak: 15, longEvery: 4, notifications: on }, timer: null, nextPhase: 'focus', cycle: 0, days: {}, lastCompletion: null });
  for (const on of [true, false]) {
    const migrated = migrate(legacy(on));
    assert.equal(migrated.version, 2);
    assert.equal(migrated.settings.notify, on);
    assert.equal(migrated.settings.newTab, on);
    assert.ok(!('notifications' in migrated.settings));
    assert.deepEqual(validateSettings(migrated.settings), migrated.settings);
  }
  // Already-migrated settings are left alone; a missing or broken flag falls back.
  const kept = migrate({ version: 2, settings: { ...DEFAULTS, notify: false, newTab: true } });
  assert.deepEqual([kept.settings.notify, kept.settings.newTab], [false, true]);
  assert.equal(migrate({ version: 2, settings: { ...DEFAULTS, notify: 'yes' } }).settings.notify, true);
  assert.equal(migrate({ version: 2, settings: { focus: 25, shortBreak: 5, longBreak: 15, longEvery: 4 } }).settings.newTab, true);
});
