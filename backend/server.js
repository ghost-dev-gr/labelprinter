// server.js
// Receives monday.com's automation webhook and prints the triggering item's
// label via QZ Tray (over the cloudflared tunnel) - no browser tab needed.

const express = require('express');
const { listPrinters, printLabel } = require('./qzPrintNode');
const { loadSettings, saveSettings } = require('./settingsStore');

const app = express();
app.use(express.json());

// Everything configurable - including the monday API token and webhook secret -
// lives in settingsStore's persistent JSON file, not env vars. PORT and
// SETTINGS_DIR are the only exceptions, since the app needs those just to find
// and serve the settings file in the first place.

function checkSecret(req, res) {
  const { webhookSecret } = loadSettings();
  // No secret configured yet (first-time setup) - allow through so you can set one.
  if (!webhookSecret) return true;
  if (req.query.secret !== webhookSecret) {
    res.status(401).json({ error: 'Invalid secret' });
    return false;
  }
  return true;
}

const COLUMNS = [
  { id: 'sku', title: 'SKU' },
  { id: 'price', title: 'Price' },
  { id: 'totalPrice', title: 'Total Price' },
  { id: 'quantity', title: 'Quantity' }
];

async function mondayApi(query, variables) {
  const { mondayApiToken } = loadSettings();
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: mondayApiToken
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error('monday API error: ' + JSON.stringify(json.errors));
  }
  return json.data;
}

async function getItemValues(itemId) {
  const data = await mondayApi(
    `query ($itemId: [ID!]) {
      items (ids: $itemId) {
        id
        name
        column_values { id text }
      }
    }`,
    { itemId: [String(itemId)] }
  );
  const item = data.items[0];
  const values = { name: item.name };
  for (const cv of item.column_values) {
    values[cv.id] = cv.text || '';
  }
  return values;
}

async function markPrinted(itemId, boardId) {
  await mondayApi(
    `mutation ($boardId: ID!, $itemId: ID!, $value: JSON!) {
      change_column_value(board_id: $boardId, item_id: $itemId, column_id: "printStatus", value: $value) {
        id
      }
    }`,
    { boardId: String(boardId), itemId: String(itemId), value: JSON.stringify({ label: 'Printed' }) }
  );
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Pure echo endpoint - responds with the exact same body it received. Useful
// for inspecting what monday's automation actually sends before wiring up real
// logic, and this also naturally satisfies monday's webhook verification
// handshake (it sends { challenge: "..." } once when you register the URL,
// and expects that same value echoed back - which a plain echo does for free).
app.post('/webhookv1', (req, res) => {
  console.log('[webhookv1] received:', JSON.stringify(req.body));
  res.json(req.body);
});

app.get('/printers', async (req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ printers });
  } catch (err) {
    console.error('Failed to list printers:', err);
    res.status(500).json({ error: err.message });
  }
});

// View current persistent settings (tunnel host/port, printer name, label
// template) - update them with POST below, no redeploy needed either way.
app.get('/settings', (req, res) => {
  res.json(loadSettings());
});

app.post('/settings', (req, res) => {
  if (!checkSecret(req, res)) return;
  const { tunnelHost, tunnelPort, printerName, labelTemplate, mondayApiToken, webhookSecret } = req.body || {};
  const updated = saveSettings({
    ...(tunnelHost !== undefined && { tunnelHost }),
    ...(tunnelPort !== undefined && { tunnelPort: Number(tunnelPort) }),
    ...(printerName !== undefined && { printerName }),
    ...(labelTemplate !== undefined && { labelTemplate }),
    ...(mondayApiToken !== undefined && { mondayApiToken }),
    ...(webhookSecret !== undefined && { webhookSecret })
  });
  // Don't echo secrets back in the response.
  res.json({ ...updated, mondayApiToken: updated.mondayApiToken ? '(set)' : '', webhookSecret: updated.webhookSecret ? '(set)' : '' });
});

app.post('/print-webhook', async (req, res) => {
  // monday sends a one-time verification challenge when you first register the
  // webhook URL - must echo it back exactly or the webhook registration fails.
  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }

  if (!checkSecret(req, res)) return;

  const event = req.body.event || {};
  const itemId = event.pulseId || event.itemId;
  const boardId = event.boardId;

  if (!itemId) {
    console.warn('Webhook payload missing itemId/pulseId:', JSON.stringify(req.body));
    return res.status(400).json({ error: 'No item id in payload' });
  }

  // Respond to monday immediately - printing happens after, monday doesn't
  // wait for the actual print job to finish.
  res.json({ ok: true });

  try {
    const { printerName, labelTemplate } = loadSettings();
    const values = await getItemValues(itemId);
    const copies = values.quantity && Number(values.quantity) > 0 ? Number(values.quantity) : 1;

    await printLabel(printerName, labelTemplate, values, COLUMNS, copies);
    console.log(`Printed item ${itemId} (${values.name})`);

    if (boardId) {
      await markPrinted(itemId, boardId).catch((err) =>
        console.error('Failed to mark item as printed:', err.message)
      );
    }
  } catch (err) {
    console.error(`Failed to print item ${itemId}:`, err);
  }
});

const PORT = process.env.PORT || 5175;
app.listen(PORT, () => console.log(`Print webhook backend listening on port ${PORT}`));
