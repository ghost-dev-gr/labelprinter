// qzNodeShim.js
// The official qz-tray.js client library assumes it's running in a browser
// (window, navigator, browser WebSocket). This shims just enough of that
// environment so the same, already-tested library can run under plain
// Node.js instead - reusing the real, verified protocol logic rather than
// hand-reimplementing QZ Tray's wire format from scratch.

const { WebSocket } = require('ws');
const fs = require('fs');
const path = require('path');

if (!global.window) {
  global.window = global;
}
if (!global.navigator) {
  global.navigator = { userAgent: 'node' };
}
if (!global.WebSocket) {
  global.WebSocket = WebSocket;
}

const qzSource = fs.readFileSync(path.join(__dirname, 'qz-tray.js'), 'utf8');
// eslint-disable-next-line no-eval
(0, eval)(qzSource);

if (!global.window.qz) {
  throw new Error('qz-tray.js loaded but window.qz was not defined - shim may need adjusting.');
}

module.exports = global.window.qz;
