// settingsStore.js
// One unified, persistent settings file for the whole app - frontend config,
// monday API access, and the QZ Tray tunnel connection all live here together,
// since printing (manual or via monday's automation webhook) always happens
// server-side now. Stored as plain JSON on disk, not env vars - needs a
// persistent volume mounted at SETTINGS_DIR so it survives redeploys.

const fs = require('fs');
const path = require('path');

const SETTINGS_DIR = process.env.SETTINGS_DIR || '/app/data';
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULTS = {
  mondayApiToken: '',
  webhookSecret: '',
  tunnelHost: '',
  tunnelPort: 443,
  printerName: '',
  copies: 1,
  labelTemplate: { widthMm: 100, heightMm: 60, rotation: 0, fields: [] }
};

function ensureDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

function loadSettings() {
  ensureDir();
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to read settings.json, using defaults:', err.message);
    return { ...DEFAULTS };
  }
}

function saveSettings(partial) {
  ensureDir();
  const current = loadSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadSettings, saveSettings };
