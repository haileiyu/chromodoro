# Chrome Web Store listing

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

LOCAL BY DEFAULT
Your history and settings are saved on this computer. No account is required for the timer. Chromodoro does not read your browsing history or page content and includes no advertising or analytics trackers. Signing into Chrome on another computer does not automatically sync your Chromodoro history.

OPTIONAL GOOGLE SHEETS BACKUP
Copy your daily totals to a spreadsheet you control. This advanced, optional feature requires a one-time Google Apps Script deployment using the included script. Setup instructions are in Options. Each installation uploads to its own sheet tab; this is a one-way backup, not cross-device history synchronization. Google access is requested only when you connect the feature. Some managed Google accounts may restrict Apps Script deployment; CSV export is available without it.

GET STARTED
Pin Chromodoro in Chrome's Extensions menu, then click its toolbar icon. Open Options from the extension's right-click menu to customize your sessions and alerts.

Support and source: https://github.com/haileiyu/chromodoro

## Category and language
Productivity / Tools (choose the closest available productivity category)
English

## URLs
Homepage: https://github.com/haileiyu/chromodoro
Support: https://github.com/haileiyu/chromodoro/issues
Privacy policy: https://github.com/haileiyu/chromodoro/blob/main/PRIVACY.md

## Single purpose
Help users manage Pomodoro focus sessions and breaks and review or export their completed daily focus totals.

## Permission justifications

### storage
Stores timer state, user-selected durations and alert settings, and daily focus totals locally so they survive service-worker and browser restarts. If users enable Google Sheets backup, also stores their endpoint, sync key, installation identifier, and upload status locally.

### alarms
Schedules session completion and periodic toolbar countdown updates while the extension service worker sleeps. Also retries optional Google Sheets uploads after failures.

### contextMenus
Adds Start focusing, Start break, and Pomodoro history commands to the extension toolbar icon's context menu.

### notifications
Displays an optional notification when a focus session or break completes. Users can disable notifications in Options.

### Optional host access
https://script.google.com/* receives authenticated POST requests to the user's own Google Apps Script deployment for optional daily-history backup. https://script.googleusercontent.com/* is needed to read Google's redirected response. Access is requested only when the user clicks Connect and is removed on Disconnect. Neither domain is used to download executable extension code.

## Remote code
No remotely hosted code executes inside the extension. JavaScript, CSS, and icons are packaged locally. The optional user-deployed Apps Script executes on Google's servers and returns JSON data; the extension never evaluates the response as code.

## Data-use disclosure notes
The optional backup transmits completed-session activity (dates/counts/focus minutes), a random installation identifier, and an authentication key to the user's Google Apps Script endpoint. Review the dashboard's exact category definitions before saving; disclose authentication information and user activity when applicable. The developer receives no history through a developer-operated backend. The privacy policy describes Google's processing and the user's control over their spreadsheet.

No sale of data; no uses unrelated to the timer/history/backup functionality; no creditworthiness or lending use.

## Reviewer test instructions
No login or payment is needed for the timer and local history.

1. Pin the extension. Open Options and set Focus to 1 minute, leave New tab on, and save.
2. Click the toolbar icon. Confirm a countdown badge appears. Click again to pause and once more to resume.
3. Let the session finish. Confirm a gray idle icon, the completion tab, and one completed Pomodoro in Pomodoro history (right-click menu). System notifications depend on OS settings.
4. In the completion tab, start the break or skip to focus. Verify the completion tab closes. Export a CSV from History and confirm the daily count and focus minutes.
5. Restore Focus to 25 minutes. No website access is needed for these core features.

Optional Google Sheets backup can be tested with a spreadsheet owned by the reviewer:
1. Open Extensions → Apps Script in that spreadsheet. Paste the included google-apps-script/Code.gs, save, run setup, and authorize your own script. Copy the generated sync key from the execution log.
2. Deploy a Web app, execute as Me, access Anyone. The script authenticates writes using the key; the spreadsheet need not be publicly shared.
3. In extension Options, enter the deployed /exec URL and key, click Connect, and allow the two optional Google origins.
4. Verify a Chromodoro <installation ID> tab contains Date, Pomodoros, and Focus minutes. Click Sync now twice and confirm no duplicated daily rows.
5. Disconnect and verify that local history remains and automatic uploads stop.

No developer-owned credentials or test account are required. Do not enter a real user's sync key in reviewer notes.
