// connectionSettings.js
// Defines DEFAULT_CONNECTION_SETTINGS and loadConnectionSettings()/saveConnectionSettings()
// backed by localStorage (machine-specific, not shared across boards/users).

const STORAGE_KEY = 'qz_connection_settings';

export const DEFAULT_CONNECTION_SETTINGS = {
  host: 'localhost',
  usingSecure: true,
  securePort: 8181,
  insecurePort: 8182,
  printerOverride: '', // blank = auto-detect by name match on "hprt"/"ht600"
  copies: 1
};

export function loadConnectionSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONNECTION_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.error('Failed to load connection settings from localStorage:', err);
  }
  return DEFAULT_CONNECTION_SETTINGS;
}

export function saveConnectionSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save connection settings to localStorage:', err);
    throw err;
  }
}
