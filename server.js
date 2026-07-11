// server.js
// Serves the built frontend (dist/) plus a small settings API backed by a
// persistent settings.json file - replaces browser localStorage so settings
// survive across browsers/devices and container restarts.

const express = require('express');
const path = require('path');
const { loadSettings, saveSettings } = require('./settingsStore');

const app = express();
app.use(express.json());

app.get('/api/settings', (req, res) => {
  res.json(loadSettings());
});

app.post('/api/settings', (req, res) => {
  const { connection, template } = req.body || {};
  const updated = saveSettings({ connection, template });
  res.json(updated);
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Static frontend build, with SPA fallback so client-side routing (if any) works.
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5175;
app.listen(PORT, () => console.log(`Label app listening on port ${PORT}`));
