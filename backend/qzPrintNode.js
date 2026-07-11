// qzPrintNode.js
// Server-side counterpart to the browser qzPrint.js - same QZ Tray connect/print
// logic, but running under Node via qzNodeShim instead of in a browser tab.
// This is what lets printing happen when monday's automation fires a webhook,
// with nobody having the Vibe app open at all.

const qz = require('./qzNodeShim');
const { loadSettings } = require('./settingsStore');

let qzSecurityInitialized = false;
function initQzSecurity() {
  if (qzSecurityInitialized) return;
  // Unsigned mode - matches the browser app's setup. Fine for a single personal
  // printer; a paid signing cert would remove any local "Allow" prompt if this
  // is ever used by multiple people/printers.
  qz.security.setCertificatePromise((resolve) => resolve());
  qz.security.setSignaturePromise(() => (resolve) => resolve());
  qzSecurityInitialized = true;
}

// tunnelHost/tunnelPort come from settingsStore (persistent JSON file), not env
// vars, since the cloudflared quick-tunnel URL changes every restart and
// shouldn't require a redeploy to update.
let connectedHost = null;

async function ensureConnected() {
  initQzSecurity();

  const { tunnelHost, tunnelPort } = loadSettings();
  if (!tunnelHost) {
    throw new Error('tunnelHost is not set - POST /settings with a tunnelHost first.');
  }

  // If already connected but to a different (now-stale) host, reconnect.
  if (qz.websocket.isActive() && connectedHost === tunnelHost) return;
  if (qz.websocket.isActive() && connectedHost !== tunnelHost) {
    await qz.websocket.disconnect();
  }

  await qz.websocket.connect({
    host: tunnelHost,
    usingSecure: true,
    port: { secure: [tunnelPort], insecure: [tunnelPort] }
  });
  connectedHost = tunnelHost;
}

async function listPrinters() {
  await ensureConnected();
  return qz.printers.find();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Same template/values shape as the browser version's buildLabelHtml.
function buildLabelHtml(template, values, columns = []) {
  const fieldsHtml = template.fields.map((f) => {
    let formattedText = escapeHtml(values[f.columnId]);
    if (f.showLabel) {
      const colTitle = f.columnId === 'name' ? 'Item' : (columns.find((c) => c.id === f.columnId)?.title || f.columnId);
      formattedText = `<span style="opacity:0.6;font-size:80%;margin-right:4px;">${escapeHtml(colTitle)}:</span>${formattedText}`;
    }
    return (
      `<div style="position:absolute;left:${f.x}mm;top:${f.y}mm;` +
      `width:${f.width}mm;height:${f.height}mm;` +
      `font-size:${f.fontSize}mm;font-family:sans-serif;line-height:1.2;` +
      `text-align:${f.align || 'left'};font-weight:${f.bold ? 'bold' : 'normal'};` +
      `overflow:hidden;white-space:nowrap;display:flex;align-items:center;` +
      `justify-content:${f.align === 'center' ? 'center' : f.align === 'right' ? 'flex-end' : 'flex-start'};` +
      `color:#000;">${formattedText}</div>`
    );
  }).join('');

  return (
    `<div style="position:relative;width:${template.widthMm}mm;` +
    `height:${template.heightMm}mm;background:#ffffff;overflow:hidden;` +
    `font-family:sans-serif;color:#000000;box-sizing:border-box;margin:0;padding:0;">${fieldsHtml}</div>`
  );
}

async function printLabel(printerName, template, values, columns, copies = 1) {
  await ensureConnected();

  const config = qz.configs.create(printerName, {
    size: { width: template.widthMm, height: template.heightMm },
    units: 'mm',
    margins: 0,
    rasterize: true,
    colorType: 'grayscale',
    rotation: template.rotation || 0,
    copies
  });

  const html = buildLabelHtml(template, values, columns);
  const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }];

  await qz.print(config, data);
}

module.exports = { ensureConnected, listPrinters, printLabel, buildLabelHtml };
