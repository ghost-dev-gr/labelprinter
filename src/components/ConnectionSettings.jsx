import React, { useState } from 'react';
import { saveSettings, fetchPrinters } from '../utils/settingsApi';

export default function ConnectionSettings({ settings, setSettings }) {
  const [printers, setPrinters] = useState([]);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  function update(patch) {
    setSettings((s) => ({ ...s, ...patch }));
  }

  async function handleTestConnection() {
    setTesting(true);
    setStatus('');
    try {
      // Save first so the server (which does the actual connecting) uses the
      // values currently in the form, not whatever was saved before.
      await saveSettings(settings);
      const found = await fetchPrinters();
      setPrinters(found);
      setStatus(`Connected - found ${found.length} printer(s)`);
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
    setTesting(false);
  }

  async function handleSave() {
    await saveSettings(settings);
    setStatus('Settings saved.');
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h2 style={{ fontSize: 16 }}>Printer &amp; Tunnel Connection</h2>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Tunnel host (e.g. your-tunnel.trycloudflare.com):{' '}
        <input type="text" value={settings.tunnelHost} onChange={(e) => update({ tunnelHost: e.target.value })} />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Tunnel port:{' '}
        <input
          type="number"
          value={settings.tunnelPort}
          onChange={(e) => update({ tunnelPort: Number(e.target.value) })}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Copies per print:{' '}
        <input
          type="number"
          min="1"
          value={settings.copies}
          onChange={(e) => update({ copies: Number(e.target.value) })}
        />
      </label>

      <div style={{ margin: '12px 0' }}>
        <button onClick={handleTestConnection} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>{' '}
        <button onClick={handleSave}>Save Settings</button>
      </div>

      {printers.length > 0 && (
        <label style={{ display: 'block', marginBottom: 8 }}>
          Printer:{' '}
          <select value={settings.printerName} onChange={(e) => update({ printerName: e.target.value })}>
            <option value="">(select a printer)</option>
            {printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      )}

      <hr style={{ margin: '16px 0' }} />

      <h3 style={{ fontSize: 14 }}>monday.com Automation (optional)</h3>

      <label style={{ display: 'block', marginBottom: 8 }}>
        monday API token:{' '}
        <input
          type="password"
          placeholder={settings.mondayApiToken === '(set)' ? '(already set)' : ''}
          onChange={(e) => update({ mondayApiToken: e.target.value })}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Webhook secret:{' '}
        <input
          type="password"
          placeholder={settings.webhookSecret === '(set)' ? '(already set)' : ''}
          onChange={(e) => update({ webhookSecret: e.target.value })}
        />
      </label>

      <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>{status}</div>
    </div>
  );
}
