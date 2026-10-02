import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, settle, toggle } from '../timer.js';
import { prepareHistory, recordCompletion, mergeRecords, historyDays, syncPlan, cutoffMonth, createHistorySync, PREFIX } from '../history-sync.js';

const now = new Date(2026, 9, 1, 12).getTime();
const realNow = Date.now;
test.before(() => { Date.now = () => now; });
test.after(() => { Date.now = realNow; });
const sourceA = '00000000-0000-4000-8000-000000000001';
const sourceB = '00000000-0000-4000-8000-000000000002';
const key = (source, month = '2026-10') => `${PREFIX}${source}:${month}`;
const stateFor = source => ({ ...initialState(), history: { source, records: {} } });
function complete(state, minutes = 25) {
  const started = new Date(2026, 9, 1, 9).getTime();
  state.settings.focus = minutes;
  state.nextPhase = 'focus';
  toggle(state, started);
  const completion = settle(state, started + minutes * 60000);
  recordCompletion(state, completion);
}

test('migration survives restart without importing remote totals or counting local days twice', () => {
  let state = { ...initialState(), days: { '2024-01-03': { count: 2, minutes: 40 }, '2026-10-01': { count: 3, minutes: 90 } } };
  prepareHistory(state);
  const identity = state.history.source;
  mergeRecords(state.history, { [key(sourceB)]: { 1: [4, 100] } });
  state.days = historyDays(state.history);
  state = JSON.parse(JSON.stringify(state));
  prepareHistory(state);
  assert.equal(state.history.source, identity);
  assert.deepEqual(historyDays(state.history), { '2024-01-03': { count: 2, minutes: 40 }, '2026-10-01': { count: 7, minutes: 190 } });
  const { updates } = syncPlan(state.history, {}, now);
  assert.deepEqual(Object.keys(updates), [key(identity)]);
  assert.deepEqual(updates[key(identity)], { 1: [3, 90] });
});

test('two offline devices converge after delayed, duplicate, and reordered snapshots', () => {
  const a = stateFor(sourceA), b = stateFor(sourceB);
  complete(a, 25);
  complete(b, 45);
  const staleA = structuredClone(a.history.records);
  complete(a, 30);
  const latestA = structuredClone(a.history.records);
  mergeRecords(a.history, b.history.records);
  mergeRecords(b.history, latestA);
  mergeRecords(b.history, staleA);
  mergeRecords(b.history, latestA);
  mergeRecords(a.history, b.history.records);
  assert.deepEqual(historyDays(a.history), { '2026-10-01': { count: 3, minutes: 100 } });
  assert.deepEqual(historyDays(a.history), historyDays(b.history));
  assert.deepEqual(Object.keys(syncPlan(a.history, {}, now).updates), [key(sourceA)]);
  assert.deepEqual(Object.keys(syncPlan(b.history, {}, now).updates), [key(sourceB)]);
});

test('retention spans exactly 24 calendar months and never removes the local archive', () => {
  const state = stateFor(sourceA);
  const remote = {
    [key(sourceA, '2024-10')]: { 31: [1, 25] },
    [key(sourceA, '2024-11')]: { 1: [2, 50] },
    [key(sourceB, '2024-09')]: { 1: [3, 75] },
    unrelated: { keep: true }
  };
  mergeRecords(state.history, remote);
  assert.equal(cutoffMonth(now), '2024-11');
  assert.equal(cutoffMonth(new Date(2026, 0, 31).getTime()), '2024-02');
  assert.deepEqual(syncPlan(state.history, remote, now).expired.sort(), [key(sourceA, '2024-10'), key(sourceB, '2024-09')].sort());
  assert.equal(Object.keys(historyDays(state.history)).length, 3);
});

test('malformed or unrelated sync data cannot poison totals', () => {
  const state = stateFor(sourceA);
  mergeRecords(state.history, {
    settings: { 1: [100, 2500] },
    [key(sourceB, '2026-02')]: { 1: [2, 40], 2: [-1, 25], 3: [1, Infinity], 4: [1], 5: [0, 0], 29: [1, 25], '01': [1, 25] },
    [key(sourceA)]: null
  });
  assert.deepEqual(historyDays(state.history), { '2026-02-01': { count: 2, minutes: 40 } });
});

function syncHarness(remote = {}) {
  let local;
  const writes = [];
  const chrome = { storage: {
    local: { async set({ state }) { local = structuredClone(state); writes.push('local'); } },
    sync: {
      async get() { return structuredClone(remote); },
      async set(updates) { Object.assign(remote, structuredClone(updates)); writes.push('sync'); },
      async remove(keys) { for (const item of keys) delete remote[item]; writes.push('remove'); }
    }
  } };
  return { chrome, remote, writes, saved: () => local };
}

test('sync failures retain completed sessions and retry safely across worker restart', async () => {
  const state = stateFor(sourceA);
  complete(state);
  const h = syncHarness();
  const originalSet = h.chrome.storage.sync.set;
  h.chrome.storage.sync.set = async () => { throw new Error('Network unavailable'); };
  await createHistorySync(h.chrome)(state, true);
  assert.equal(h.saved().historySync.status, 'pending');
  assert.deepEqual(h.saved().days['2026-10-01'], { count: 1, minutes: 25 });
  h.chrome.storage.sync.set = originalSet;
  const restarted = h.saved();
  prepareHistory(restarted);
  const sync = createHistorySync(h.chrome);
  await sync(restarted, true);
  await sync(restarted, true);
  assert.equal(restarted.historySync.status, 'ready');
  assert.deepEqual(h.remote[key(sourceA)], { 1: [1, 25] });
  assert.equal(h.writes.filter(value => value === 'sync').length, 1);
});

test('quota errors preserve local and received history, distinguishing capacity from throttling', async () => {
  for (const [error, status] of [['QUOTA_BYTES quota exceeded', 'limited'], ['MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded', 'pending']]) {
    const state = stateFor(sourceA);
    complete(state);
    const h = syncHarness({ [key(sourceB)]: { 1: [2, 40] } });
    h.chrome.storage.sync.set = async () => { throw new Error(error); };
    await createHistorySync(h.chrome)(state, true);
    assert.equal(h.saved().historySync.status, status);
    assert.deepEqual(h.saved().days['2026-10-01'], { count: 3, minutes: 65 });
  }
});

test('a new installation restores available history without publishing it as its own work', async () => {
  const state = initialState();
  prepareHistory(state);
  const h = syncHarness({ [key(sourceB)]: { 1: [2, 40] } });
  const sync = createHistorySync(h.chrome);
  await sync(state, true);
  assert.deepEqual(state.days, { '2026-10-01': { count: 2, minutes: 40 } });
  assert.equal(h.writes.includes('sync'), false);
  complete(state, 25);
  await sync(state, true);
  assert.deepEqual(state.days, { '2026-10-01': { count: 3, minutes: 65 } });
  assert.deepEqual(h.remote[key(state.history.source)], { 1: [1, 25] });
  assert.deepEqual(h.remote[key(sourceB)], { 1: [2, 40] });
});

test('expired records are archived before removal; archive failure cannot delete remote history', async () => {
  const expired = key(sourceB, '2020-01');
  const state = stateFor(sourceA);
  const h = syncHarness({ [expired]: { 1: [2, 50] } });
  await createHistorySync(h.chrome)(state, true);
  assert.deepEqual(h.writes.slice(0, 2), ['local', 'remove']);
  assert.equal(h.remote[expired], undefined);
  assert.deepEqual(h.saved().days['2020-01-01'], { count: 2, minutes: 50 });
  const broken = syncHarness({ [expired]: { 1: [2, 50] } });
  broken.chrome.storage.local.set = async () => { throw new Error('Local storage failed'); };
  await assert.rejects(createHistorySync(broken.chrome)(stateFor(sourceA), true), /Local storage failed/);
  assert.ok(broken.remote[expired]);
});

test('compact monthly records fit Chrome limits for five devices over 24 months', () => {
  const remote = {};
  for (let source = 0; source < 5; source++) {
    for (let month = 0; month < 24; month++) {
      const date = new Date(2026, 9 - month, 1);
      const id = `00000000-0000-4000-8000-${String(source).padStart(12, '0')}`;
      const record = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, [8, 200]]));
      const name = key(id, `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      assert.ok(name.length + JSON.stringify(record).length < 8192);
      remote[name] = record;
    }
  }
  assert.ok(Object.keys(remote).length < 512);
  assert.ok(Object.entries(remote).reduce((sum, [name, record]) => sum + name.length + JSON.stringify(record).length, 0) < 102400);
});
