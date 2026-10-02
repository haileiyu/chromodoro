# Chrome Web Store listing — Chromodoro

Last updated: October 1, 2026. This is the source for the store listing and reviewer details; `../PRIVACY.md` is the public privacy policy.

## Release status

The repository is at version `1.1.0`. Confirm the submitted or published version in the Chrome Web Store Developer Dashboard before uploading an update. Use `chromodoro.contact@gmail.com` as the public contact email and verify it in the dashboard. The intended launch settings are Free, Public, and All regions; confirm them there before submission.

## Name
Chromodoro — Pomodoro Timer

## Short description (manifest)
One-click focus timer, remaining minutes on your toolbar, and private daily Pomodoro stats.

## Detailed description
Start a focus session with one click. Chromodoro keeps the remaining minutes on your Chrome toolbar, so you can focus without keeping a timer tab open.

Click the icon to start, pause, or resume. Right-click to start focusing, take a break, or view your Pomodoro history. A quiet gray icon shows when the timer is idle.

MAKE TIME TO FOCUS
• Adjustable focus, short-break, and long-break durations.
• A long break after your chosen number of completed focus sessions.
• Optional system notifications and a completion tab, independently configurable.
• Paused timers survive browser restarts. Running timers use elapsed time, including time while your computer sleeps.
• Each new session starts when you choose. Unfinished focus sessions and breaks do not count toward your history.

SEE YOUR PROGRESS
• A year-long heatmap of completed Pomodoros.
• Daily Pomodoro counts and focus-minute totals.
• CSV export of all recorded days.

HISTORY ACROSS DEVICES
Your history is saved locally. With Chrome Sync enabled for extensions on the same Google account, the most recent 24 calendar months of daily totals are shared through Google across instances of this extension. Offline changes share after reconnecting. Older records stay on devices that have them and remain available for CSV export. Chrome storage limits can delay sharing; check the history page for status. Timers and settings remain independent on each device. No account is required for the timer. Chromodoro does not read browsing history or page content and includes no advertising or analytics trackers.

GET STARTED
Pin Chromodoro in Chrome's Extensions menu, then click its toolbar icon. Open Options from the extension's right-click menu to customize your sessions and alerts.

Support: chromodoro.contact@gmail.com

## Category and language
Productivity (confirm the available category in the dashboard)
English

## Graphics and assets

| Asset | Dimensions | File |
| --- | --- | --- |
| Store icon | 128×128 PNG | `icons/icon128.png` |
| History screenshot | 1280×800 JPEG | `store/assets/history-1280x800.jpg` |
| Settings screenshot | 1280×800 JPEG | `store/assets/settings-1280x800.jpg` |
| Completion screenshot | 1280×800 JPEG | `store/assets/completion-1280x800.jpg` |
| Small promotional tile | 440×280 PNG | `store/assets/promo-440x280.png` |

The history screenshot shows labeled example data from the earlier history page; refresh it to include the new sync card before store submission. The settings screenshot was refreshed against the current UI on September 28, 2026. The idle and paused toolbar icon uses a lighter gray for visibility on dark toolbars; the screenshots do not show the Chrome toolbar.

## URLs
Homepage: leave blank until a Chromodoro-owned site or repository is available.
Support: use chromodoro.contact@gmail.com as the contact email; leave the optional support URL blank until a branded support page is available.
Privacy policy: publish `PRIVACY.md` at a public, non-personal URL and verify that it loads before submitting. Do not use the former personal GitHub URL.

## Single purpose
Help users manage Pomodoro focus sessions and breaks and review or export their completed daily focus totals.

## Permission justifications

### storage
Stores timer state, user-selected durations and alert settings, and daily focus totals locally so they survive service-worker and browser restarts. Also shares recent daily focus totals, dates, and random installation identifiers through Google Chrome Sync when the user enables extension sync.

### alarms
Schedules session completion and periodic toolbar countdown updates and history sync retries while the extension service worker sleeps.

### contextMenus
Adds Start focusing, Start break, and Pomodoro history commands to the extension toolbar icon's context menu.

### notifications
Displays an optional notification when a focus session or break completes. Users can disable notifications in Options.

## Remote code
No remotely hosted code executes inside the extension. JavaScript, CSS, and icons are packaged locally.

## Data-use disclosure notes
Timer settings and daily focus totals are stored locally. Recent daily focus activity, dates, and random installation identifiers are also placed in Chrome sync storage and transferred through Google when extension sync is enabled. CSV export creates a file on the user's computer. Chromodoro does not send history to a developer-operated backend and does not read browsing history, page content, personal communications, or location. The public privacy policy is [`PRIVACY.md`](../PRIVACY.md) at the URL above. Review the dashboard's current data-use definitions and disclose the storage and Google synchronization of daily focus activity where applicable.

## Developer and distribution details

- Public publisher name: Chromodoro.
- Contact email: chromodoro.contact@gmail.com; verify and monitor it in the Developer Dashboard.
- Homepage and support URL: leave blank until branded pages are available.
- Public privacy policy URL: pending publication of `PRIVACY.md` outside a personal account.
- Visibility and regions: confirm in the Developer Dashboard before submission.

## Version history

| Version | Date | Summary | Store status |
| --- | --- | --- | --- |
| 1.1.0 | October 1, 2026 | Added Chrome account history sync with safe merging, local archives, and status | Not submitted |
| Unreleased | September 28, 2026 | Improved the idle and paused icon; replaced personal links with branded contact information; removed Google Sheets backup | Not submitted |
| 1.0.0 | To confirm | Toolbar Pomodoro timer and local history | To confirm in Developer Dashboard |

## Reviewer test instructions
No login or payment is needed for the timer and local history.

1. Pin the extension. Open Options and set Focus to 1 minute, leave New tab on, and save.
2. Click the toolbar icon. Confirm a countdown badge appears. Click again to pause and once more to resume.
3. Let the session finish. Confirm a gray idle icon, the completion tab, and one completed Pomodoro in Pomodoro history (right-click menu). System notifications depend on OS settings.
4. In the completion tab, start the break or skip to focus. Verify the completion tab closes. Export a CSV from History and confirm the daily count and focus minutes.
5. Restore Focus to 25 minutes. No website access is needed for these core features.

6. To verify history sync, install this version with the same extension ID on two devices using the same Google account with Chrome Sync enabled for extensions. Complete a session on each, including one offline, then reconnect. After Chrome delivers the records, both devices should show the combined daily total. Timers stay independent. Use Check sync to retry; Ready for Chrome sync confirms storage acceptance, not remote delivery.

No developer-owned credentials or test account are required. Account sync testing requires your own Chrome test account.
