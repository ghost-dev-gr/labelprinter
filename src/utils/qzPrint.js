// qzPrint.js
// Talks to the local QZ Tray agent running on the same machine as the browser.
// Requires qz-tray.js to already be loaded on the page (see App.jsx).

function getQz() {
  if (!window.qz) {
    throw new Error('QZ Tray library not loaded. Make sure the script is included and has finished loading.');
  }
  return window.qz;
}

let qzSecurityInitialized = false;
function initQzSecurity() {
  if (qzSecurityInitialized) return;
  const qz = getQz();
  qz.security.setCertificatePromise((resolve) => resolve());
  qz.security.setSignaturePromise(() => (resolve) => resolve());
  qzSecurityInitialized = true;
}

export async function ensureConnected(connSettings = {}) {
  const qz = getQz();
  initQzSecurity();

  if (qz.websocket.isActive()) return;

  const options = {
    host: connSettings.host || 'localhost',
    usingSecure: connSettings.usingSecure === true,
    port: {
      secure: [connSettings.securePort || 8181],
      insecure: [connSettings.insecurePort || 8182]
    }
  };

  await qz.websocket.connect(options);
}

export async function listPrinters(connSettings) {
  await ensureConnected(connSettings);
  return getQz().printers.find();
}

export async function disconnect() {
  const qz = getQz();
  if (qz.websocket.isActive()) {
    await qz.websocket.disconnect();
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// template shape: { widthMm, heightMm, rotation, fields: [{ id, name, x, y, width, height, fontSize, align, bold }] }
// values: { [fieldId]: displayText }
export function buildLabelHtml(template, values) {
  const fieldsHtml = template.fields.map((f) => {
    const text = escapeHtml(values[f.id]);
    return (
      `<div style="position:absolute;left:${f.x}mm;top:${f.y}mm;` +
      `width:${f.width}mm;height:${f.height}mm;` +
      `font-size:${f.fontSize}mm;font-family:sans-serif;` +
      `text-align:${f.align || 'left'};font-weight:${f.bold ? 'bold' : 'normal'};` +
      `overflow:hidden;white-space:nowrap;color:#000;">${text}</div>`
    );
  }).join('');

  return (
    `<div style="position:relative;width:${template.widthMm}mm;` +
    `height:${template.heightMm}mm;background:#fff;">${fieldsHtml}</div>`
  );
}

export async function printLabel(printerName, template, values, options = {}) {
  await ensureConnected(options.connSettings);
  const qz = getQz();

  const config = qz.configs.create(printerName, {
    size: { width: template.widthMm, height: template.heightMm },
    units: 'mm',
    margins: 0,
    rasterize: true,
    colorType: 'grayscale',
    rotation: template.rotation || 0,
    copies: options.copies || 1
  });

  const html = buildLabelHtml(template, values);
  const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }];

  await qz.print(config, data);
}
