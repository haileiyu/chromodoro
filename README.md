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
| Gray icon without a badge | Idle, including after a session finishes |
| Green badge | Break running |
| Right-click → **Start focusing** | Start a focus session now, replacing whatever is running |
| Right-click → **Start break** | Start the break that is due now, replacing whatever is running |
| Right-click → **Pomodoro history** | Open your heatmap and settings |

The timer lives entirely in the toolbar: the icon starts, pauses, and resumes, and the right-click menu jumps straight to focus or a break. History and settings are separate pages. **Pomodoro history** in the right-click menu opens the heatmap; Chrome’s own **Options** item in that menu, or **Details → Extension options** on Chrome’s extensions page, opens the settings.

Defaults: **25-minute focus**, **5-minute short break**, **15-minute long break after every 4 completed focus sessions**. Every session starts manually. Finishing focus queues the next break; finishing a break queues focus. **Start focusing** and **Start break** start that session immediately and replace whatever is running, which also makes them the way to abandon a session: an interrupted focus session is not recorded. **Start break** takes the long break when one is owed and a short one otherwise. Skipping or cutting sessions short does not disturb the long break owed after every fourth completed focus session. Settings affect future sessions; an already running or paused session keeps its duration.

## Stats and timing

- A running total for the last year, shown above the heatmap.
- A year-long heatmap of completed Pomodoros, one square per day in the style of a contribution graph. Shading uses fixed bands (1–2, 3–4, 5–6, 7 or more), so a shade means the same thing in every month. Days before your first recorded Pomodoro stay blank rather than showing as zeros. Hover a square for its total, or move between days with the arrow keys.
- CSV export of all dates with completed focus sessions and their actual configured focus minutes.
- Only completed focus sessions count; pauses, resets, and breaks do not.
- History is stored locally in this Chrome profile. Optional Google Sheets sync copies daily totals to your spreadsheet; it is off by default. There is no analytics or browsing-data collection. Uninstalling the extension or clearing its extension storage removes local history. Export CSV or sync first if you need a record.
- Running timers use elapsed wall-clock time, including time while Chrome is closed or the computer is asleep. Pause before stepping away if you do not want that time to count. A paused timer stays paused across restarts.
- Chrome alarms wake the timer and refresh the badge about every 30 seconds. Chrome may delay badge updates and notifications during sleep or resource throttling. The next wake reconciles the saved deadline and records at most one completion; it never auto-starts more sessions while you are away.
- A session is assigned to the local calendar date of its scheduled completion, using the computer’s timezone when completion is processed. Historical date keys do not move if you later change timezones.
- When a session ends, Chromodoro can show a system notification, open a full-page tab, both, or neither. The two checkboxes under **When a session ends** are independent, so you can pick any combination. Both are on by default, so a finished session is hard to miss; turn either off if it is too much.
- The tab shows what finished and offers to start the next session or skip straight to focus. It closes itself as soon as a session starts anywhere, including from the toolbar, so alerts never pile up as stray tabs.
- Notifications respect your Chrome and operating-system notification settings; if macOS has notifications turned off for Chrome, nothing appears. The new tab does not depend on those settings, which makes it the reliable option. Click a notification to open your history.

## Google Sheets sync

Open **Options → Google Sheets → Set up your spreadsheet** for the setup steps. No Google Cloud project or extension OAuth client is needed; you deploy the included script in your own Google account:

1. Create or open a Google spreadsheet, then choose **Extensions → Apps Script**.
2. Replace the editor contents with [`google-apps-script/Code.gs`](google-apps-script/Code.gs), save, select **setup**, and click **Run**. Authorize your script. Copy the generated sync key from the execution log. Running setup again keeps the same key.
3. Choose **Deploy → New deployment → Web app**. Set **Execute as** to **Me** and **Who has access** to **Anyone**, then deploy. Use the deployed URL ending in `/exec`, not the test URL ending in `/dev`.
4. Paste that URL and key into Chromodoro’s Google Sheets settings, click **Connect**, and grant the optional Google site access. The first sync includes all existing daily history, even dates outside the heatmap’s one-year window.

The spreadsheet itself stays private. The web app accepts writes only with the sync key. Keep the key private and only deploy the script in a spreadsheet you control. Some managed Google Workspace accounts prohibit public web-app deployments; CSV export from History remains available there.

Each Chrome profile gets a tab named `Chromodoro <profile ID>` with **Date**, **Pomodoros**, and **Focus minutes** columns. Only completed focus sessions are counted. Sync runs after completions, checks on worker wake, and retries failures every five minutes while Chrome is running. **Sync now** forces an upload. Retries update totals in place without duplicate dates, and an older request cannot lower newer totals. Network problems do not block the timer or erase local history; the settings page shows sync errors and the last successful upload time.

This is a one-way copy of daily totals, not individual session timestamps or a shared timer. Edits in Sheets do not flow back to Chrome. Leave the generated tabs and their headers intact; use other tabs for charts or formulas. Different Chrome profiles stay separate to avoid overwriting each other. Uninstalling or clearing extension storage creates a new profile ID on the next connection.

**Disconnect** removes the saved URL/key and optional site permissions; it keeps local history and existing spreadsheet rows. A request already sent may finish before disconnect completes. Reconnecting the same Chrome profile reuses its tab. To retire the endpoint too, archive the web-app deployment in Apps Script. To rotate a leaked key, delete `SYNC_TOKEN` in Apps Script’s **Project Settings → Script properties**, run **setup** again, and reconnect with the new key. After changing script code, update the deployment to a new version.

The integration uses Google’s documented [Apps Script web apps](https://developers.google.com/apps-script/guides/web) and [Content service](https://developers.google.com/apps-script/guides/content).

## Permissions

`storage` saves settings and counts. `alarms` keeps the countdown working when the service worker sleeps and retries enabled Sheets sync. `contextMenus` supplies the icon’s right-click menu. `notifications` announces completion. No website access is required at install time. Connecting Google Sheets requests optional access to `script.google.com` (your web app) and `script.googleusercontent.com` (Google’s response redirect). The URL and key stay in local extension storage; uploads contain the key, a random profile ID, and daily dates/counts/minutes. No Google password, browsing history, or page content is read. The end-of-session tab needs no `tabs` permission: opening a page of the extension’s own does not require one.

## Source and verification

- `manifest.json`: Chrome Manifest V3 configuration (Chrome 120+).
- `background.js`: Chrome events, serialized storage updates, alarms, badge, and end-of-session alerts.
- `timer.js`: timer transitions, date keys, completion accounting, settings validation, and stored-state migration.
- `history.html`, `history.js`: the heatmap and CSV export.
- `options.html`, `options.js`: the settings page.
- `sheets-sync.js`: optional upload queue, connection storage, retries, and sync status.
- `google-apps-script/Code.gs`: the authenticated receiver deployed by the spreadsheet owner.
- `page.js`, `styles.css`: helpers and styles shared by both pages.
- `alert.html`, `alert.js`: the end-of-session tab.
- `icons/`: bundled PNG toolbar icons.
- `tests/`: timer and mocked Chrome API integration tests. Run `npm test` with Node 20+; no dependencies need installing.

The automated tests cover badge rounding, pause/resume, serialization, midnight completion, duplicate events, break cycles, settings, worker restart recovery, simultaneous events, alert settings, and migration of pre-existing stored settings. Sheets tests cover backfill, retries, network failures, worker restart, duplicate/stale uploads, authentication, profile isolation, and disconnect. They simulate Chrome and Apps Script APIs; a local unpacked installation is the final check for real toolbar rendering, OS notifications, and a live Google deployment.

For a manual Sheets check, connect a test spreadsheet and verify its daily rows match CSV export. Complete a one-minute focus session, then click **Sync now** twice: that date should gain exactly one Pomodoro. Disconnect and complete another session: local history should grow without changing the sheet. Reconnect to backfill it. Test offline/reconnect once and confirm the error clears after retry.

For a quick manual check, set Focus to 1 minute, start it from the toolbar, pause and resume once, then let it finish. Expect `1m`, a gray badge while paused, one new Pomodoro in Today, and a completion notification if enabled. Restore your preferred duration afterward.

Built using Chrome’s documented [Action API](https://developer.chrome.com/docs/extensions/reference/api/action), [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms), and [service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Chrome Web Store release

Run `npm test`, then `npm run package` to create `release/chromodoro-<version>.zip`. The package uses an explicit file list and includes all runtime assets, the optional Apps Script receiver, and the privacy policy; development files and sample history are excluded. Upload this extension ZIP to the Developer Dashboard.

Store copy, permission explanations, and reviewer instructions are in [`store/listing.md`](store/listing.md). Store images are in `store/assets/`: three 1280×800 screenshots and a 440×280 promotional tile. The history screenshot uses labeled example data rendered by the real history page. `node store/preview.mjs` runs the local-only asset preview; it is not part of the extension package.

The published [privacy policy](https://github.com/haileiyu/chromodoro/blob/main/PRIVACY.md) describes local storage and optional Google Sheets backup. For updates, increase the version in `manifest.json` and `package.json`, rerun verification, and rebuild the ZIP.
