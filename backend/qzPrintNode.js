// qzPrintNode.js
// Server-side counterpart to the browser qzPrint.js - same QZ Tray connect/print
// logic, but running under Node via qzNodeShim instead of in a browser tab.
// This is what lets printing happen when monday's automation fires a webhook,
// with nobody having the Vibe app open at all.

const qz = require('./qzNodeShim');

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

// env.TUNNEL_HOST / env.TUNNEL_PORT point at the cloudflared tunnel exposing
// QZ Tray's insecure port (e.g. some-name.trycloudflare.com / 443, tunneled
// through to localhost:8182 on the Windows PC running QZ Tray).
async function ensureConnected() {
  initQzSecurity();
  if (qz.websocket.isActive()) return;

  const host = process.env.TUNNEL_HOST;
  const port = Number(process.env.TUNNEL_PORT || 443);
  if (!host) {
    throw new Error('TUNNEL_HOST environment variable is not set.');
  }

  await qz.websocket.connect({
    host,
    usingSecure: true,
    port: { secure: [port], insecure: [port] }
  });
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
