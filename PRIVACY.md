# Chromodoro Privacy Policy

Effective date: September 25, 2026

Chromodoro is a Pomodoro timer extension maintained by Hailei Yu. This policy explains how the extension handles information when you use the timer, view your history, export a CSV, or enable optional Google Sheets backup.

## Information stored on your computer

Chromodoro stores your timer state, settings, completed daily Pomodoro counts, and daily focus-minute totals in Chrome's local extension storage. Timer state includes session identifiers and timing information needed to resume and complete a session. This information stays on that computer unless you choose to export it or enable Google Sheets backup. Signing into the same Chrome account on another computer does not synchronize this history.

The extension does not read your browsing history, visited URLs, web-page content, personal communications, location, or Google account password. It contains no advertising or analytics trackers. The developer does not operate a server that receives your timer history.

## Optional Google Sheets backup

Google Sheets backup is off by default. To enable it, you deploy the included Google Apps Script in a spreadsheet you control, provide its web-app URL and sync key, and grant optional access to Google's Apps Script domains.

When connected, Chromodoro sends your daily dates, completed Pomodoro counts, focus-minute totals, a randomly generated identifier for this installation, and your sync key over HTTPS to the Google Apps Script endpoint you configured. Requests go to `script.google.com`; Google's response may redirect to `script.googleusercontent.com`. The data is used to authenticate the request and update a separate spreadsheet tab for this installation. Uploads include existing history, updates after completions, manual uploads, and retries after failures.

The endpoint URL, sync key, installation identifier, last uploaded totals, and sync status are stored locally. The key is a credential for your script, not your Google password. Keep it private. The spreadsheet's sharing settings determine who else can access the uploaded history. Google processes requests and stores spreadsheet data under its own [privacy policy](https://policies.google.com/privacy), and may process ordinary network metadata such as your IP address.

This is a one-way backup. Spreadsheet edits are not downloaded into Chromodoro, and different computers' local histories are not merged. The extension does not sell data, use data for advertising, transfer it for unrelated purposes, or use it to determine creditworthiness or eligibility for lending.

## CSV export and notifications

CSV export creates a file of daily dates, Pomodoro counts, and focus minutes on your computer. You control where that file is stored and whether you share it. Optional completion notifications display timer information through Chrome and your operating system; the completion tab displays information within the extension.

## Retention and deletion

Local history and settings remain until you remove the extension or clear its extension storage. Exported CSV files remain until you delete them.

Disconnecting Google Sheets removes the saved endpoint, sync key, upload snapshot, and sync status and revokes the extension's optional Google site permissions. Local history and the random installation identifier remain, so reconnecting can reuse the same tab. A request already sent may finish before disconnect completes. Existing spreadsheet rows are not deleted by disconnecting or uninstalling Chromodoro; delete them in Google Sheets. You can archive the Apps Script deployment to stop accepting requests, and rotate its sync key using the instructions in the repository.

## Changes and contact

This policy will be updated if the extension's data practices change. The effective date identifies the current policy.

For questions about Chromodoro or this policy, contact the maintainer through the [project's support page](https://github.com/haileiyu/chromodoro/issues). GitHub issues are public; do not post sync keys, private history, or other sensitive information there.
