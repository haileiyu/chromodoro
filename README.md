# Chromodoro — Pomodoro Timer

A small, dependency-free Chrome extension with a one-click toolbar timer and private daily stats. Original implementation inspired by the simplicity of classic Pomodoro extensions.

## Install in Chrome

1. Download this repository (**Code → Download ZIP**, then unzip) or `git clone` it into a folder you will keep, such as `Documents/Extensions`.
2. Enter `chrome://extensions` in Chrome’s address bar.
3. Turn on **Developer mode** at the top right.
4. Click **Load unpacked** and select the `chromodoro` folder containing `manifest.json`.
5. Open Chrome’s puzzle-piece **Extensions** menu and pin **Chromodoro — Pomodoro Timer**.

No build, npm install, account, or server is needed. Keep the folder in place: Chrome loads the extension from it. To update the code later, replace files in the same folder and click Reload on its Chrome extensions card. Do not uninstall to update if you want to retain stats. A managed work Chrome profile may restrict unpacked extensions; use a personal Chrome profile if needed.

## Use

| Action | Result |
| --- | --- |
| Click the toolbar icon when idle | Start the selected focus session or break |
| Click while running | Pause and keep the remaining time |
| Click while paused | Resume |
| Look at the badge | Remaining rounded-up minutes, such as `16m`, `15m`, … `1m` |
| Gray badge | Paused; minutes stay visible |
| Green badge | Break running, or `✓` when a session finishes |
| Right-click → **Stats & settings** | Open your heatmap and settings |
| Right-click → **Start focus now** | Skip the break and begin focusing immediately |
| Right-click → **Reset timer** | Discard the current partial session and return to focus |

The timer lives entirely in the toolbar: the icon starts, pauses, and resumes, and the right-click menu skips a break or resets. The dashboard holds your heatmap and settings only. You can also open it from **Details → Extension options** on Chrome’s extensions page.

Defaults: **25-minute focus**, **5-minute short break**, **15-minute long break after every 4 completed focus sessions**. Every session starts manually. Finishing focus queues the next break; finishing a break queues focus. **Start focus now** skips that break in one click, whether it is queued or already running, and starts focusing right away; break time is never recorded, so nothing is lost. It is unavailable while a focus session is running, so it cannot discard one — use **Reset timer** for that. Skipping breaks does not disturb the long break owed after every fourth completed focus session. Settings affect future sessions, including after you reset; an already running or paused session keeps its duration.

## Stats and timing

- A running total for the last year, shown above the heatmap.
- A year-long heatmap of completed Pomodoros, one square per day in the style of a contribution graph. Shading uses fixed bands (1–2, 3–4, 5–6, 7 or more), so a shade means the same thing in every month. Days before your first recorded Pomodoro stay blank rather than showing as zeros. Hover a square for its total, or move between days with the arrow keys.
- CSV export of all dates with completed focus sessions and their actual configured focus minutes.
- Only completed focus sessions count; pauses, resets, and breaks do not.
- Everything is stored locally in this Chrome profile. There is no account, cloud sync, analytics, page access, or network code. Uninstalling the extension or clearing its extension storage removes history. Export CSV first if you need a record.
- Running timers use elapsed wall-clock time, including time while Chrome is closed or the computer is asleep. Pause before stepping away if you do not want that time to count. A paused timer stays paused across restarts.
- Chrome alarms wake the timer and refresh the badge about every 30 seconds. Chrome may delay badge updates and notifications during sleep or resource throttling. The next wake reconciles the saved deadline and records at most one completion; it never auto-starts more sessions while you are away.
- A session is assigned to the local calendar date of its scheduled completion, using the computer’s timezone when completion is processed. Historical date keys do not move if you later change timezones.
- When a session ends, Chromodoro can show a system notification, open a full-page tab, both, or neither. The two checkboxes under **When a session ends** are independent, so you can pick any combination. Both are on by default, so a finished session is hard to miss; turn either off if it is too much.
- The tab shows what finished and offers to start the next session or skip straight to focus. It closes itself as soon as a session starts anywhere, including from the toolbar, so alerts never pile up as stray tabs.
- Notifications respect your Chrome and operating-system notification settings; if macOS has notifications turned off for Chrome, nothing appears. The new tab does not depend on those settings, which makes it the reliable option. Click a notification to open the dashboard.

## Permissions

`storage` saves settings and counts. `alarms` keeps the countdown working when the service worker sleeps. `contextMenus` supplies the icon’s right-click menu. `notifications` announces completion. No browsing or website permissions are requested. The end-of-session tab needs no `tabs` permission: opening a page of the extension’s own does not require one.

## Source and verification

- `manifest.json`: Chrome Manifest V3 configuration (Chrome 120+).
- `background.js`: Chrome events, serialized storage updates, alarms, badge, and end-of-session alerts.
- `timer.js`: timer transitions, date keys, completion accounting, settings validation, and stored-state migration.
- `dashboard.html`, `dashboard.css`, `dashboard.js`: heatmap and settings page.
- `alert.html`, `alert.js`: the end-of-session tab.
- `icons/`: bundled PNG toolbar icons.
- `tests/`: timer and mocked Chrome API integration tests. Run `npm test` with Node 20+; no dependencies need installing.

The automated tests cover badge rounding, pause/resume, serialization, midnight completion, duplicate events, break cycles, settings, worker restart recovery, simultaneous events, alert settings, and migration of pre-existing stored settings. They simulate Chrome APIs; a local unpacked installation is the final check for real toolbar rendering and OS notifications.

For a quick manual check, set Focus to 1 minute, start it from the toolbar, pause and resume once, then let it finish. Expect `1m`, a gray badge while paused, one new Pomodoro in Today, and a completion notification if enabled. Restore your preferred duration afterward.

Built using Chrome’s documented [Action API](https://developer.chrome.com/docs/extensions/reference/api/action), [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms), and [service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
