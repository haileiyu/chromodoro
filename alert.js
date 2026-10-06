import { LABELS, dayKey } from './timer.js';

const $ = id => document.getElementById(id);
let currentState;

function renderToday() {
  if (!currentState) return;
  const count = currentState.days[dayKey()]?.count ?? 0;
  $('today-total').textContent = count.toLocaleString();
  $('today-total-label').textContent = `Pomodoro${count === 1 ? '' : 's'} completed today`;
}

async function request(type) {
  const response = await chrome.runtime.sendMessage({ type });
  if (!response?.ok) throw new Error(response?.error || 'The extension is unavailable.');
  return response.state;
}

function render(state) {
  currentState = state;
  renderToday();
  const done = state.lastCompletion;
  const focus = done?.phase === 'focus';
  $('headline').textContent = !done ? 'Timer idle' : focus ? 'Focus complete' : 'Break complete';
  $('detail').textContent = done ? `${done.minutes} minutes` : '';
  const next = state.nextPhase;
  $('primary').textContent = `Start ${LABELS[next].toLowerCase()}`;
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
  if (area !== 'local' || !changes.state?.newValue) return;
  if (changes.state.newValue.timer) window.close();
  else render(changes.state.newValue);
});
// An idle completion tab can stay open overnight or receive synced history.
setInterval(renderToday, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderToday();
});
request('get').then(render).catch(error => { $('detail').textContent = error.message; });
