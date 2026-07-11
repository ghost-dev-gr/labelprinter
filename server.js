// server.js
// One combined app: serves the React frontend, exposes the settings API the
// frontend uses, receives monday.com's automation webhook, and does the actual
// QZ Tray printing (over the cloudflared tunnel) - all server-side, so neither
// a manual print click nor an automated webhook print ever needs a browser
// connecting directly to QZ Tray (which is what triggered the whole Local
// Network Access problem earlier).

const express = require('express');
const path = require('path');
const { loadSettings, saveSettings } = require('./settingsStore');
const { listPrinters, printLabel } = require('./qzPrintNode');

const app = express();
app.use(express.json());

function checkSecret(req, res) {
  const { webhookSecret } = loadSettings();
  if (!webhookSecret) return true; // first-time setup - allow through so you can set one
  if (req.query.secret !== webhookSecret) {
    res.status(401).json({ error: 'Invalid secret' });
    return false;
  }
  return true;
}

async function mondayApi(query, variables) {
  const { mondayApiToken } = loadSettings();
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: mondayApiToken },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error('monday API error: ' + JSON.stringify(json.errors));
  return json.data;
}

async function getItemValues(itemId) {
  const data = await mondayApi(
    `query ($itemId: [ID!]) {
      items (ids: $itemId) { id name column_values { id text } }
    }`,
    { itemId: [String(itemId)] }
  );
  const item = data.items[0];
  const values = { name: item.name };
  for (const cv of item.column_values) values[cv.id] = cv.text || '';
  return values;
}

async function markPrinted(itemId, boardId) {
  await mondayApi(
    `mutation ($boardId: ID!, $itemId: ID!, $value: JSON!) {
      change_column_value(board_id: $boardId, item_id: $itemId, column_id: "printStatus", value: $value) { id }
    }`,
    { boardId: String(boardId), itemId: String(itemId), value: JSON.stringify({ label: 'Printed' }) }
  );
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Settings API used by the frontend's Connection / Label Designer tabs.
app.get('/api/settings', (req, res) => {
  const s = loadSettings();
  res.json({ ...s, mondayApiToken: s.mondayApiToken ? '(set)' : '', webhookSecret: s.webhookSecret ? '(set)' : '' });
});

app.post('/api/settings', (req, res) => {
  if (!checkSecret(req, res)) return;
  const { mondayApiToken, webhookSecret, tunnelHost, tunnelPort, printerName, copies, labelTemplate } = req.body || {};
  const updated = saveSettings({
    ...(mondayApiToken !== undefined && { mondayApiToken }),
    ...(webhookSecret !== undefined && { webhookSecret }),
    ...(tunnelHost !== undefined && { tunnelHost }),
    ...(tunnelPort !== undefined && { tunnelPort: Number(tunnelPort) }),
    ...(printerName !== undefined && { printerName }),
    ...(copies !== undefined && { copies: Number(copies) }),
    ...(labelTemplate !== undefined && { labelTemplate })
  });
  res.json({ ...updated, mondayApiToken: updated.mondayApiToken ? '(set)' : '', webhookSecret: updated.webhookSecret ? '(set)' : '' });
});

app.get('/api/printers', async (req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ printers });
  } catch (err) {
    console.error('Failed to list printers:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manual print, triggered from the frontend's Print tab - runs server-side,
// same QZ Tray connection path as the automated webhook below.
app.post('/api/print', async (req, res) => {
  try {
    const { values } = req.body || {};
    const { printerName, labelTemplate, copies } = loadSettings();
    if (!printerName) throw new Error('No printer configured - set one in the Connection tab.');
    await printLabel(printerName, labelTemplate, values || {}, [], copies || 1);
    res.json({ ok: true });
  } catch (err) {
    console.error('Manual print failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Pure echo endpoint - useful for inspecting monday's webhook payloads, and
// this also satisfies monday's webhook verification handshake for free (it
// sends { challenge: "..." } once when you register the URL, and expects that
// exact value echoed back).
app.post('/webhookv1', (req, res) => {
  console.log('[webhookv1] received:', JSON.stringify(req.body));
  res.json(req.body);
});

app.post('/print-webhook', async (req, res) => {
  if (req.body.challenge) return res.json({ challenge: req.body.challenge });
  if (!checkSecret(req, res)) return;

  const event = req.body.event || {};
  const itemId = event.pulseId || event.itemId;
  const boardId = event.boardId;

  if (!itemId) {
    console.warn('Webhook payload missing itemId/pulseId:', JSON.stringify(req.body));
    return res.status(400).json({ error: 'No item id in payload' });
  }

  res.json({ ok: true }); // respond immediately, print happens after

  try {
    const { printerName, labelTemplate, copies } = loadSettings();
    const values = await getItemValues(itemId);
    const finalCopies = values.quantity && Number(values.quantity) > 0 ? Number(values.quantity) : (copies || 1);

    await printLabel(printerName, labelTemplate, values, [], finalCopies);
    console.log(`Printed item ${itemId} (${values.name})`);

    if (boardId) {
      await markPrinted(itemId, boardId).catch((err) => console.error('Failed to mark item as printed:', err.message));
    }
  } catch (err) {
    console.error(`Failed to print item ${itemId}:`, err);
  }
});

// Static frontend build, with SPA fallback for client-side routing.
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5175;
app.listen(PORT, () => console.log(`Label app (combined) listening on port ${PORT}`));
