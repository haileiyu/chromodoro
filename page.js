// Shared by the history and options pages.
export const $ = id => document.getElementById(id);

export function report(error) {
  $('error').textContent = error.message || String(error);
  $('error').hidden = false;
}

export async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'The extension is unavailable. Reload this page and try again.');
  $('error').hidden = true;
  return response.state;
}
