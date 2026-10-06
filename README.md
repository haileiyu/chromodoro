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
| Gray icon and badge | Paused; minutes stay visible |
| Gray icon without a badge | Idle, including after a session finishes |
| Green badge | Break running |
| Right-click → **Start focusing** | Start a focus session now, replacing whatever is running |
| Right-click → **Start break** | Start the break that is due now, replacing whatever is running |
| Right-click → **Pomodoro history** | Open your heatmap, sync status, and CSV export |

The timer lives entirely in the toolbar: the icon starts, pauses, and resumes, and the right-click menu jumps straight to focus or a break. History and settings share a light sidebar layout; use **History** and **Settings** to move between them. **Pomodoro history** in the right-click menu opens the green activity heatmap; Chrome’s own **Options** item in that menu, or **Details → Extension options** on Chrome’s extensions page, opens the settings.

Defaults: **25-minute focus**, **5-minute short break**, **15-minute long break after every 4 completed focus sessions**. Every session starts manually. Finishing focus queues the next break; finishing a break queues focus. **Start focusing** and **Start break** start that session immediately and replace whatever is running, which also makes them the way to abandon a session: an interrupted focus session is not recorded. **Start break** takes the long break when one is owed and a short one otherwise. Skipping or cutting sessions short does not disturb the long break owed after every fourth completed focus session. Settings affect future sessions; an already running or paused session keeps its duration.

## Stats and timing

- Today's completed Pomodoros, shown above the history heatmap and refreshed as history changes or the local date rolls over.
- A running total for the last year, shown above the heatmap.
- A year-long heatmap of completed Pomodoros, one square per day in the style of a contribution graph. Shading uses fixed bands (1–2, 3–4, 5–6, 7 or more), so a shade means the same thing in every month. Days before your first recorded Pomodoro stay blank rather than showing as zeros. Hover a square for its total, or move between days with the arrow keys.
- CSV export of all dates with completed focus sessions and their actual configured focus minutes.
- Only completed focus sessions count; pauses, resets, and breaks do not.
- History is saved locally and the most recent 24 calendar months are shared through Chrome Sync when enabled. Older records stay on devices that have them and remain available for CSV export. Export before uninstalling or clearing storage. There is no analytics or browsing-data collection.
- Running timers use elapsed wall-clock time, including time while Chrome is closed or the computer is asleep. Pause before stepping away if you do not want that time to count. A paused timer stays paused across restarts.
- Chrome alarms wake the timer and refresh the badge about every 30 seconds. Chrome may delay badge updates and notifications during sleep or resource throttling. The next wake reconciles the saved deadline and records at most one completion; it never auto-starts more sessions while you are away.
- A session is assigned to the local calendar date of its scheduled completion, using the computer’s timezone when completion is processed. Historical date keys do not move if you later change timezones.
- When a session ends, Chromodoro can show a system notification, open a full-page tab, both, or neither. The two switches under **When a session ends** are independent, so you can pick any combination. Both are on by default, so a finished session is hard to miss; turn either off if it is too much.
- The tab shows what finished and today's total completed Pomodoros, including the focus session that just ended. It offers to start the next session or skip straight to focus. It closes itself as soon as a session starts anywhere, including from the toolbar, so alerts never pile up as stray tabs.
- Notifications respect your Chrome and operating-system notification settings; if macOS has notifications turned off for Chrome, nothing appears. The new tab does not depend on those settings, which makes it the reliable option. Click a notification to open your history.

## History across devices

Install the same extension on each Chrome instance and enable Chrome Sync for extensions on the same Google account. History shares automatically, including each device's existing local records within the sync window. Active timers, break cycles, and settings remain independent. Each completion keeps the date assigned on its originating device.

Open **Pomodoro history → Check sync** to retry immediately. **Ready for Chrome sync** means Chrome's local sync storage accepted the records; it does not prove delivery to another device or that account sync is enabled. Offline changes share after reconnecting. Storage errors retry automatically every 15 minutes while Chrome is running, and on worker startup. Chrome can delay delivery.

The sync window covers the current month and previous 23 months. The extension retains older received records locally for CSV export; a new device will not receive records already removed from sync storage. Chrome limits sync storage to 100 KB total, 8 KB per item, and 512 items. Monthly records fit several devices with daily use; unusually many installations or very large histories can fill the shared allowance. If this happens, new contributions remain local and the history page reports the capacity issue. CSV exports always include all locally available records.

Chrome identifies extensions by their extension ID. Store installs of the same listing share an ID. Unpacked copies can have different IDs across computers and will not share history unless configured with the same development key. Compare IDs on `chrome://extensions` when diagnosing this; Chrome sign-in by itself is insufficient.

History migration happens once per installation. Records originally collected separately on different devices are added together; manually copied pre-sync profiles may contain overlapping totals that cannot be distinguished from separate work. Clearing local storage creates a new installation identity and downloads available synced records without treating them as new local contributions.

For a manual cross-device check, install this version with the same extension ID in two Chrome profiles on separate devices using the same account with extension sync enabled. Finish a one-minute focus session on each device, including one while offline, then reconnect. Both history pages should eventually show the sum, with no duplicate totals after restarting Chrome. Confirm that starting a timer on one device leaves the other's timer unchanged. Real account delivery requires this check; the automated suite simulates Chrome's storage APIs.

## Permissions

`storage` saves settings and counts locally and shares recent history through Chrome Sync. `alarms` keeps the countdown working when the service worker sleeps. `contextMenus` supplies the icon’s right-click menu. `notifications` announces completion. No website access is required. The end-of-session tab needs no `tabs` permission: opening a page of the extension’s own does not require one.

## Source and verification

- `manifest.json`: Chrome Manifest V3 configuration (Chrome 120+).
- `background.js`: Chrome events, serialized storage updates, alarms, badge, and end-of-session alerts.
- `timer.js`: timer transitions, date keys, completion accounting, settings validation, and stored-state migration.
- `history.html`, `history.js`: the heatmap, sync status, and CSV export.
- `history-sync.js`: per-installation monthly records, one-time migration, merging, retention, and retries.
- `options.html`, `options.js`: the settings page.
- `page.js`, `styles.css`: helpers and styles shared by both pages.
- `alert.html`, `alert.js`: the end-of-session tab.
- `icons/`: transparent PNG logo (`logo.png`) and bundled 16, 32, 48, and 128 pixel icons (`icon<size>.png`) derived from it. The size variants trim excess transparent margins so the tomato fills the toolbar icon. Pages, notifications, and the toolbar share these icons; paused and idle toolbar icons are generated in grayscale at runtime.
- `tests/`: timer and mocked Chrome API integration tests. Run `npm test` with Node 20+; no dependencies need installing.

The automated tests cover badge rounding, pause/resume, serialization, midnight completion, duplicate events, break cycles, settings, worker restart recovery, simultaneous events, alert settings, migration of pre-existing stored settings, removal of obsolete backup credentials, offline merges, duplicate and reordered sync updates, retention boundaries, quota failures, and archive-before-delete behavior. They simulate Chrome APIs; a local unpacked installation is the final check for real toolbar rendering and OS notifications.

For a quick manual check, set Focus to 1 minute, start it from the toolbar, pause and resume once, then let it finish. Expect `1m`, a gray badge while paused, one new Pomodoro in Today, and a completion notification if enabled. Restore your preferred duration afterward.

Built using Chrome’s documented [Action API](https://developer.chrome.com/docs/extensions/reference/api/action), [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms), and [service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Chrome Web Store release

Run `npm test`, then `npm run package` to create `release/chromodoro-<version>.zip` and `release/chromodoro-store-upload-kit.zip`. Packaging requires matching versions in `manifest.json` and `package.json`. The extension package uses an explicit file list and includes all runtime assets and the privacy policy; development files and sample history are excluded. Upload only the extension ZIP to the existing item's Package tab in the Developer Dashboard. The separate kit contains the extension ZIP, store icon, screenshots, listing copy, privacy policy, checksum, release notes, release checklist, and a Chinese submission guide.

See [`store/RELEASE_NOTES.md`](store/RELEASE_NOTES.md) for the 1.1.0 changes and [`store/RELEASE_CHECKLIST.md`](store/RELEASE_CHECKLIST.md) for verification and remaining submission steps.

Store copy, permission explanations, and reviewer instructions are in [`store/listing.md`](store/listing.md). Store images are in `store/assets/`: three 1280×800 screenshots and a 440×280 promotional tile. The history screenshot uses labeled example data rendered by the real history page. `node store/preview.mjs` runs the local-only asset preview; it is not part of the extension package.

The [privacy policy](PRIVACY.md) describes local storage, Google Chrome account sync, retention, and CSV export. Publish this policy at a public URL that does not reveal a personal account before submitting to the Chrome Web Store. For updates, increase the version in `manifest.json` and `package.json`, rerun verification, and rebuild the ZIP.
