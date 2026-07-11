// server.js
// Receives monday.com's automation webhook and prints the triggering item's
// label via QZ Tray (over the cloudflared tunnel) - no browser tab needed.

const express = require('express');
const { listPrinters, printLabel } = require('./qzPrintNode');

const app = express();
app.use(express.json());

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const PRINTER_NAME = process.env.PRINTER_NAME || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Template is configured via env var for now (JSON string) - same shape as the
// browser app's saved template. Swap this for a real monday.storage fetch later.
let TEMPLATE;
try {
  TEMPLATE = JSON.parse(process.env.LABEL_TEMPLATE_JSON || '{}');
} catch (err) {
  console.error('LABEL_TEMPLATE_JSON is not valid JSON:', err.message);
  TEMPLATE = { widthMm: 100, heightMm: 60, rotation: 0, fields: [] };
}

const COLUMNS = [
  { id: 'sku', title: 'SKU' },
  { id: 'price', title: 'Price' },
  { id: 'totalPrice', title: 'Total Price' },
  { id: 'quantity', title: 'Quantity' }
];

async function mondayApi(query, variables) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: MONDAY_API_TOKEN
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

app.get('/printers', async (req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ printers });
  } catch (err) {
    console.error('Failed to list printers:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/print-webhook', async (req, res) => {
  // monday sends a one-time verification challenge when you first register the
  // webhook URL - must echo it back exactly or the webhook registration fails.
  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }

  if (WEBHOOK_SECRET && req.query.secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

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
    const values = await getItemValues(itemId);
    const copies = values.quantity && Number(values.quantity) > 0 ? Number(values.quantity) : 1;

    await printLabel(PRINTER_NAME, TEMPLATE, values, COLUMNS, copies);
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
