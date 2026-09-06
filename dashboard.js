import { dayKey, heatmapDays, heatmapLevel } from './timer.js';

const $ = id => document.getElementById(id);
const form = $('settings-form');
let state;
let formInitialized = false;
let lastDate = dayKey();
let heatBuiltFor = null;
let heatCells = [];
let heatDates = [];

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

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function minutesLabel(value) {
  return value >= 60 ? `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ''}` : `${value} min`;
}

// Rebuilt only when the window moves at midnight; updates in place otherwise, so a
// refresh neither churns 371 nodes nor throws away scroll or keyboard position.
function buildHeatmap() {
  const days = heatmapDays();
  const today = dayKey();
  const months = [];
  let previous = -1;
  for (let week = 0; week * 7 < days.length; week++) {
    const sunday = days[week * 7];
    if (sunday.getMonth() === previous) continue;
    previous = sunday.getMonth();
    // A window opening mid-month would stack a sliver label on the next month's.
    if (week === 0 && sunday.getDate() > 1) continue;
    const label = document.createElement('span');
    label.style.gridColumn = `${week + 2} / span ${Math.min(5, 53 - week)}`;
    label.textContent = sunday.toLocaleDateString(undefined, { month: 'short' });
    months.push(label);
  }
  $('heat-months').replaceChildren(...months);
  const rows = Array.from({ length: 7 }, (_, weekday) => {
    const row = document.createElement('div');
    row.className = 'heat-row';
    row.setAttribute('role', 'row');
    if (weekday % 2) {
      const name = document.createElement('span');
      name.className = 'heat-day';
      name.style.gridRow = weekday + 1;
      name.textContent = days[weekday].toLocaleDateString(undefined, { weekday: 'short' });
      name.setAttribute('aria-hidden', 'true');
      row.append(name);
    }
    return row;
  });
  heatCells = days.map((date, i) => {
    if (dayKey(date) > today) return null;
    const cell = document.createElement('div');
    cell.className = 'sq';
    cell.style.gridColumn = Math.floor(i / 7) + 2;
    cell.style.gridRow = i % 7 + 1;
    cell.dataset.index = i;
    rows[i % 7].append(cell);
    return cell;
  });
  heatDates = days;
  $('heat-grid').replaceChildren(...rows);
  $('heat-range').textContent = `${monthLabel(days[0])} – ${monthLabel(new Date())}`;
  heatBuiltFor = today;
  $('heat-scroll').scrollLeft = $('heat-scroll').scrollWidth;
}

function renderHeatmap() {
  if (heatBuiltFor !== dayKey()) buildHeatmap();
  // Days before the first recorded one stay blank: a new install should not open on a
  // year of misses, and those squares are not data a screen reader should walk through.
  const [first] = Object.keys(state.days).sort();
  const anchor = heatCells.find(cell => cell?.tabIndex === 0 && !cell.hasAttribute('aria-hidden'));
  let total = 0;
  let latest = null;
  heatCells.forEach((cell, i) => {
    if (!cell) return;
    const key = dayKey(heatDates[i]);
    const day = state.days[key];
    const count = day?.count ?? 0;
    total += count;
    if (!first || key < first) {
      cell.className = 'sq pre';
      cell.setAttribute('aria-hidden', 'true');
      for (const attribute of ['role', 'tabindex', 'title', 'aria-label']) cell.removeAttribute(attribute);
      return;
    }
    const when = heatDates[i].toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const label = count
      ? `${when} — ${count} Pomodoro${count === 1 ? '' : 's'} · ${minutesLabel(day.minutes)} of focus`
      : `${when} — no Pomodoros`;
    cell.className = `sq l${heatmapLevel(count)}`;
    cell.removeAttribute('aria-hidden');
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('title', label);
    cell.setAttribute('aria-label', label);
    cell.tabIndex = -1;
    latest = cell;
  });
  // One tab stop, arrow keys inside. Keep wherever the user already is.
  const stop = anchor && !anchor.hasAttribute('aria-hidden') ? anchor : latest;
  if (stop) stop.tabIndex = 0;
  $('heat-total').textContent = `${total} Pomodoro${total === 1 ? '' : 's'} in the last year`;
}

function render() {
  renderHeatmap();
  if (!formInitialized) {
    for (const [key, value] of Object.entries(state.settings)) {
      if (key === 'notifications') form.elements[key].checked = value;
      else form.elements[key].value = value;
    }
    formInitialized = true;
  }
}

$('heat-grid').addEventListener('keydown', event => {
  const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
  const from = Number(document.activeElement?.dataset?.index);
  if (!step || !Number.isInteger(from)) return;
  const to = from + step;
  // Vertical moves stay inside their week; horizontal moves stay on the same weekday.
  if (Math.abs(step) === 1 && Math.floor(to / 7) !== Math.floor(from / 7)) return;
  const target = heatCells[to];
  if (!target || target.hasAttribute('aria-hidden')) return;
  event.preventDefault();
  document.activeElement.tabIndex = -1;
  target.tabIndex = 0;
  target.focus();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const settings = Object.fromEntries(['focus', 'shortBreak', 'longBreak', 'longEvery'].map(key => [key, Number(form.elements[key].value)]));
  settings.notifications = form.elements.notifications.checked;
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    await request('settings', { settings });
    $('save-status').textContent = 'Saved';
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
    a.download = `chromodoro-history-${dayKey()}.csv`;
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
// The grid is the only time-sensitive thing left on the page, so it only has to
// notice the date turning over; renderHeatmap rebuilds the window when it does.
setInterval(() => {
  const today = dayKey();
  if (today !== lastDate && state) {
    lastDate = today;
    renderHeatmap();
  }
}, 30000);
request('get').catch(report);
