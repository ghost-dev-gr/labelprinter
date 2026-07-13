// qzPrint.js
// Real QZ Tray integration - connects to window.qz in the browser (loaded via CDN in
// App.jsx), or to globalThis.qz when run server-side (see server/qzClient.js, which
// polyfills WebSocket + qz-tray on globalThis so this same code works from Node too).
// Wraps websocket connection with Local Network Access detection (window.lna) when present.

import { signRequest } from './qzSignature.js';

function getQz() {
  const qzClient = typeof window !== 'undefined' ? window.qz : globalThis.qz;
  if (!qzClient) {
    throw new Error('QZ Tray library not loaded. Make sure qz is available.');
  }
  return qzClient;
}

// QZ Industries' official demo certificate (public, safe to embed)
const QZ_DEMO_CERT =
  '-----BEGIN CERTIFICATE-----\n' +
  'MIIE9TCCAt2gAwIBAgIQNzkyMDI0MTIyMDE5MDI0NDANBgkqhkiG9w0BAQsFADCB\n' +
  'mDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMRswGQYDVQQKDBJRWiBJbmR1c3Ry\n' +
  'aWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMsIExMQzEZMBcGA1UEAwwQ\n' +
  'cXppbmR1c3RyaWVzLmNvbTEnMCUGCSqGSIb3DQEJARYYc3VwcG9ydEBxemluZHVz\n' +
  'dHJpZXMuY29tMB4XDTI0MTIyMDE5MDI0NFoXDTI5MTIyMDE4NTMxOVowga4xFjAU\n' +
  'BgNVBAYMDVVuaXRlZCBTdGF0ZXMxCzAJBgNVBAgMAk5ZMRIwEAYDVQQHDAlDYW5h\n' +
  'c3RvdGExGzAZBgNVBAoMElFaIEluZHVzdHJpZXMsIExMQzEbMBkGA1UECwwSUVog\n' +
  'SW5kdXN0cmllcywgTExDMRswGQYDVQQDDBJRWiBJbmR1c3RyaWVzLCBMTEMxHDAa\n' +
  'BgkqhkiG9w0BCQEMDXN1cHBvcnRAcXouaW8wggEiMA0GCSqGSIb3DQEBAQUAA4IB\n' +
  'DwAwggEKAoIBAQC+j6ewVhtLHbY3uBNgqNB5DSz+QX9Pz5Dm46bI9vt/Q1Q6BL8I\n' +
  'dhaxT2PA1AY0fqQgkzlSrwqNCjWZcrNZRw/e54FGM8zf3azbHrQif6d7Wo1JK5oN\n' +
  'kI3jdB54YVwHIAt6i3BcLIvyOHsPnrKjlpROz72Kx1kK5g0gLDuH5RYVM9KFK+HR\n' +
  'fBc3JSfeg8nUkTqYJVzlT5AGRWPXeDWloqQqSyuB1t8DihNBReWyJHQ7a4yerLOI\n' +
  'J6N0jAlLDx9yt9UznAxnoO+7tKBfxCbNJerGfePMOwRKq0gx+r8M/FTrAoj+yc+T\n' +
  'SOYtuY/VZ79HCTP/vLgm1pGyrta1we24fVezAgMBAAGjIzAhMB8GA1UdIwQYMBaA\n' +
  'FJCmULeE1LnqX/IFhBN4ReipdVRcMA0GCSqGSIb3DQEBCwUAA4ICAQAMvfp931Zt\n' +
  'PgfqGXSrsM+GAVBxcRVm14MyldWfRr+MVaFZ6cH7c+fSs8hUt2qNPwHrnpK9eev5\n' +
  'MPUL27hjfiTPwv1ojLJ180aMO0ZAfPfnKeLO8uTzY7GiPQeGK7Qh39kX9XxEOidG\n' +
  'rMwfllZ6jJReS0ZGaX8LUXhh9RHGSYJhxgyUV7clB/dJch8Bbcd+DOxwc1POUHx1\n' +
  'wWExKkoWzHCCYNvqxLC9p1eO2Elz9J9ynDjXtCBl7lssnoSUKtahBCKgN5tYmZZK\n' +
  'NErKPQpbYk5yTEK1gybxhup8i2sGEJXZ9HRJLAl0UxB+eCu1ExWv7eGbcbIZJbeh\n' +
  'bwRf03fatsqzCQbGboLWtMQfcxHrEu+5MdZwOFx8i+c0c2WYad2MkkzGYHBVHPtY\n' +
  'o+PR61uIwJC2mNkPpX94CIFxSHyZumttyVKF4AhIPm9IMGTHaIr5M39zesQpVc7N\n' +
  'VIgxmMuePBrLyh6vKvuqD7W3S2HWA/8IUX703tdhoXhv5lNo1j0oywSrrUkCvUvJ\n' +
  'FjPS8+VUtVZNl7SVetQTexdcUwoADj6c1UwL9QWItskJ5Myesco3ZY0O+3QbgCuQ\n' +
  'SRqN5D0qdaLNMdEwh1YekUp4i1jm0jzPzia+WvJrW1k1ZafV6ep+YkMBkC1SFYFw\n' +
  '1Mdy+fYGyXlSn/Mvou//SSb0fUMIpXE9NA==\n' +
  '-----END CERTIFICATE-----\n' +
  '--START INTERMEDIATE CERT--\n' +
  '-----BEGIN CERTIFICATE-----\n' +
  'MIIFEjCCA/qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwgawxCzAJBgNVBAYTAlVT\n' +
  'MQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYDVQQKDBJRWiBJ\n' +
  'bmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMsIExMQzEZMBcG\n' +
  'A1UEAwwQcXppbmR1c3RyaWVzLmNvbTEnMCUGCSqGSIb3DQEJARYYc3VwcG9ydEBx\n' +
  'emluZHVzdHJpZXMuY29tMB4XDTE1MDMwMjAwNTAxOFoXDTM1MDMwMjAwNTAxOFow\n' +
  'gZgxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJOWTEbMBkGA1UECgwSUVogSW5kdXN0\n' +
  'cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMxGTAXBgNVBAMM\n' +
  'EHF6aW5kdXN0cmllcy5jb20xJzAlBgkqhkiG9w0BCQEWGHN1cHBvcnRAcXppbmR1\n' +
  'c3RyaWVzLmNvbTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANTDgNLU\n' +
  'iohl/rQoZ2bTMHVEk1mA020LYhgfWjO0+GsLlbg5SvWVFWkv4ZgffuVRXLHrwz1H\n' +
  'YpMyo+Zh8ksJF9ssJWCwQGO5ciM6dmoryyB0VZHGY1blewdMuxieXP7Kr6XD3GRM\n' +
  'GAhEwTxjUzI3ksuRunX4IcnRXKYkg5pjs4nLEhXtIZWDLiXPUsyUAEq1U1qdL1AH\n' +
  'EtdK/L3zLATnhPB6ZiM+HzNG4aAPynSA38fpeeZ4R0tINMpFThwNgGUsxYKsP9kh\n' +
  '0gxGl8YHL6ZzC7BC8FXIB/0Wteng0+XLAVto56Pyxt7BdxtNVuVNNXgkCi9tMqVX\n' +
  'xOk3oIvODDt0UoQUZ/umUuoMuOLekYUpZVk4utCqXXlB4mVfS5/zWB6nVxFX8Io1\n' +
  '9FOiDLTwZVtBmzmeikzb6o1QLp9F2TAvlf8+DIGDOo0DpPQUtOUyLPCh5hBaDGFE\n' +
  'ZhE56qPCBiQIc4T2klWX/80C5NZnd/tJNxjyUyk7bjdDzhzT10CGRAsqxAnsjvMD\n' +
  '2KcMf3oXN4PNgyfpbfq2ipxJ1u777Gpbzyf0xoKwH9FYigmqfRH2N2pEdiYawKrX\n' +
  '6pyXzGM4cvQ5X1Yxf2x/+xdTLdVaLnZgwrdqwFYmDejGAldXlYDl3jbBHVM1v+uY\n' +
  '5ItGTjk+3vLrxmvGy5XFVG+8fF/xaVfo5TW5AgMBAAGjUDBOMB0GA1UdDgQWBBSQ\n' +
  'plC3hNS56l/yBYQTeEXoqXVUXDAfBgNVHSMEGDAWgBQDRcZNwPqOqQvagw9BpW0S\n' +
  'BkOpXjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAJIO8SiNr9jpLQ\n' +
  'eUsFUmbueoxyI5L+P5eV92ceVOJ2tAlBA13vzF1NWlpSlrMmQcVUE/K4D01qtr0k\n' +
  'gDs6LUHvj2XXLpyEogitbBgipkQpwCTJVfC9bWYBwEotC7Y8mVjjEV7uXAT71GKT\n' +
  'x8XlB9maf+BTZGgyoulA5pTYJ++7s/xX9gzSWCa+eXGcjguBtYYXaAjjAqFGRAvu\n' +
  'pz1yrDWcA6H94HeErJKUXBakS0Jm/V33JDuVXY+aZ8EQi2kV82aZbNdXll/R6iGw\n' +
  '2ur4rDErnHsiphBgZB71C5FD4cdfSONTsYxmPmyUb5T+KLUouxZ9B0Wh28ucc1Lp\n' +
  'rbO7BnjW\n' +
  '-----END CERTIFICATE-----\n';

let qzSecurityInitialized = false;

async function initQzSecurity(certificate, privateKey) {
  if (qzSecurityInitialized) return;
  const qz = getQz();
  
  // Set certificate
  qz.security.setCertificatePromise((resolve) => {
    resolve(certificate || QZ_DEMO_CERT);
  });
  
  // Set signature algorithm
  qz.security.setSignatureAlgorithm('SHA512');
  
  // Set signature function
  if (privateKey) {
    qz.security.setSignaturePromise((toSign) => {
      return (resolve, reject) => {
        signRequest(toSign, privateKey)
          .then(signature => resolve(signature))
          .catch(err => reject(err));
      };
    });
  } else {
    // No private key - empty signature (demo mode)
    qz.security.setSignaturePromise(() => (resolve) => resolve());
  }
  
  qzSecurityInitialized = true;
}

// REAL CONNECTION: calls window.qz.websocket.connect() wrapped with window.lna.detectLna()
export async function ensureConnected(connSettings = {}) {
  console.log('[qzPrint] ensureConnected() called with:', connSettings);
  const qz = getQz();
  console.log('[qzPrint] qz object retrieved:', typeof qz);
  
  await initQzSecurity(connSettings.certificate, connSettings.privateKey);
  console.log('[qzPrint] security initialized');

  const isActive = qz.websocket.isActive();
  console.log('[qzPrint] websocket.isActive():', isActive);
  if (isActive) {
    console.log('[qzPrint] already connected, returning early');
    return;
  }

  const options = {
    host: connSettings.host || 'localhost',
    usingSecure: connSettings.usingSecure === true,
    port: {
      secure: [connSettings.securePort || 8181],
      insecure: [connSettings.insecurePort || 8182]
    }
  };

  const scheme = options.usingSecure ? 'wss' : 'ws';
  const port = options.usingSecure ? options.port.secure[0] : options.port.insecure[0];
  const wsUrl = `${scheme}://${options.host}:${port}/`;
  
  console.log('[qzPrint] attempting connection to:', wsUrl);
  console.log('[qzPrint] connection options:', options);

  // This function ACTUALLY CALLS window.qz.websocket.connect()
  const doConnect = () => {
    console.log('[qzPrint] doConnect() executing - calling qz.websocket.connect()');
    return qz.websocket.connect(options);
  };

  // Wrap with Local Network Access detector (window.lna) if available — browser only,
  // there's no equivalent (or need for one) when connecting from the server.
  const lna = typeof window !== 'undefined' ? window.lna : null;
  if (lna?.detectLna) {
    console.log('[qzPrint] window.lna.detectLna found, wrapping connection');
    try {
      await lna.detectLna(wsUrl, doConnect, { isWebSocket: true });
      console.log('[qzPrint] connection successful via LNA wrapper');
    } catch (err) {
      console.error('[qzPrint] connection failed:', err);
      if (lna.LnaError && err instanceof lna.LnaError) {
        console.log('[LNA] LnaError - denied:', err.denied, 'cause:', err.cause);
      }
      throw err;
    }
  } else {
    console.log('[qzPrint] no LNA detected, connecting directly');
    await doConnect();
    console.log('[qzPrint] connection successful (direct)');
  }
}

// REAL listPrinters: calls window.qz.printers.find()
export async function listPrinters(connSettings) {
  await ensureConnected(connSettings);
  const qz = getQz();
  return qz.printers.find();
}

export async function disconnect() {
  const qz = getQz();
  if (qz.websocket.isActive()) {
    await qz.websocket.disconnect();
  }
}

export const DEFAULT_CONNECTION_SETTINGS = {
  host: 'localhost',
  usingSecure: false,
  securePort: 8181,
  insecurePort: 8182,
  printerOverride: '',
  copies: 1
};

// Physical bounding box of the label as it feeds into the printer once rotated —
// a 90/270 rotation swaps which dimension is "width" vs "height" on the physical page.
export function getPrintedDimensions(template) {
  const rotation = ((template.rotation || 0) % 360 + 360) % 360;
  if (rotation === 90 || rotation === 270) {
    return { pageWidth: template.heightMm, pageHeight: template.widthMm, rotation };
  }
  return { pageWidth: template.widthMm, pageHeight: template.heightMm, rotation };
}

// A rotated field's on-page footprint (used for its bounding box) swaps width/height at
// 90/270 — CSS transform:rotate() alone never does this, it only repaints in place, so
// anything that positions/clamps against the field's declared width/height (dragging,
// alignment, other fields' layout) would otherwise be working against stale dimensions.
export function getFieldFootprint(field) {
  const rotation = ((field.rotation || 0) % 360 + 360) % 360;
  if (rotation === 90 || rotation === 270) {
    return { footprintWidth: field.height, footprintHeight: field.width, rotation };
  }
  return { footprintWidth: field.width, footprintHeight: field.height, rotation };
}

// Rotates an (dx,dy) offset by angleDeg, using the same convention as CSS transform:rotate().
function rotateOffset(dx, dy, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

// Single source of truth for where a field ends up on the printed page and at what
// rotation, composing the label's print rotation with the field's own rotation. Both
// renderLabelToCanvas (below) and the Label Designer's "Preview As Printed" mode call this
// exact function — they render from the same numbers, so the preview cannot drift out of
// sync with what actually prints.
export function computeFieldPlacement(template, field) {
  const { pageWidth, pageHeight, rotation: labelRotation } = getPrintedDimensions(template);
  const { footprintWidth, footprintHeight } = getFieldFootprint(field);

  const localCenterX = field.x + footprintWidth / 2;
  const localCenterY = field.y + footprintHeight / 2;

  let pageCenterX = localCenterX;
  let pageCenterY = localCenterY;
  if (labelRotation) {
    const offset = rotateOffset(
      localCenterX - template.widthMm / 2,
      localCenterY - template.heightMm / 2,
      labelRotation
    );
    pageCenterX = pageWidth / 2 + offset.x;
    pageCenterY = pageHeight / 2 + offset.y;
  }

  const rotation = ((labelRotation + (field.rotation || 0)) % 360 + 360) % 360;

  return {
    left: pageCenterX - field.width / 2,
    top: pageCenterY - field.height / 2,
    width: field.width,
    height: field.height,
    rotation,
    pageWidth,
    pageHeight
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Server-side print path — no browser, no canvas needed. Builds the label as an HTML
// string using computeFieldPlacement (the same position math the browser's canvas
// rendering uses), so positions stay consistent between the two paths. QZ Tray rasterizes
// this HTML itself. Used only by server/printService.js for webhook-triggered auto-print;
// the browser's own printing (Test Print, Quick Print, etc.) is untouched and still uses
// the canvas path above.
export function buildLabelHtml(template, values, columns = []) {
  const { pageWidth, pageHeight } = getPrintedDimensions(template);
  const verticalAlignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

  const fieldsHtml = template.fields.map((f) => {
    const textVal = values[f.columnId];
    let formattedText = escapeHtml(textVal);

    if (f.showLabel) {
      const colTitle = f.columnId === 'name' ? 'Item' : (columns.find((c) => c.id === f.columnId)?.title || f.columnId);
      formattedText = `<span style="opacity:0.6;font-size:80%;margin-right:4px;">${escapeHtml(colTitle)}:</span>${formattedText}`;
    }

    const sizeStyle = f.wrap
      ? `width:${f.width}mm;min-height:${f.height}mm;height:auto;overflow:visible;white-space:normal;word-break:break-word;`
      : `width:${f.width}mm;height:${f.height}mm;overflow:hidden;white-space:nowrap;`;

    const textStyle =
      `font-size:${f.fontSize}mm;font-family:Arial,Helvetica,sans-serif;line-height:1.2;` +
      `text-align:${f.align || 'left'};font-weight:${f.bold ? 'bold' : 'normal'};` +
      `display:flex;align-items:${verticalAlignMap[f.verticalAlign] || 'center'};` +
      `justify-content:${f.align === 'center' ? 'center' : f.align === 'right' ? 'flex-end' : 'flex-start'};` +
      `color:#000;`;

    const placement = computeFieldPlacement(template, f);
    const rotationStyle = placement.rotation
      ? `transform:rotate(${placement.rotation}deg);transform-origin:center center;`
      : '';

    return (
      `<div style="position:absolute;left:${placement.left}mm;top:${placement.top}mm;` +
      sizeStyle + textStyle + rotationStyle +
      `">${formattedText}</div>`
    );
  }).join('');

  return (
    `<div style="position:relative;width:${pageWidth}mm;height:${pageHeight}mm;` +
    `background:#ffffff;overflow:hidden;margin:0;padding:0;">${fieldsHtml}</div>`
  );
}

export async function printLabelHtml(printerName, template, values, columns, { connSettings, copies = 1 } = {}) {
  await ensureConnected(connSettings);
  const qz = getQz();

  const { pageWidth, pageHeight } = getPrintedDimensions(template);
  const config = qz.configs.create(printerName, {
    size: { width: pageWidth, height: pageHeight },
    units: 'mm',
    margins: 0,
    rasterize: true,
    colorType: 'grayscale',
    copies
  });

  const html = buildLabelHtml(template, values, columns);
  const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }];
  await qz.print(config, data);
}

// Breaks text into lines that fit within maxWidthPx, using the canvas context's current
// font for measurement. Falls back to one line if a single word is already too wide.
function wrapTextToLines(ctx, text, maxWidthPx) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// Draws the whole label directly onto a canvas using the Canvas 2D API — every position,
// rotation and line-wrap decision is computed by us in plain JS (via computeFieldPlacement),
// instead of handing HTML/CSS to a renderer to interpret. This sidesteps QZ Tray's embedded
// HTML rasterizer entirely — printing becomes "print this exact bitmap," which every
// printer driver handles the same, deterministic way.
export function renderLabelToCanvas(canvas, template, values, columns = [], dpi = 300) {
  const pxPerMm = dpi / 25.4;
  const { pageWidth, pageHeight } = getPrintedDimensions(template);

  canvas.width = Math.max(1, Math.round(pageWidth * pxPerMm));
  canvas.height = Math.max(1, Math.round(pageHeight * pxPerMm));

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  template.fields.forEach((f) => {
    // One malformed field (bad value, NaN geometry, etc.) must not blank out every other
    // field on the label — draw each independently and skip+log failures individually.
    try {
      const textVal = values[f.columnId] ?? '';
      let text = String(textVal);

      if (f.showLabel) {
        const colTitle = f.columnId === 'name' ? 'Item' : (columns.find((c) => c.id === f.columnId)?.title || f.columnId);
        text = `${colTitle}: ${text}`;
      }

      const placement = computeFieldPlacement(template, f);
      const boxWidthPx = f.width * pxPerMm;
      const boxHeightPx = f.height * pxPerMm;
      const fontSizePx = f.fontSize * pxPerMm;

      ctx.save();
      ctx.translate((placement.left + f.width / 2) * pxPerMm, (placement.top + f.height / 2) * pxPerMm);
      ctx.rotate((placement.rotation * Math.PI) / 180);

      if (!f.wrap) {
        ctx.beginPath();
        ctx.rect(-boxWidthPx / 2, -boxHeightPx / 2, boxWidthPx, boxHeightPx);
        ctx.clip();
      }

      ctx.font = `${f.bold ? 'bold ' : ''}${fontSizePx}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = f.align === 'center' ? 'center' : f.align === 'right' ? 'right' : 'left';
      const textX = f.align === 'center' ? 0 : f.align === 'right' ? boxWidthPx / 2 : -boxWidthPx / 2;

      const lines = f.wrap ? wrapTextToLines(ctx, text, boxWidthPx) : [text];
      const lineHeightPx = fontSizePx * 1.2;
      const totalHeightPx = lines.length * lineHeightPx;

      let startY;
      if (f.verticalAlign === 'top') startY = -boxHeightPx / 2 + fontSizePx;
      else if (f.verticalAlign === 'bottom') startY = boxHeightPx / 2 - totalHeightPx + fontSizePx;
      else startY = -totalHeightPx / 2 + fontSizePx;

      lines.forEach((line, i) => {
        ctx.fillText(line, textX, startY + i * lineHeightPx);
      });

      ctx.restore();
    } catch (err) {
      console.error('[renderLabelToCanvas] failed to draw field', f.id, f.columnId, err);
      ctx.restore();
    }
  });
}

// Generates the exact PNG that will be sent to the printer — nothing else in this file
// generates print image bytes any other way. Use this to show the user the literal file
// before printing it (see printImageDataUrl), not a live-updating approximation.
export function generateLabelImageDataUrl(template, values, columns = [], dpi = 300) {
  const canvas = document.createElement('canvas');
  renderLabelToCanvas(canvas, template, values, columns, dpi);
  return canvas.toDataURL('image/png');
}

// Sends a PRE-GENERATED image (from generateLabelImageDataUrl) to the printer as-is — no
// regeneration, so whatever was shown to the user as a preview is byte-for-byte what prints.
export async function printImageDataUrl(printerName, template, dataUrl, { connSettings, copies = 1 } = {}) {
  await ensureConnected(connSettings);
  const qz = getQz();

  const { pageWidth, pageHeight } = getPrintedDimensions(template);
  const base64 = dataUrl.split(',')[1];

  const config = qz.configs.create(printerName, {
    size: { width: pageWidth, height: pageHeight },
    units: 'mm',
    margins: 0,
    colorType: 'grayscale',
    copies: copies
  });

  const data = [{ type: 'pixel', format: 'image', flavor: 'base64', data: base64 }];

  await qz.print(config, data);
}

export async function printLabel(printerName, template, values, columns, opts = {}) {
  const dataUrl = generateLabelImageDataUrl(template, values, columns, 300);
  await printImageDataUrl(printerName, template, dataUrl, opts);
}
