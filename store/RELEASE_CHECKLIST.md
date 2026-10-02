# Chromodoro 1.1.0 release checklist

Prepared October 1, 2026. Local materials are prepared; this does not record a store submission or publication.

## Files to use

- Upload `release/chromodoro-1.1.0.zip` to the existing item's **Package → Upload New Package** in the Chrome Web Store Developer Dashboard.
- `release/chromodoro-store-upload-kit.zip` is the complete handoff bundle. Extract it for the listing copy, reviewer instructions, privacy policy, release notes, store icon, screenshots, and promotional tile. Do not upload this outer ZIP as the extension.
- `release/SHA256SUMS` verifies the extension ZIP. From the repository root or extracted kit root, run `shasum -a 256 -c release/SHA256SUMS`.
- Use the newly generated ZIPs; an older extracted `release/chromodoro-store-upload-kit/` folder may contain stale materials.

## Local verification

- [x] All 28 automated tests passed, including upgrade migration, timer recovery, history merging, offline retries, and storage limits.
- [x] Manifest and package metadata both identify version 1.1.0.
- [x] History, Settings, and completion store screenshots recaptured from the current pages with preview-only example data; full controls are visible.
- [x] Three screenshots are 1280×800 JPEGs, the promotional tile is 440×280 PNG, and the store icon is 128×128 PNG.
- [x] Release notes, listing copy, permission explanations, and English/Chinese submission guidance prepared.

The browser screenshots use a local preview that simulates extension APIs. They do not verify real Chrome account delivery or operating-system notifications.

## Before submitting

- [ ] Confirm the existing store item's published and uploaded versions are below 1.1.0. If 1.1.0 was already uploaded, choose a higher version, update both JSON files and release documents, and rebuild.
- [ ] Publish or update the public privacy-policy page to match `PRIVACY.md`, including Chrome Sync. Confirm it is accessible without signing in and enter its URL in Privacy practices. The repository does not yet record a verified public URL.
- [ ] On a real Chrome installation, export existing history, update/reload without uninstalling, and verify the history remains. Set Focus to 1 minute; start, pause, resume, and complete it. Confirm one completion, gray idle icon, completion tab, and notification when enabled. Check CSV export and restore the preferred focus duration.
- [ ] Complete the two-device sync check in `README.md`: same extension ID/account, one completion on each device including one offline, then reconnect and verify combined totals without duplication after restart. Confirm timers remain independent.
- [ ] Update the existing listing with `store/listing.md` and the supplied images. Review the changed Chrome Sync data-use disclosures against the dashboard's current definitions.
- [ ] Confirm the public publisher/contact information and distribution settings. Preserve the existing item's identity so installed users receive the update.
- [ ] Choose immediate publication after approval or deferred publication, then submit for review. Record the submission date and status in `store/listing.md`.

## Rebuild

Run `npm test`, then `npm run package`. Packaging checks that the two version fields match, uses an explicit runtime file list, tests both ZIP archives, and generates the checksum. Rebuild after any runtime, policy, listing, or asset change.

## Official reference

- [Update an existing store item](https://developer.chrome.com/docs/webstore/update)
- [Store image requirements](https://developer.chrome.com/docs/webstore/images)
- [Privacy fields and disclosures](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
