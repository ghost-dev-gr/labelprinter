// qzPrint.js
// Talks to the local QZ Tray agent (ws://localhost:8182 by default, or custom host/port
// via connSettings) running on the same machine as the browser. QZ Tray forwards raw
// pixel/HTML print jobs through the normal Windows print pipeline to the HPRT HT600 -
// validated working approach (raw TSPL passthrough did NOT work with the stock HPRT driver).
//
// Requires the qz-tray script to be loaded on the page, e.g.:
//   <script src="https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js"></script>

function getQz() {
  if (!window.qz) {
    throw new Error('QZ Tray library not loaded. Make sure the script is included and has finished loading.');
  }
  return window.qz;
}

// This is QZ Industries' own published demo certificate (from their official
// sample.html on GitHub) - public and safe to embed, not a secret. It only
// labels the "Allow this site to print?" permission dialog with a known name
// instead of "Unsigned/anonymous request" - it does NOT affect wss:// transport
// trust, which the browser checks separately before any of this runs.
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
function initQzSecurity() {
  if (qzSecurityInitialized) return;
  const qz = getQz();
  qz.security.setCertificatePromise((resolve) => resolve(QZ_DEMO_CERT));
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(() => (resolve) => resolve()); // unsigned - matches QZ's own demo
  qzSecurityInitialized = true;
}

// connSettings: { host, usingSecure, securePort, insecurePort } - see connectionSettings.js.
// IMPORTANT: `port.secure` / `port.insecure` must be ARRAYS of fallback ports, not
// bare numbers - QZ Tray's internal findConnection() does `wsPorts.length` on
// whichever one it picks based on usingSecure, and throws either
// "Cannot read properties of undefined (reading 'length')" (given a plain object/number)
// or "No ports have been specified to connect over" (given a number, since numbers
// have no .length so it reads as falsy) if the array wrapper is missing.
export async function ensureConnected(connSettings = {}) {
  const qz = getQz();
  initQzSecurity();

  if (qz.websocket.isActive()) return;

  const options = {
    host: connSettings.host || 'localhost',
    usingSecure: connSettings.usingSecure === true, // ws:// by default unless explicitly enabled
    port: {
      secure: [connSettings.securePort || 8181],
      insecure: [connSettings.insecurePort || 8182]
    }
  };

  const scheme = options.usingSecure ? 'wss' : 'ws';
  const port = options.usingSecure ? options.port.secure[0] : options.port.insecure[0];
  const wsUrl = `${scheme}://${options.host}:${port}/`;

  const doConnect = () => qz.websocket.connect(options);

  // Wrap with QZ's own Local Network Access detector if it loaded successfully -
  // this can't force a blocked connection through, but on failure it re-checks the
  // browser's permission state and throws a proper LnaError with a `.denied` flag
  // (true/false/undefined) instead of a generic WebSocket error, so we know exactly
  // whether Chrome explicitly denied Local Network Access or something else failed.
  if (window.lna?.detectLna) {
    try {
      await window.lna.detectLna(wsUrl, doConnect, { isWebSocket: true });
    } catch (err) {
      if (window.lna.LnaError && err instanceof window.lna.LnaError) {
        console.log('[LNA] LnaError - denied:', err.denied, 'cause:', err.cause);
      }
      throw err;
    }
  } else {
    await doConnect();
  }
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

export const DEFAULT_CONNECTION_SETTINGS = {
  host: 'localhost',
  usingSecure: false, // ws:// only - avoids QZ Tray's self-signed wss:// cert trust issues; browsers exempt localhost from mixed-content blocking even on an https page
  securePort: 8181,
  insecurePort: 8182,
  printerOverride: '', // blank = auto-detect by name match, else exact printer name
  copies: 1
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// template shape:
// {
//   widthMm: 100, heightMm: 80, rotation: 0, // 0 | 90 | 180 | 270
//   fields: [
//     { id, columnId, x, y, width, height, fontSize, align, bold }
//   ]
// }
// values: { [columnId]: displayText }
export function buildLabelHtml(template, values) {
  const fieldsHtml = template.fields.map((f) => {
    const text = escapeHtml(values[f.columnId]);
    return (
      `<div style="position:absolute;left:${f.x}mm;top:${f.y}mm;` +
      `width:${f.width}mm;height:${f.height}mm;` +
      `font-size:${f.fontSize}mm;font-family:sans-serif;` +
      `text-align:${f.align || 'left'};font-weight:${f.bold ? 'bold' : 'normal'};` +
      `overflow:hidden;white-space:nowrap;">${text}</div>`
    );
  }).join('');

  return (
    `<div style="position:relative;width:${template.widthMm}mm;` +
    `height:${template.heightMm}mm;">${fieldsHtml}</div>`
  );
}

export async function printLabel(printerName, template, values, { connSettings, copies = 1 } = {}) {
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

  const html = buildLabelHtml(template, values);
  const data = [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }];

  await qz.print(config, data);
}
