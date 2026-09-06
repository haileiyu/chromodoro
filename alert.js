import { LABELS } from './timer.js';

const $ = id => document.getElementById(id);

async function request(type) {
  const response = await chrome.runtime.sendMessage({ type });
  if (!response?.ok) throw new Error(response?.error || 'The extension is unavailable.');
  return response.state;
}

function render(state) {
  const done = state.lastCompletion;
  const focus = done?.phase === 'focus';
  $('headline').textContent = !done ? 'Ready when you are' : focus ? 'Focus complete' : 'Break over';
  $('detail').textContent = done ? `${done.minutes} minutes` : '';
  const next = state.nextPhase;
  $('primary').textContent = `Start ${LABELS[next].toLowerCase()}`;
  $('primary').classList.toggle('break', next !== 'focus');
  $('primary').disabled = false;
  // Only worth offering when the queued phase is a break we could skip past.
  $('secondary').hidden = next === 'focus';
}

async function act(button, type) {
  button.disabled = true;
  try {
    await request(type);
    window.close();
  } catch (error) {
    button.disabled = false;
    $('detail').textContent = error.message;
  }
}

$('primary').addEventListener('click', () => act($('primary'), 'toggle'));
$('secondary').addEventListener('click', () => act($('secondary'), 'startFocus'));
// Starting a session anywhere -- this page, the toolbar, the context menu -- makes
// this page stale, so it closes itself rather than piling up one tab per session.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state?.newValue?.timer) window.close();
});
request('get').then(render).catch(error => { $('detail').textContent = error.message; });
