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
