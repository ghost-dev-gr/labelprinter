// connectionSettings.js
// Defines DEFAULT_CONNECTION_SETTINGS and loadConnectionSettings()/saveConnectionSettings()
// backed by monday.com storage (persists across browser closes, machine-specific per user)

import monday from 'monday-sdk-js';
const mondayClient = monday();

const STORAGE_KEY = 'qz_connection_settings';

export const DEFAULT_CONNECTION_SETTINGS = {
  host: 'localhost',
  usingSecure: true,
  securePort: 8181,
  insecurePort: 8182,
  printerOverride: '', // blank = auto-detect by name match on "hprt"/"ht600"
  copies: 1
};

export async function loadConnectionSettings() {
  try {
    // Try monday.com storage first (persists across browser closes)
    const result = await mondayClient.storage.instance.getItem(STORAGE_KEY);
    if (result && result.data && result.data.value) {
      const parsed = JSON.parse(result.data.value);
      console.log('[connectionSettings] Loaded from monday storage:', parsed);
      return { ...DEFAULT_CONNECTION_SETTINGS, ...parsed };
    }
    
    // Fallback to localStorage for backward compatibility
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('[connectionSettings] Loaded from localStorage (fallback):', parsed);
      return { ...DEFAULT_CONNECTION_SETTINGS, ...parsed };
    }
    
    console.log('[connectionSettings] No saved settings, using defaults');
  } catch (err) {
    console.error('Failed to load connection settings:', err);
  }
  return DEFAULT_CONNECTION_SETTINGS;
}

export async function saveConnectionSettings(settings) {
  try {
    const toSave = JSON.stringify(settings);
    
    // Save to monday.com storage (persists across browser closes)
    await mondayClient.storage.instance.setItem(STORAGE_KEY, toSave);
    console.log('[connectionSettings] Saved to monday storage:', settings);
    
    // Also save to localStorage as backup
    localStorage.setItem(STORAGE_KEY, toSave);
    console.log('[connectionSettings] Saved to localStorage (backup)');
  } catch (err) {
    console.error('Failed to save connection settings:', err);
    throw err;
  }
}
