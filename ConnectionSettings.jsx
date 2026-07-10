// ConnectionSettings.jsx
// QZ Tray connection configuration form with test and save capabilities

import React, { useState } from 'react';
import { saveConnectionSettings } from './connectionSettings';
import { disconnect, listPrinters } from './qzPrint';

export default function ConnectionSettings({ settings, setSettings }) {
  const [testStatus, setTestStatus] = useState('');
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [testing, setTesting] = useState(false);
  const abortController = React.useRef(null);

  function updateSetting(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function handleCancelTest() {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
    setTesting(false);
    setTestStatus('');
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestStatus('');
    setAvailablePrinters([]);

    abortController.current = new AbortController();
    const signal = abortController.current.signal;

    try {
      // Check if QZ Tray library is loaded
      if (!window.qz) {
        throw new Error('QZ Tray library not loaded yet. Please wait a moment and try again.');
      }

      // IMPORTANT: only disconnect first if something is actually connected. QZ's own
      // demo calls connect() immediately and synchronously in the click handler on a
      // fresh page - it only disconnects-then-reconnects when already active. Awaiting
      // an unconditional disconnect() first (even a no-op) burns through the browser's
      // "this came from a real click" window that Local Network Access permission
      // checks require, causing a silent block instead of a permission prompt.
      if (window.qz.websocket.isActive()) {
        await disconnect();
        if (signal.aborted) return;
      }

      const printers = await listPrinters(settings);

      if (signal.aborted) return;

      setAvailablePrinters(printers);
      setTestStatus(`success:Connected — found ${printers.length} printer(s)`);
    } catch (err) {
      if (signal.aborted) return;
      
      console.error('Connection test failed:', err);
      
      let errorMsg = err.message;
      
      // Provide helpful error messages for common issues
      if (errorMsg.includes('Cannot read properties of undefined')) {
        errorMsg = 'QZ Tray is not running. Please start QZ Tray on your computer and try again.';
      } else if (errorMsg.includes('WebSocket')) {
        errorMsg = `Cannot connect to QZ Tray at ${settings.usingSecure ? 'wss' : 'ws'}://${settings.host}:${settings.usingSecure ? settings.securePort : settings.insecurePort}. Make sure QZ Tray is running.`;
      }
      
      setTestStatus(`error:${errorMsg}`);
    } finally {
      if (!signal.aborted) {
        setTesting(false);
      }
      abortController.current = null;
    }
  }

  // Standalone diagnostic - checks Chrome's Local Network Access permission state
  // WITHOUT touching the connect flow, so it can't interfere with that call's
  // click-activation timing. Chrome has used a few different permission names
  // during this feature's rollout, so check all of them.
  async function handleCheckLnaPermission() {
    if (!navigator.permissions?.query) {
      console.log('[LNA] navigator.permissions.query is not available in this browser');
      setTestStatus('error:This browser does not expose navigator.permissions.query at all');
      return;
    }
    const results = {};
    for (const name of ['local-network-access', 'local-network', 'loopback-network']) {
      try {
        const status = await navigator.permissions.query({ name });
        results[name] = status.state;
      } catch (e) {
        results[name] = 'not recognized by this browser';
      }
    }
    console.log('[LNA] permission states:', results);
    setTestStatus('success:Checked - see console for [LNA] permission states (F12 → Console)');
  }

  function handleSaveSettings() {
    try {
      saveConnectionSettings(settings);
      setTestStatus('success:Settings saved successfully');
      setTimeout(() => setTestStatus(''), 3000);
    } catch (err) {
      setTestStatus(`error:Failed to save: ${err.message}`);
    }
  }

  const isSuccess = testStatus.startsWith('success:');
  const isError = testStatus.startsWith('error:');
  const statusMessage = testStatus.replace(/^(success|error):/, '');

  return (
    <div className="max-w-2xl">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">QZ Tray Connection</h2>
          <p className="text-sm text-muted-foreground">
            Configure connection to QZ Tray running on this computer. Settings are stored locally.
          </p>
        </div>

        <div className="grid gap-6 rounded-lg border border-border bg-card p-6">
          <div className="grid gap-2">
            <label htmlFor="host" className="text-sm font-medium text-foreground">
              Host / IP Address
            </label>
            <input
              id="host"
              type="text"
              value={settings.host}
              onChange={(e) => updateSetting('host', e.target.value)}
              placeholder="localhost"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="secure"
              type="checkbox"
              checked={settings.usingSecure}
              onChange={(e) => updateSetting('usingSecure', e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
            <label htmlFor="secure" className="text-sm font-medium text-foreground cursor-pointer">
              Use secure websocket (wss://)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="securePort" className="text-sm font-medium text-foreground">
                Secure Port
              </label>
              <input
                id="securePort"
                type="number"
                value={settings.securePort}
                onChange={(e) => updateSetting('securePort', Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="insecurePort" className="text-sm font-medium text-foreground">
                Insecure Port
              </label>
              <input
                id="insecurePort"
                type="number"
                value={settings.insecurePort}
                onChange={(e) => updateSetting('insecurePort', Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="copies" className="text-sm font-medium text-foreground">
              Copies Per Print
            </label>
            <input
              id="copies"
              type="number"
              min="1"
              value={settings.copies}
              onChange={(e) => updateSetting('copies', Number(e.target.value))}
              className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
          </div>

          {availablePrinters.length > 0 && (
            <div className="grid gap-2">
              <label htmlFor="printerOverride" className="text-sm font-medium text-foreground">
                Printer Override
              </label>
              <select
                id="printerOverride"
                value={settings.printerOverride}
                onChange={(e) => updateSetting('printerOverride', e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
              >
                <option value="">Auto-detect (HPRT / HT600)</option>
                {availablePrinters.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-detect by name matching "hprt" or "ht600"
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {!testing ? (
              <button
                onClick={handleTestConnection}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Test Connection
              </button>
            ) : (
              <button
                onClick={handleCancelTest}
                className="h-9 px-4 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
              >
                Cancel Test
              </button>
            )}
            <button
              onClick={handleCheckLnaPermission}
              className="h-9 px-4 rounded-md border border-input bg-background text-foreground text-sm font-medium hover:bg-secondary transition-colors"
            >
              Check LNA Permission
            </button>
            <button
              onClick={handleSaveSettings}
              className="h-9 px-4 rounded-md border border-input bg-background text-foreground text-sm font-medium hover:bg-secondary transition-colors"
            >
              Save Settings
            </button>
          </div>

          {testStatus && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                isSuccess
                  ? 'border-chart-4/50 bg-chart-4/10 text-chart-4'
                  : isError
                  ? 'border-destructive/50 bg-destructive/10 text-destructive'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
