import { dayKey, remainingMs, LABELS } from './timer.js';

const $ = id => document.getElementById(id);
const form = $('settings-form');
let state;
let formInitialized = false;
let lastDate = dayKey();
let reconciling = false;

function report(error) {
  $('error').textContent = error.message || String(error);
  $('error').hidden = false;
}

async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'The extension is unavailable. Reload this page and try again.');
  $('error').hidden = true;
  state = response.state;
  render();
  return state;
}

function minutesLabel(value) {
  return value >= 60 ? `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ''}` : `${value} min`;
}

function recentDays(count) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - i - 1));
    return date;
  });
}

function renderTimer() {
  if (!state) return;
  const t = state.timer;
  const phase = t?.phase ?? state.nextPhase;
  const ms = t ? remainingMs(t) : state.settings[phase] * 60000;
  const seconds = Math.ceil(ms / 1000);
  const paused = t?.status === 'paused';
  const focus = phase === 'focus';
  $('countdown').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('status').textContent = t ? (paused ? 'Paused' : focus ? 'Focusing' : 'On a break') : 'Ready';
  $('timer-label').textContent = focus ? 'Time to focus' : 'Room to recharge';
  $('timer-caption').textContent = paused ? 'Take your time. Resume when ready.' : t ? (focus ? 'Just this one thing.' : 'Step away. Stretch. Breathe.') : state.lastCompletion ? (focus ? 'A fresh mind. A new session.' : 'Well done. You’ve earned a break.') : 'A fresh start, whenever you’re ready.';
  $('toggle').textContent = t ? (paused ? 'Resume session' : 'Pause session') : `Start ${LABELS[phase].toLowerCase()} ↗`;
  $('toggle').classList.toggle('break', !focus);
  $('toggle').disabled = false;
  $('reset').disabled = !t;
  $('dial').style.setProperty('--progress', `${t ? Math.max(0, Math.min(360, (1 - ms / t.durationMs) * 360)) : 0}deg`);
  $('dial').style.setProperty('--ring', focus ? '#bb513b' : '#39745d');
  document.querySelectorAll('[data-phase]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.phase === phase));
    button.disabled = !!t;
  });
  document.title = t ? `${$('countdown').textContent}${paused ? ' · Paused' : ''} · Pomelo` : 'Pomelo · Your focus, day by day';
  if (t?.status === 'running' && ms === 0 && !reconciling) {
    reconciling = true;
    request('get').catch(report).finally(() => { reconciling = false; });
  }
}

function renderStats() {
  const today = dayKey();
  const todayStats = state.days[today] ?? { count: 0, minutes: 0 };
  const dates = recentDays(7);
  const counts = dates.map(date => state.days[dayKey(date)]?.count ?? 0);
  const weekCount = counts.reduce((a, b) => a + b, 0);
  const totals = Object.values(state.days).reduce((sum, day) => ({ count: sum.count + day.count, minutes: sum.minutes + day.minutes }), { count: 0, minutes: 0 });
  $('today-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  $('today-count').textContent = todayStats.count;
  $('today-minutes').textContent = `${minutesLabel(todayStats.minutes)} of focus`;
  $('week-count').textContent = weekCount;
  $('total-count').textContent = totals.count;
  $('total-minutes').textContent = `${minutesLabel(totals.minutes)} of focus`;
  const shortDate = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('week-range').textContent = `${shortDate(dates[0])} – ${shortDate(dates[6])}`;
  const max = Math.max(...counts, 4);
  $('chart').replaceChildren(...dates.map((date, i) => {
    const item = document.createElement('div');
    item.className = `chart-day${i === 6 ? ' today' : ''}`;
    item.title = `${shortDate(date)}: ${counts[i]} Pomodoros`;
    item.setAttribute('aria-label', item.title);
    const slot = document.createElement('div');
    slot.className = 'bar-slot';
    const value = document.createElement('span');
    value.className = 'bar-value';
    value.textContent = counts[i];
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(3, counts[i] / max * 90)}px`;
    slot.append(value, bar);
    const label = document.createElement('span');
    label.className = 'day-name';
    label.textContent = i === 6 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' });
    item.append(slot, label);
    return item;
  }));
  $('chart-caption').textContent = weekCount ? `${weekCount} Pomodoro${weekCount === 1 ? '' : 's'} this week. Every session is a little step forward.` : 'Your first Pomodoro is a good place to start.';
  const cycleTotal = state.settings.longEvery;
  const cycleDone = state.cycle % cycleTotal || (state.nextPhase === 'longBreak' || state.timer?.phase === 'longBreak' ? cycleTotal : 0);
  $('cycle-dots').replaceChildren(...Array.from({ length: cycleTotal }, (_, i) => {
    const dot = document.createElement('span');
    dot.className = `cycle-dot${i < cycleDone ? ' done' : ''}`;
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  }));
  $('cycle-dots').setAttribute('aria-label', `${cycleDone} of ${cycleTotal} Pomodoros toward a long break`);
  $('cycle-label').textContent = `Long break after ${cycleTotal} Pomodoro${cycleTotal === 1 ? '' : 's'}`;
  renderHistory();
}

function renderHistory() {
  if (!state) return;
  const selected = $('history-month').value;
  if (!/^\d{4}-\d{2}$/.test(selected)) return;
  const [year, month] = selected.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = dayKey();
  const rows = [];
  for (let n = daysInMonth; n >= 1; n--) {
    const key = `${selected}-${String(n).padStart(2, '0')}`;
    if (key > today) continue;
    const date = new Date(year, month - 1, n, 12);
    const day = state.days[key] ?? { count: 0, minutes: 0 };
    const row = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = `${key === today ? 'Today · ' : ''}${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
    const count = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `count-pill${day.count ? ' nonzero' : ''}`;
    pill.textContent = day.count;
    count.append(pill);
    const minutes = document.createElement('td');
    minutes.textContent = minutesLabel(day.minutes);
    row.append(label, count, minutes);
    rows.push(row);
  }
  $('history-body').replaceChildren(...rows);
}

function render() {
  renderTimer();
  renderStats();
  if (!formInitialized) {
    for (const [key, value] of Object.entries(state.settings)) {
      if (key === 'notifications') form.elements[key].checked = value;
      else form.elements[key].value = value;
    }
    formInitialized = true;
  }
}

async function handleAction(button, type, payload) {
  button.disabled = true;
  try { await request(type, payload); } catch (error) { report(error); } finally { button.disabled = false; renderTimer(); }
}

$('toggle').addEventListener('click', () => handleAction($('toggle'), 'toggle'));
$('reset').addEventListener('click', () => handleAction($('reset'), 'reset'));
document.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => handleAction(button, 'phase', { phase: button.dataset.phase })));
$('history-month').value = dayKey().slice(0, 7);
$('history-month').max = dayKey().slice(0, 7);
$('history-month').addEventListener('change', renderHistory);
form.addEventListener('submit', async event => {
  event.preventDefault();
  const settings = Object.fromEntries(['focus', 'shortBreak', 'longBreak', 'longEvery'].map(key => [key, Number(form.elements[key].value)]));
  settings.notifications = form.elements.notifications.checked;
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    await request('settings', { settings });
    $('save-status').textContent = 'Saved. Your next session will use these settings.';
  } catch (error) { report(error); } finally { button.disabled = false; }
});
form.addEventListener('input', () => { $('save-status').textContent = ''; });
$('export').addEventListener('click', async () => {
  try {
    await request('get');
    const rows = ['Date,Pomodoros,Focus minutes', ...Object.entries(state.days).sort(([a], [b]) => a.localeCompare(b)).map(([day, data]) => `${day},${data.count},${data.minutes}`)];
    const url = URL.createObjectURL(new Blob([rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomelo-history-${dayKey()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { report(error); }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state?.newValue) { state = changes.state.newValue; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) request('get').catch(report);
});
setInterval(() => {
  renderTimer();
  const today = dayKey();
  if (today !== lastDate && state) {
    if ($('history-month').value === lastDate.slice(0, 7)) $('history-month').value = today.slice(0, 7);
    $('history-month').max = today.slice(0, 7);
    lastDate = today;
    renderStats();
  }
}, 1000);
request('get').catch(report);
