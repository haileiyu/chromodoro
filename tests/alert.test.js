import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { initialState, toggle, settle, dayKey, LABELS } from '../timer.js';

test('completion page shows daily goal progress, live changes, and midnight rollover', async () => {
  let now = new Date(2026, 9, 5, 10).getTime();
  const state = initialState();
  state.settings.dailyTarget = 10;
  state.days[dayKey(now)] = { count: 4, minutes: 100 };
  toggle(state, now, 'fifth');
  now = state.timer.endsAt;
  settle(state, now);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener() {} });
    return elements.get(id);
  };
  let onStorage, onInterval, onVisibility;
  let closed = false;
  const source = readFileSync(new URL('../alert.js', import.meta.url), 'utf8');
  runInNewContext(source.replace(/^import .*;\n/, ''), {
    LABELS, dayKey: () => dayKey(now),
    document: { getElementById: element, hidden: false, addEventListener: (_, fn) => { onVisibility = fn; } },
    chrome: {
      runtime: { sendMessage: async () => ({ ok: true, state: structuredClone(state) }) },
      storage: { onChanged: { addListener: fn => { onStorage = fn; } } }
    },
    window: { close: () => { closed = true; } },
    setInterval: fn => { onInterval = fn; }
  });
  await new Promise(resolve => setImmediate(resolve));
  const text = () => element('today-total').textContent;
  const update = () => onStorage({ state: { newValue: structuredClone(state) } }, 'local');
  assert.equal(text(), '5/10'); // Includes the session that just finished.
  assert.equal(element('headline').textContent, 'Focus complete');
  toggle(state, now, 'break');
  now = state.timer.endsAt;
  settle(state, now);
  update();
  assert.equal(element('headline').textContent, 'Break complete');
  assert.equal(text(), '5/10'); // Breaks do not advance the goal.
  state.days[dayKey(now)] = { count: 11, minutes: 275 };
  update();
  assert.equal(text(), '11/10'); // Synced totals can exceed the target.
  state.settings.dailyTarget = 12;
  update();
  assert.equal(text(), '11/12');
  now = new Date(2026, 9, 6, 0).getTime();
  onInterval();
  assert.equal(text(), '0/12');
  now = new Date(2026, 9, 5, 23).getTime();
  onVisibility();
  assert.equal(text(), '11/12');
  state.settings.dailyTarget = 0;
  update();
  assert.equal(text(), '11');
  assert.equal(closed, false);
  toggle(state, now, 'next-focus');
  update();
  assert.equal(closed, true);
});
