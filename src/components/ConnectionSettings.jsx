import React, { useState } from 'react';
import { saveConnection } from '../utils/settingsApi';
import { disconnect, listPrinters } from '../utils/qzPrint';

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
      if (window.qz?.websocket?.isActive()) {
        await disconnect();
      }
      const found = await listPrinters(settings);
      setPrinters(found);
      setStatus(`Connected - found ${found.length} printer(s)`);
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
    setTesting(false);
  }

  async function handleSave() {
    await saveConnection(settings);
    setStatus('Settings saved.');
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h2 style={{ fontSize: 16 }}>QZ Tray Connection</h2>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Host / IP:{' '}
        <input type="text" value={settings.host} onChange={(e) => update({ host: e.target.value })} />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={settings.usingSecure}
          onChange={(e) => update({ usingSecure: e.target.checked })}
        />{' '}
        Use secure websocket (wss)
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Secure port:{' '}
        <input
          type="number"
          value={settings.securePort}
          onChange={(e) => update({ securePort: Number(e.target.value) })}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Insecure port:{' '}
        <input
          type="number"
          value={settings.insecurePort}
          onChange={(e) => update({ insecurePort: Number(e.target.value) })}
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
          <select value={settings.printerOverride} onChange={(e) => update({ printerOverride: e.target.value })}>
            <option value="">(select a printer)</option>
            {printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      )}

      <div style={{ fontSize: 13, color: '#555' }}>{status}</div>
    </div>
  );
}
