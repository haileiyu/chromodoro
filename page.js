// Shared by the history and options pages.
export const $ = id => document.getElementById(id);

export function report(error) {
  // Messages from Chrome arrive capitalized; every visible string here is lowercase.
  $('error').textContent = (error.message || String(error)).toLowerCase();
  $('error').hidden = false;
}

export async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'the extension is unavailable. reload this page and try again.');
  $('error').hidden = true;
  return response.state;
}
