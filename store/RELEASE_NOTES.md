# Chromodoro 1.3.0

Prepared October 15, 2026. Publication date is pending.

## What's new

- Dark mode. History, Settings, and the completion page follow Chrome's light or dark mode. To always use one, choose Light or Dark in Settings → Appearance.
- Set a short or long break to 0 to skip it. With short breaks at 0, focus sessions run back to back and the long break still comes after your chosen number of sessions. With both at 0, Chromodoro only times focus.

## Changes

- Save changes in Settings is highlighted only when you have unsaved changes.
- After a focus session, the notification names what comes next, so it no longer mentions a break that is turned off.

## Upgrade details

No new permissions are requested compared with 1.2.1. Existing settings and history are kept. The theme starts on System, and break lengths are unchanged.

---

# Chromodoro 1.2.1

Prepared October 6, 2026. Publication date is pending.

## Fixes

- The idle icon is bundled in gray, so it appears correctly even before the background worker starts.
- Toolbar updates can no longer delay starting a focus session or break or scheduling its completion alarm.

No new permissions are requested. Existing settings and history are kept.

---

# Chromodoro 1.2.0

Prepared October 6, 2026. Publication date is pending.

## What's new

- Set a daily Pomodoro goal in Settings and track progress toward it. Set the target to 0 for no goal.
- See how many Pomodoros you've completed today on the completion page and History.
- Start focusing or start a break with keyboard shortcuts (Ctrl+Shift+8 / Ctrl+Shift+9, or Command+Shift+8 / Command+Shift+9 on Mac). Shortcuts can be changed in Chrome's extension shortcut settings.

## Upgrade details

No new permissions are requested compared with 1.1.0. Existing settings and history are kept; the daily goal defaults to off.

---

# Chromodoro 1.1.0

Prepared October 1, 2026. Publication date is pending.

## What's new

- Keep your recent Pomodoro history across devices with Chrome Sync. The most recent 24 calendar months of daily totals can sync when extension sync is enabled on the same Google account.
- See sync status and retry from History. Offline changes share after reconnecting; Chrome controls delivery timing.
- Enjoy redesigned History, Settings, and completion pages with a shared sidebar, a green activity heatmap, and clearer session and alert controls.
- Keep older history locally and export all locally available records as CSV. Timers and settings remain independent on each device.

## Upgrade details

Existing local history is migrated automatically. Update the existing installation to retain its data; export a CSV before uninstalling or clearing storage. Separately collected histories on different devices are added together. Manually copied pre-sync profiles may contain overlapping totals that cannot be distinguished from separate work.

Google Sheets backup was removed during preparation for this release. Older saved connection details are removed on upgrade; any rows previously uploaded to a spreadsheet remain there. The privacy policy now describes Chrome account sync and retention. No new permissions are requested compared with the local-history 1.0.0 package in this repository.

Core timer use needs no login. Cross-device history requires the same extension ID on each device and Chrome extension sync enabled. "Ready for Chrome sync" confirms that Chrome accepted the local records, not that another device has received them.
