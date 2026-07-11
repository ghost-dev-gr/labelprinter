import React, { useEffect, useState } from 'react';
import LabelDesigner from './components/LabelDesigner.jsx';
import PrintForm from './components/PrintForm.jsx';
import ConnectionSettings from './components/ConnectionSettings.jsx';
import { fetchSettings, DEFAULT_TEMPLATE, DEFAULT_CONNECTION_SETTINGS } from './utils/settingsApi';

export default function App() {
  const [tab, setTab] = useState('print');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [connectionSettings, setConnectionSettings] = useState(DEFAULT_CONNECTION_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
    script.async = true;
    script.onload = () => console.log('QZ Tray library loaded:', typeof window.qz);
    script.onerror = () => console.error('Failed to load QZ Tray library');
    document.head.appendChild(script);

    fetchSettings().then(({ connection, template: tpl }) => {
      setConnectionSettings(connection);
      setTemplate(tpl);
      setLoading(false);
    });

    return () => script.remove();
  }, []);

  if (loading) {
    return <div style={{ padding: 16, fontFamily: 'sans-serif' }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>Label Printer</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #ddd' }}>
        {[
          { id: 'print', label: 'Print' },
          { id: 'designer', label: 'Label Designer' },
          { id: 'settings', label: 'Connection' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #0073ea' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t.id ? 'bold' : 'normal'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'print' && <PrintForm template={template} connectionSettings={connectionSettings} />}
      {tab === 'designer' && <LabelDesigner template={template} setTemplate={setTemplate} />}
      {tab === 'settings' && (
        <ConnectionSettings settings={connectionSettings} setSettings={setConnectionSettings} />
      )}
    </div>
  );
}
