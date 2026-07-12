// qzPrint.js
// Real QZ Tray integration - connects to window.qz loaded by the stub in App.jsx
// Wraps websocket connection with Local Network Access detection (window.lna)

import { signRequest } from './qzSignature';

function getQz() {
  if (!window.qz) {
    throw new Error('QZ Tray library not loaded. Make sure qz is available on window.');
  }
  return window.qz;
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

  // Wrap with Local Network Access detector (window.lna) if available
  if (window.lna?.detectLna) {
    console.log('[qzPrint] window.lna.detectLna found, wrapping connection');
    try {
      await window.lna.detectLna(wsUrl, doConnect, { isWebSocket: true });
      console.log('[qzPrint] connection successful via LNA wrapper');
    } catch (err) {
      console.error('[qzPrint] connection failed:', err);
      if (window.lna.LnaError && err instanceof window.lna.LnaError) {
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildLabelHtml(template, values, columns = []) {
  const fieldsHtml = template.fields.map((f) => {
    const textVal = values[f.columnId];
    let formattedText = escapeHtml(textVal);
    
    if (f.showLabel) {
      const colTitle = f.columnId === 'name' ? 'Item' : (columns.find(c => c.id === f.columnId)?.title || f.columnId);
      formattedText = `<span style="opacity: 0.6; font-size: 80%; margin-right: 4px;">${escapeHtml(colTitle)}:</span>${formattedText}`;
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

export async function printLabel(printerName, template, values, columns, { connSettings, copies = 1 } = {}) {
  await ensureConnected(connSettings);
  const qz = getQz();

  const config = qz.configs.create(printerName, {
    size: { width: template.widthMm, height: template.heightMm },
    units: 'mm',
    margins: 0,
    rasterize: true,
    colorType: 'grayscale',
    rotation: template.rotation || 0,
    copies: copies
  });

  const html = buildLabelHtml(template, values, columns);
  const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }];

  await qz.print(config, data);
}
