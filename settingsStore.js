// settingsStore.js
// Persistent settings (connection settings + label template) stored as a plain
// JSON file on disk, not env vars or browser localStorage - so they survive
// container restarts/redeploys and are shared across whoever opens this app.
// Needs a persistent volume mounted at SETTINGS_DIR so the file itself survives.

const fs = require('fs');
const path = require('path');

const SETTINGS_DIR = process.env.SETTINGS_DIR || '/app/data';
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULTS = {
  connection: {
    host: 'localhost',
    usingSecure: false,
    securePort: 8181,
    insecurePort: 8182,
    printerOverride: '',
    copies: 1
  },
  template: {
    widthMm: 100,
    heightMm: 60,
    rotation: 0,
    fields: []
  }
};

function ensureDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

function loadSettings() {
  ensureDir();
  if (!fs.existsSync(SETTINGS_PATH)) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      connection: { ...DEFAULTS.connection, ...(parsed.connection || {}) },
      template: parsed.template || DEFAULTS.template
    };
  } catch (err) {
    console.error('Failed to read settings.json, using defaults:', err.message);
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function saveSettings(partial) {
  ensureDir();
  const current = loadSettings();
  const next = {
    connection: { ...current.connection, ...(partial.connection || {}) },
    template: partial.template !== undefined ? partial.template : current.template
  };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadSettings, saveSettings };
