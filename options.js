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
