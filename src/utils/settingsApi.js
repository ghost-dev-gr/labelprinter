// settingsApi.js
// Talks to this app's own backend (server.js) to load/save the persistent
// settings.json file - connection settings and label template both live here
// now instead of browser localStorage.

export const DEFAULT_CONNECTION_SETTINGS = {
  host: 'localhost',
  usingSecure: false,
  securePort: 8181,
  insecurePort: 8182,
  printerOverride: '',
  copies: 1
};

export const DEFAULT_TEMPLATE = {
  widthMm: 100,
  heightMm: 60,
  rotation: 0,
  fields: []
};

export async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    const data = await res.json();
    return {
      connection: { ...DEFAULT_CONNECTION_SETTINGS, ...(data.connection || {}) },
      template: data.template || DEFAULT_TEMPLATE
    };
  } catch (err) {
    console.error('fetchSettings failed, using defaults:', err.message);
    return { connection: { ...DEFAULT_CONNECTION_SETTINGS }, template: { ...DEFAULT_TEMPLATE } };
  }
}

export async function saveConnection(connection) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection })
  });
  return res.json();
}

export async function saveTemplate(template) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });
  return res.json();
}
