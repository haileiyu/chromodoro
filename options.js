import { ALERTS } from './timer.js';
import { $, report, request } from './page.js';
import { SHEETS_ORIGINS, validateConnection } from './sheets-sync.js';

const form = $('settings-form');

function fill(state) {
  for (const [key, value] of Object.entries(state.settings)) {
    if (typeof value === 'boolean') form.elements[key].checked = value;
    else form.elements[key].value = value;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const settings = Object.fromEntries(['focus', 'shortBreak', 'longBreak', 'longEvery'].map(key => [key, Number(form.elements[key].value)]));
  for (const key of ALERTS) settings[key] = form.elements[key].checked;
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    await request('settings', { settings });
    $('save-status').textContent = 'Saved';
  } catch (error) { report(error); } finally { button.disabled = false; }
});
form.addEventListener('input', () => { $('save-status').textContent = ''; });
request('get').then(fill).catch(report);

const sheetsForm = $('sheets-form');
function syncStatusText(status) {
  return !status.enabled ? 'Google Sheets backup is off. History is saved only on this computer.'
    : status.error ? status.error
      : status.lastSyncedAt ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}.`
        : 'Connected. Waiting to sync.';
}
function showSync(status) {
  sheetsForm.elements.url.value = status.url;
  sheetsForm.elements.token.value = '';
  sheetsForm.querySelector('[type=submit]').textContent = status.enabled ? 'Reconnect' : 'Connect';
  $('sheets-now').hidden = $('sheets-disconnect').hidden = !status.enabled;
  $('sheets-status').textContent = syncStatusText(status);
}
async function syncAction(action) {
  const controls = [...sheetsForm.querySelectorAll('button, input')];
  controls.forEach(control => { control.disabled = true; });
  $('sheets-status').textContent = 'Working…';
  try { showSync(await action()); } catch (error) {
    $('sheets-status').textContent = error.message;
    report(error);
  } finally { controls.forEach(control => { control.disabled = false; }); }
}
sheetsForm.addEventListener('submit', event => {
  event.preventDefault();
  let connection;
  try { connection = validateConnection({ url: sheetsForm.elements.url.value, token: sheetsForm.elements.token.value }); }
  catch (error) { report(error); return; }
  // Request directly in the click/submit gesture, before any await.
  const permission = chrome.permissions.request({ origins: SHEETS_ORIGINS });
  void syncAction(async () => {
    if (!await permission) throw new Error('Google access was not granted. Your history remains local.');
    return request('sheetsConnect', { connection });
  });
});
$('sheets-now').addEventListener('click', () => { void syncAction(() => request('sheetsNow')); });
$('sheets-disconnect').addEventListener('click', () => { void syncAction(() => request('sheetsDisconnect')); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.sheetsSync) {
    // Refresh status only; a background retry must not overwrite connection edits.
    request('sheetsGet').then(status => {
      $('sheets-status').textContent = syncStatusText(status);
    }).catch(report);
  }
});
request('sheetsGet').then(showSync).catch(report);
