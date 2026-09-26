export const SHEETS_ORIGINS = ['https://script.google.com/*', 'https://script.googleusercontent.com/*'];
export const SHEETS_ALARM = 'chromodoro-sheets';
const RETRY_MS = 5 * 60000;

export function validateConnection(input) {
  const url = input?.url?.trim();
  const token = input?.token?.trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url ?? '')) {
    throw new Error('Paste the deployed Google Apps Script URL ending in /exec.');
  }
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token ?? '')) throw new Error('Paste the sync key from the setup script.');
  return { url, token };
}

// Separate queue: a slow upload must never hold up the timer's storage queue.
// Compare durable snapshots, so a worker killed during a request safely resends.
export function createSheetsSync(chrome, fetcher = globalThis.fetch) {
  let queue = Promise.resolve();
  const enqueue = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const read = async () => (await chrome.storage.local.get('sheetsSync')).sheetsSync;
  const status = config => ({
    enabled: Boolean(config?.url), url: config?.url ?? '',
    lastSyncedAt: config?.lastSyncedAt ?? null, error: config?.error ?? ''
  });
  async function attempt(force = false) {
    const config = await read();
    if (!config?.url) return status(config);
    if (!await chrome.alarms.get(SHEETS_ALARM)) {
      await chrome.alarms.create(SHEETS_ALARM, { periodInMinutes: 5 });
    }
    const { state } = await chrome.storage.local.get('state');
    const rows = Object.entries(state?.days ?? {}).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => [date, day.count, day.minutes]);
    const snapshot = JSON.stringify(rows);
    if (!force && ((config.snapshot === snapshot && !config.error) || config.retryAt > Date.now())) return status(config);
    // Persist the backoff before network I/O, including across worker termination.
    config.retryAt = Date.now() + RETRY_MS;
    await chrome.storage.local.set({ sheetsSync: config });
    try {
      if (!await chrome.permissions.contains({ origins: SHEETS_ORIGINS })) {
        throw new Error('Google access was removed. Reconnect to allow syncing.');
      }
      const response = await fetcher(config.url, {
        method: 'POST', credentials: 'omit', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ version: 1, token: config.token, source: config.source, rows }),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`Google returned HTTP ${response.status}. Check the deployment and try again.`);
      let result;
      try { result = await response.json(); } catch {
        throw new Error('Google did not return sync data. Deploy the web app with access set to Anyone.');
      }
      if (result?.ok !== true) {
        throw new Error(result?.error === 'unauthorized' ? 'The sync key was rejected. Check the key and reconnect.' : 'The sheet could not be updated. Check the Apps Script setup and deployment.');
      }
      config.snapshot = snapshot;
      config.lastSyncedAt = Date.now();
      config.retryAt = 0;
      config.error = '';
    } catch (error) {
      // Do not expose raw fetch errors: they can contain the deployment URL.
      config.error = error.name === 'TimeoutError' || error.name === 'TypeError'
        ? 'Could not reach Google. Your history is safe here; sync will retry in five minutes.'
        : error.message;
    }
    await chrome.storage.local.set({ sheetsSync: config });
    return status(config);
  }
  return {
    get: async () => status(await read()),
    kick: () => enqueue(() => attempt()).catch(error => console.warn('Sheets sync unavailable:', error)),
    syncNow: () => enqueue(() => attempt(true)),
    connect: input => enqueue(async () => {
      const connection = validateConnection(input);
      if (!await chrome.permissions.contains({ origins: SHEETS_ORIGINS })) throw new Error('Allow Google access to connect.');
      let { sheetsSource } = await chrome.storage.local.get('sheetsSource');
      if (!sheetsSource) {
        sheetsSource = crypto.randomUUID();
        await chrome.storage.local.set({ sheetsSource });
      }
      await chrome.storage.local.set({ sheetsSync: { ...connection, source: sheetsSource } });
      return attempt(true);
    }),
    disconnect: () => enqueue(async () => {
      await chrome.storage.local.remove('sheetsSync');
      await chrome.alarms.clear(SHEETS_ALARM);
      await chrome.permissions.remove({ origins: SHEETS_ORIGINS });
      return status(null);
    })
  };
}
