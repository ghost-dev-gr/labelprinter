// settingsApi.js
// Talks to this app's own server (server.js) - all settings and printing now
// happen server-side, so the browser never needs to connect to QZ Tray itself.

export const DEFAULT_SETTINGS = {
  mondayApiToken: '',
  webhookSecret: '',
  tunnelHost: '',
  tunnelPort: 443,
  printerName: '',
  copies: 1,
  labelTemplate: { widthMm: 100, heightMm: 60, rotation: 0, fields: [] }
};

export async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    const data = await res.json();
    return { ...DEFAULT_SETTINGS, ...data };
  } catch (err) {
    console.error('fetchSettings failed, using defaults:', err.message);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(partial) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial)
  });
  return res.json();
}

export async function fetchPrinters() {
  const res = await fetch('/api/printers');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch printers');
  }
  const data = await res.json();
  return data.printers;
}

export async function printLabelServerSide(values) {
  const res = await fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Print failed');
  }
  return res.json();
}
