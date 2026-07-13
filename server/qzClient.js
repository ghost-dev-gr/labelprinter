// qzClient.js
// Bootstraps the QZ Tray connection for the SERVER (Node), instead of the browser tab.
// qz-tray is the same official client library used in the browser (loaded via CDN in
// App.jsx) — it just needs a WebSocket implementation, since Node doesn't have one as a
// global the way browsers do. Import this file once, before any code calls getQz() in
// utils/qzPrint.js — that function already checks globalThis.qz as its Node-side fallback.

import { WebSocket } from 'ws';

globalThis.WebSocket = WebSocket;

const qz = (await import('qz-tray')).default;
globalThis.qz = qz;

console.log('[qzClient] QZ Tray client ready on the server (WebSocket polyfilled via ws)');
