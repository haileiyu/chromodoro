import { ALERTS } from './timer.js';
import { $, report, request } from './page.js';

const form = $('settings-form');

function fill(state) {
  for (const [key, value] of Object.entries(state.settings)) {
    if (typeof value === 'boolean') form.elements[key].checked = value;
    else form.elements[key].value = value;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const settings = Object.fromEntries(['focus', 'shortBreak', 'longBreak', 'longEvery', 'dailyTarget'].map(key => [key, Number(form.elements[key].value)]));
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

async function refreshShortcuts() {
  try {
    const commands = await chrome.commands.getAll();
    for (const [name, id] of [['startFocus', 'shortcut-focus'], ['startBreak', 'shortcut-break']]) {
      $(id).textContent = commands.find(command => command.name === name)?.shortcut || 'Not assigned';
    }
  } catch {
    $('shortcut-focus').textContent = 'Unavailable';
    $('shortcut-break').textContent = 'Unavailable';
  }
}

$('customize-shortcuts').addEventListener('click', async () => {
  $('shortcut-error').hidden = true;
  try {
    await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } catch {
    $('shortcut-error').textContent = 'Open chrome://extensions/shortcuts in Chrome to customize your shortcuts.';
    $('shortcut-error').hidden = false;
  }
});
// Chrome owns the bindings; re-read them when returning from its shortcut editor.
window.addEventListener('focus', refreshShortcuts);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refreshShortcuts();
});
void refreshShortcuts();
