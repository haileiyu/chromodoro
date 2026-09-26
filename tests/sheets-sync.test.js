import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createSheetsSync, SHEETS_ALARM, validateConnection } from '../sheets-sync.js';

const connection = { url: 'https://script.google.com/macros/s/test-deployment/exec', token: 'a'.repeat(64) };
const source = '11111111-1111-4111-8111-111111111111';
const success = () => ({ ok: true, json: async () => ({ ok: true }) });
function harness(persisted = { state: { days: { '2026-09-01': { count: 2, minutes: 50 } } } }) {
  const alarms = new Map();
  const uploads = [];
  let allowed = true;
  const chrome = {
    storage: { local: {
      async get(key) { return { [key]: structuredClone(persisted[key]) }; },
      async set(value) { Object.assign(persisted, structuredClone(value)); },
      async remove(key) { delete persisted[key]; }
    } },
    alarms: {
      async get(key) { return alarms.get(key); },
      async create(key, value) { alarms.set(key, value); },
      async clear(key) { alarms.delete(key); }
    },
    permissions: {
      async contains() { return allowed; },
      async remove() { allowed = false; }
    }
  };
  const fetcher = async (url, options) => { uploads.push(JSON.parse(options.body)); return success(); };
  return { chrome, persisted, alarms, uploads, fetcher, allow: value => { allowed = value; } };
}

test('sync is opt-in, backfills daily totals, suppresses unchanged uploads and forgets credentials on disconnect', async () => {
  const h = harness();
  const sync = createSheetsSync(h.chrome, h.fetcher);
  await sync.kick();
  assert.equal(h.uploads.length, 0);
  assert.equal(h.alarms.size, 0);
  const status = await sync.connect(connection);
  assert.equal(status.enabled, true);
  assert.ok(status.lastSyncedAt);
  assert.equal(status.token, undefined);
  assert.deepEqual(h.uploads[0].rows, [['2026-09-01', 2, 50]]);
  assert.equal(h.alarms.get(SHEETS_ALARM).periodInMinutes, 5);
  const id = h.uploads[0].source;
  await Promise.all([sync.kick(), sync.kick()]);
  assert.equal(h.uploads.length, 1);
  h.persisted.state.days['2026-09-01'] = { count: 3, minutes: 75 };
  await sync.kick();
  assert.deepEqual(h.uploads[1].rows, [['2026-09-01', 3, 75]]);
  await sync.syncNow();
  assert.equal(h.uploads.length, 3);
  const local = structuredClone(h.persisted.state);
  assert.equal((await sync.disconnect()).enabled, false);
  assert.equal(h.persisted.sheetsSync, undefined);
  assert.equal(h.alarms.size, 0);
  assert.equal(await h.chrome.permissions.contains(), false);
  await sync.kick();
  assert.equal(h.uploads.length, 3);
  assert.deepEqual(h.persisted.state, local);
  h.allow(true);
  await sync.connect(connection);
  assert.equal(h.uploads[3].source, id);
});

test('failed uploads survive restart, back off, and upload the latest totals on retry', async () => {
  const h = harness();
  const local = structuredClone(h.persisted.state);
  const failed = createSheetsSync(h.chrome, async () => { throw new TypeError('offline'); });
  const status = await failed.connect(connection);
  assert.match(status.error, /retry/);
  assert.equal(status.lastSyncedAt, null);
  assert.equal(h.persisted.sheetsSync.snapshot, undefined);
  assert.deepEqual(h.persisted.state, local);
  // New worker with no alarms; durable backoff prevents a request storm.
  h.alarms.clear();
  const restarted = createSheetsSync(h.chrome, h.fetcher);
  await restarted.kick();
  assert.equal(h.uploads.length, 0);
  assert.ok(h.alarms.has(SHEETS_ALARM));
  h.persisted.state.days['2026-09-02'] = { count: 1, minutes: 15 };
  h.persisted.sheetsSync.retryAt = 0;
  await restarted.kick();
  assert.deepEqual(h.uploads[0].rows, [['2026-09-01', 2, 50], ['2026-09-02', 1, 15]]);
  assert.equal((await restarted.get()).error, '');
});

test('pending uploads serialize and a completion during upload is sent afterward', async () => {
  const h = harness();
  let release, started;
  const pending = new Promise(resolve => { release = resolve; });
  const start = new Promise(resolve => { started = resolve; });
  let count = 0;
  const sync = createSheetsSync(h.chrome, async (url, options) => {
    count++;
    if (count === 1) { started(); await pending; }
    return h.fetcher(url, options);
  });
  const connecting = sync.connect(connection);
  await start;
  h.persisted.state.days['2026-09-01'].count = 3;
  const next = sync.kick();
  assert.equal(count, 1);
  release();
  await Promise.all([connecting, next]);
  assert.equal(count, 2);
  assert.equal(h.uploads[0].rows[0][1], 2);
  assert.equal(h.uploads[1].rows[0][1], 3);
});

test('validates destinations and handles denied access, HTTP, timeout, invalid JSON, and rejected keys', async () => {
  for (const url of ['http://script.google.com/macros/s/id/exec', 'https://evil.test/exec', connection.url + '?token=x', connection.url.replace('/exec', '/dev')]) {
    assert.throws(() => validateConnection({ ...connection, url }), /deployed/);
  }
  assert.throws(() => validateConnection({ ...connection, token: 'short' }), /sync key/);
  const denied = harness();
  denied.allow(false);
  await assert.rejects(createSheetsSync(denied.chrome, denied.fetcher).connect(connection), /Allow Google/);
  assert.equal(denied.persisted.sheetsSync, undefined);
  for (const [fetcher, message] of [
    [async () => ({ ok: false, status: 503 }), /503/],
    [async () => { throw new DOMException('timeout', 'TimeoutError'); }, /retry/],
    [async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }), /Anyone/],
    [async () => ({ ok: true, json: async () => ({ ok: false, error: 'unauthorized' }) }), /key was rejected/]
  ]) {
    const h = harness();
    const status = await createSheetsSync(h.chrome, fetcher).connect(connection);
    assert.match(status.error, message);
    assert.equal(status.lastSyncedAt, null);
  }
});

test('a failed forced upload retries even if the previous snapshot was successful', async () => {
  const h = harness();
  let fail = false;
  const sync = createSheetsSync(h.chrome, async (...args) => {
    if (fail) throw new TypeError('offline');
    return h.fetcher(...args);
  });
  await sync.connect(connection);
  fail = true;
  await sync.syncNow();
  assert.match((await sync.get()).error, /retry/);
  h.persisted.sheetsSync.retryAt = 0;
  fail = false;
  await sync.kick();
  assert.equal(h.uploads.length, 2);
  assert.equal((await sync.get()).error, '');
});

function scriptHarness() {
  const sheets = new Map();
  let locked = false;
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'SYNC_TOKEN' ? connection.token : 'spreadsheet' }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    LockService: { getScriptLock: () => ({ waitLock() { locked = true; }, hasLock: () => locked, releaseLock() { locked = false; } }) },
    SpreadsheetApp: {
      flush() {},
      openById: () => ({
        getSheetByName: name => sheets.get(name),
        insertSheet(name) {
          const sheet = {
            values: [], getLastRow() { return this.values.length; }, getMaxRows: () => 1000,
            getDataRange() { return { getValues: () => structuredClone(this.values) }; },
            getRange() { return { setNumberFormat() {}, setValues: values => { this.values = structuredClone(values); } }; },
            setFrozenRows() {}
          };
          sheets.set(name, sheet);
          return sheet;
        }
      })
    }
  });
  vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const post = data => context.doPost({ postData: { contents: JSON.stringify({ version: 1, token: connection.token, source, ...data }) } });
  return { sheets, post, locked: () => locked };
}

test('receiver authenticates and rejects malformed data before touching the spreadsheet', () => {
  const h = scriptHarness();
  assert.equal(h.post({ token: 'wrong', rows: [] }).error, 'unauthorized');
  for (const rows of [[['2026-02-30', 1, 25]], [['=IMPORTXML("x")', 1, 25]], [['2026-09-01', -1, 25]], [['2026-09-01', 1, '25']], [['2026-09-01', 1, 25], ['2026-09-01', 2, 50]]]) {
    assert.equal(h.post({ rows }).error, 'invalid_data');
  }
  assert.equal(h.sheets.size, 0);
});

test('receiver upserts without duplicates, resists stale requests, and isolates Chrome profiles', () => {
  const h = scriptHarness();
  const first = { rows: [['2026-09-01', 2, 50]] };
  assert.equal(h.post(first).ok, true);
  assert.equal(h.post(first).ok, true);
  assert.equal(h.post({ rows: [['2026-09-01', 3, 75], ['2026-09-02', 1, 25]] }).ok, true);
  assert.equal(h.post(first).ok, true);
  const rows = h.sheets.get('Chromodoro ' + source).values;
  assert.deepEqual(rows, [['Date', 'Pomodoros', 'Focus minutes'], ['2026-09-01', 3, 75], ['2026-09-02', 1, 25]]);
  h.post({ source: '22222222-2222-4222-8222-222222222222', rows: [['2026-09-01', 1, 10]] });
  assert.equal(h.sheets.size, 2);
  assert.equal(h.locked(), false);
});
