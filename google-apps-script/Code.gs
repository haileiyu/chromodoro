// Paste into Extensions → Apps Script in the destination spreadsheet.
// Run setup once in the editor, then deploy as a web app (execute as Me,
// access Anyone). Requests require the secret key; the spreadsheet stays private.
function setup() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty('SYNC_TOKEN') || Utilities.getUuid() + Utilities.getUuid();
  properties.setProperties({ SYNC_TOKEN: token, SPREADSHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId() });
  console.log('Your Chromodoro sync key: ' + token);
}

function doPost(event) {
  const json = value => ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  let lock;
  try {
    const body = event?.postData?.contents || '';
    if (body.length > 2000000) return json({ ok: false, error: 'invalid_data' });
    const data = JSON.parse(body);
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty('SYNC_TOKEN');
    if (!token || data.token !== token) return json({ ok: false, error: 'unauthorized' });
    if (data.version !== 1 || !/^[a-f0-9-]{36}$/.test(data.source) || !Array.isArray(data.rows) || data.rows.length > 20000) {
      return json({ ok: false, error: 'invalid_data' });
    }
    const dates = new Set();
    for (const row of data.rows) {
      if (!Array.isArray(row) || row.length !== 3) return json({ ok: false, error: 'invalid_data' });
      const [date, count, minutes] = row;
      const parsed = new Date(date + 'T12:00:00Z');
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ||
          dates.has(date) || !Number.isSafeInteger(count) || count < 0 || typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
        return json({ ok: false, error: 'invalid_data' });
      }
      dates.add(date);
    }
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const spreadsheet = SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
    // One tab per Chrome profile. Separate devices cannot overwrite each other's totals.
    const name = 'Chromodoro ' + data.source;
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    const headers = ['Date', 'Pomodoros', 'Focus minutes'];
    const existing = sheet.getLastRow() ? sheet.getDataRange().getValues() : [];
    if (existing.length && headers.some((header, i) => existing[0][i] !== header)) {
      return json({ ok: false, error: 'unexpected_headers' });
    }
    const totals = new Map(existing.slice(1).filter(row => row[0]).map(row => [String(row[0]), row.slice(0, 3)]));
    for (const row of data.rows) {
      const previous = totals.get(row[0]);
      // Counters only grow. A timed-out older request arriving after its retry
      // cannot lower totals, and retrying never appends duplicate dates.
      totals.set(row[0], previous ? [row[0], Math.max(previous[1], row[1]), Math.max(previous[2], row[2])] : row);
    }
    const rows = [...totals.values()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const values = [headers, ...rows];
    if (values.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
    sheet.getRange(1, 1, values.length, 1).setNumberFormat('@');
    sheet.getRange(1, 1, values.length, 3).setValues(values);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'sync_failed' });
  } finally {
    if (lock?.hasLock()) lock.releaseLock();
  }
}
